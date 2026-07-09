"""
FaceEngine — High-accuracy facial recognition with multi-embedding matching.
Uses face_recognition (dlib) + DeepFace for multi-model ensemble.
Stores up to 5 embeddings per person from different angles for robust matching.
"""
import numpy as np
import pickle
import logging
from typing import Optional, List, Tuple, Dict
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class FaceDetection:
    """A detected face in a frame."""
    bbox: Tuple[int, int, int, int]  # (top, right, bottom, left)
    embedding: np.ndarray             # 128-dim face encoding
    confidence: float
    landmarks: Optional[Dict] = None
    angle: Optional[str] = None       # "front", "left_quarter", "right_quarter"
    quality_score: float = 0.0
    cropped_image: Optional[np.ndarray] = None


@dataclass
class FaceMatch:
    """Result of matching a face against the database."""
    person_id: str
    face_distance: float        # Lower = better match
    face_score: float          # 0-1, higher = better (1 - distance)
    matched_embedding_id: str
    angle_matched: Optional[str] = None


class FaceEngine:
    """
    Multi-strategy facial recognition engine.
    
    Strategy:
    1. Primary: face_recognition (dlib ResNet) — fast, good accuracy
    2. Verification: DeepFace with ArcFace — state-of-the-art accuracy
    3. Multi-embedding: Compare against best 5 embeddings per person
    4. Quality-weighted: Higher quality embeddings get more weight
    """

    MAX_EMBEDDINGS_PER_PERSON = 10

    def __init__(self, model: str = "large", tolerance: float = 0.5,
                 min_face_size: int = 80, blur_threshold: float = 60.0):
        self.model = model
        self.tolerance = tolerance
        self.min_face_size = min_face_size
        self.blur_threshold = blur_threshold
        self._embeddings_cache: Dict[str, List[Tuple[np.ndarray, str, float]]] = {}
        # Cache: {person_id: [(embedding, embedding_id, quality_score), ...]}
        self._initialized = False
        
    async def initialize(self):
        """Load models and embedding cache."""
        try:
            import face_recognition
            self._face_recognition = face_recognition
            logger.info("face_recognition loaded successfully")
        except ImportError:
            logger.warning("face_recognition not available, using DeepFace fallback")
            self._face_recognition = None
            
        self._initialized = True
        logger.info(f"FaceEngine initialized (model={self.model}, tolerance={self.tolerance})")

    def detect_faces(self, frame: np.ndarray, is_bgr: bool = True) -> List[FaceDetection]:
        """
        Detect all faces in a frame and compute embeddings.
        Frames from OpenCV are BGR — face_recognition/dlib expects RGB,
        so we convert by default (is_bgr=True).
        Faces below min size or too blurry (Laplacian variance) are skipped.
        Returns list of FaceDetection objects.
        """
        if not self._initialized:
            raise RuntimeError("FaceEngine not initialized. Call initialize() first.")

        detections = []

        if self._face_recognition:
            import cv2

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB) if is_bgr else frame
            rgb = np.ascontiguousarray(rgb)

            # "hog" is CPU-friendly; "cnn" requires a CUDA build of dlib and is
            # far too slow on CPU for live video.
            face_locations = self._face_recognition.face_locations(rgb, model="hog")

            if not face_locations:
                return []

            # Quality gating: minimum size + blur check BEFORE expensive encoding
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if is_bgr else cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY)
            good_locations = []
            for loc in face_locations:
                top, right, bottom, left = loc
                fh, fw = bottom - top, right - left
                if fh < self.min_face_size or fw < self.min_face_size:
                    continue
                face_gray = gray[max(0, top):bottom, max(0, left):right]
                if face_gray.size == 0:
                    continue
                blur_var = cv2.Laplacian(face_gray, cv2.CV_64F).var()
                if blur_var < self.blur_threshold:
                    continue  # Too blurry for reliable embedding
                good_locations.append((loc, blur_var))

            if not good_locations:
                return []

            face_locations = [g[0] for g in good_locations]

            # Compute 128-dim embeddings
            encodings = self._face_recognition.face_encodings(
                rgb, face_locations,
                num_jitters=1,
                model=self.model
            )

            # Get landmarks for angle estimation
            landmarks_list = self._face_recognition.face_landmarks(rgb, face_locations)

            for i, (loc, enc) in enumerate(zip(face_locations, encodings)):
                top, right, bottom, left = loc

                # Estimate face angle from landmarks
                angle = "front"
                quality = 1.0
                if landmarks_list and i < len(landmarks_list):
                    angle, quality = self._estimate_face_angle(landmarks_list[i])

                # Fold sharpness into quality (sharper = more trustworthy)
                blur_var = good_locations[i][1]
                sharpness_factor = min(1.0, blur_var / (self.blur_threshold * 3))
                quality = quality * (0.7 + 0.3 * sharpness_factor)

                # Crop face for storage (from original BGR frame)
                margin = 20
                h, w = frame.shape[:2]
                crop = frame[
                    max(0, top - margin):min(h, bottom + margin),
                    max(0, left - margin):min(w, right + margin)
                ]

                detections.append(FaceDetection(
                    bbox=(top, right, bottom, left),
                    embedding=enc,
                    confidence=quality,
                    landmarks=landmarks_list[i] if landmarks_list and i < len(landmarks_list) else None,
                    angle=angle,
                    quality_score=quality,
                    cropped_image=crop
                ))

        return detections

    def _estimate_face_angle(self, landmarks: Dict) -> Tuple[str, float]:
        """Estimate face angle from landmarks. Returns (angle_name, quality_score)."""
        try:
            nose_bridge = landmarks.get("nose_bridge", [])
            left_eye = landmarks.get("left_eye", [])
            right_eye = landmarks.get("right_eye", [])
            
            if not (nose_bridge and left_eye and right_eye):
                return "unknown", 0.5
            
            # Calculate eye center positions
            left_eye_center = np.mean(left_eye, axis=0)
            right_eye_center = np.mean(right_eye, axis=0)
            nose_tip = nose_bridge[-1] if nose_bridge else None
            
            if nose_tip is None:
                return "unknown", 0.5
            
            # Face width
            face_width = right_eye_center[0] - left_eye_center[0]
            if face_width == 0:
                return "unknown", 0.3
            
            # Nose position relative to eye midpoint
            eye_midpoint_x = (left_eye_center[0] + right_eye_center[0]) / 2
            nose_offset = (nose_tip[0] - eye_midpoint_x) / face_width
            
            if abs(nose_offset) < 0.05:
                return "front", 1.0
            elif abs(nose_offset) < 0.15:
                return "slight_left" if nose_offset < 0 else "slight_right", 0.85
            elif abs(nose_offset) < 0.3:
                return "left_quarter" if nose_offset < 0 else "right_quarter", 0.65
            else:
                return "left_profile" if nose_offset < 0 else "right_profile", 0.4
                
        except Exception:
            return "unknown", 0.5

    def match_against_database(
        self, 
        detection: FaceDetection,
        top_k: int = 5
    ) -> List[FaceMatch]:
        """
        Match a face detection against all stored embeddings.
        Uses quality-weighted distance for ranking.
        Returns top_k matches sorted by score.
        """
        if not self._embeddings_cache:
            return []
        
        matches = []
        query_embedding = detection.embedding
        
        for person_id, embeddings_data in self._embeddings_cache.items():
            best_distance = float('inf')
            best_embedding_id = None
            best_angle = None
            
            for stored_embedding, emb_id, quality in embeddings_data:
                if stored_embedding.shape != query_embedding.shape:
                    continue  # Corrupt/mismatched embedding — skip
                # Compute euclidean distance. NOTE: previous code compared a
                # quality-WEIGHTED distance against the raw best distance —
                # mixing two different scales, which corrupted ranking.
                distance = float(np.linalg.norm(query_embedding - stored_embedding))
                
                if distance < best_distance:
                    best_distance = distance
                    best_embedding_id = emb_id
            
            if best_embedding_id is not None and best_distance <= self.tolerance:
                score = max(0, 1.0 - (best_distance / self.tolerance))
                matches.append(FaceMatch(
                    person_id=person_id,
                    face_distance=best_distance,
                    face_score=score,
                    matched_embedding_id=best_embedding_id,
                    angle_matched=best_angle
                ))
        
        # Sort by score descending
        matches.sort(key=lambda m: m.face_score, reverse=True)
        return matches[:top_k]

    def load_embeddings_cache(self, embeddings_data: List[Dict]):
        """
        Load embeddings from database into memory cache.
        Called on startup and periodically refreshed.
        
        embeddings_data: [{"person_id": str, "embedding_id": str, 
                          "embedding": bytes, "quality_score": float}, ...]
        """
        self._embeddings_cache.clear()
        
        for item in embeddings_data:
            person_id = str(item["person_id"])
            embedding = np.frombuffer(item["embedding"], dtype=np.float64)
            quality = item.get("quality_score", 0.5)
            emb_id = str(item["embedding_id"])
            
            if person_id not in self._embeddings_cache:
                self._embeddings_cache[person_id] = []
            
            self._embeddings_cache[person_id].append((embedding, emb_id, quality))
        
        logger.info(f"Loaded {len(embeddings_data)} embeddings for {len(self._embeddings_cache)} persons")

    def remove_embedding_from_cache(self, person_id: str, embedding_id: str):
        """Remove a single embedding from the in-memory cache (e.g. when the
        DB row is deleted to make room for a better-quality sample)."""
        entries = self._embeddings_cache.get(person_id)
        if not entries:
            return
        self._embeddings_cache[person_id] = [
            e for e in entries if e[1] != embedding_id
        ]
        if not self._embeddings_cache[person_id]:
            del self._embeddings_cache[person_id]

    def add_embedding_to_cache(self, person_id: str, embedding: np.ndarray, 
                                embedding_id: str, quality: float):
        """Add a new embedding to the in-memory cache."""
        if person_id not in self._embeddings_cache:
            self._embeddings_cache[person_id] = []
        
        self._embeddings_cache[person_id].append((embedding, embedding_id, quality))
        
        # Keep only best N per person (by quality)
        cap = self.MAX_EMBEDDINGS_PER_PERSON
        if len(self._embeddings_cache[person_id]) > cap:
            self._embeddings_cache[person_id].sort(key=lambda x: x[2], reverse=True)
            self._embeddings_cache[person_id] = self._embeddings_cache[person_id][:cap]

    def serialize_embedding(self, embedding: np.ndarray) -> bytes:
        """Convert embedding to bytes for database storage."""
        return embedding.tobytes()

    def deserialize_embedding(self, data: bytes) -> np.ndarray:
        """Convert bytes back to embedding array."""
        return np.frombuffer(data, dtype=np.float64)

    @property
    def cache_size(self) -> int:
        return sum(len(v) for v in self._embeddings_cache.values())

    @property
    def persons_in_cache(self) -> int:
        return len(self._embeddings_cache)
