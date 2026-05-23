"""
IdentityMatcher — Composite multi-feature identity matching.

Combines facial recognition with body biometrics, gait analysis, and height
to create a robust identity system that works even with partial data
(e.g., face obscured, different clothing, wearing a hat).

Fusion weights (configurable):
- Face: 45%  (primary, highest discriminating power)
- Body build: 20%  (shoulder width, torso proportions)
- Gait: 15%  (walking pattern — very hard to fake)
- Height: 10%  (consistent across visits)
- Distinguishing marks: 10%  (tattoos, scars, glasses pattern)
"""
import numpy as np
import logging
from typing import Optional, List, Dict, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class IdentityMatch:
    """Full composite identity match result."""
    person_id: str
    composite_score: float  # 0-1, weighted combination
    
    # Individual scores
    face_score: float
    body_score: float
    gait_score: float
    height_score: float
    marks_score: float
    
    # Which features were available for matching
    features_used: List[str]
    
    # Confidence level
    confidence_level: str  # "very_high", "high", "medium", "low"
    
    # Details
    display_name: Optional[str] = None
    status: Optional[str] = None
    threat_level: int = 0
    total_incidents: int = 0


class IdentityMatcher:
    """
    Fuses multiple biometric signals for robust identity matching.
    """

    def __init__(
        self,
        face_weight: float = 0.45,
        body_weight: float = 0.20,
        gait_weight: float = 0.15,
        height_weight: float = 0.10,
        marks_weight: float = 0.10,
        composite_threshold: float = 0.72,
    ):
        self.face_weight = face_weight
        self.body_weight = body_weight
        self.gait_weight = gait_weight
        self.height_weight = height_weight
        self.marks_weight = marks_weight
        self.composite_threshold = composite_threshold
        
    def match(
        self,
        face_score: Optional[float] = None,
        body_embedding: Optional[np.ndarray] = None,
        gait_embedding: Optional[np.ndarray] = None,
        height_cm: Optional[float] = None,
        marks: Optional[Dict] = None,
        candidate_persons: List[Dict] = None,
    ) -> List[IdentityMatch]:
        """
        Match against candidate persons using all available features.
        
        candidate_persons: [{
            "person_id": str,
            "face_score": float,  # Pre-computed by FaceEngine
            "body_embedding": bytes,
            "gait_embedding": bytes,
            "height_cm": float,
            "marks": dict,
            "display_name": str,
            "status": str,
            "threat_level": int,
            "total_incidents": int,
        }]
        """
        if not candidate_persons:
            return []

        matches = []
        
        for candidate in candidate_persons:
            features_used = []
            scores = {}
            weights_used = {}
            
            # Face score (already computed by FaceEngine)
            c_face_score = candidate.get("face_score", 0)
            if c_face_score > 0:
                scores["face"] = c_face_score
                weights_used["face"] = self.face_weight
                features_used.append("face")
            
            # Body similarity
            c_body = candidate.get("body_embedding")
            if body_embedding is not None and c_body is not None:
                if isinstance(c_body, bytes):
                    c_body = np.frombuffer(c_body, dtype=np.float64)
                body_score = self._cosine_similarity(body_embedding, c_body)
                scores["body"] = max(0, body_score)
                weights_used["body"] = self.body_weight
                features_used.append("body")
            
            # Gait similarity
            c_gait = candidate.get("gait_embedding")
            if gait_embedding is not None and c_gait is not None:
                if isinstance(c_gait, bytes):
                    c_gait = np.frombuffer(c_gait, dtype=np.float64)
                gait_score = self._cosine_similarity(gait_embedding, c_gait)
                scores["gait"] = max(0, gait_score)
                weights_used["gait"] = self.gait_weight
                features_used.append("gait")
            
            # Height match
            c_height = candidate.get("height_cm")
            if height_cm and c_height:
                height_diff = abs(height_cm - c_height)
                # Within 3cm = perfect, degrades linearly
                height_score = max(0, 1.0 - (height_diff / 15.0))
                scores["height"] = height_score
                weights_used["height"] = self.height_weight
                features_used.append("height")
            
            # Distinguishing marks
            c_marks = candidate.get("marks")
            if marks and c_marks:
                marks_score = self._match_marks(marks, c_marks)
                scores["marks"] = marks_score
                weights_used["marks"] = self.marks_weight
                features_used.append("marks")
            
            if not scores:
                continue
            
            # Normalize weights to sum to 1.0
            total_weight = sum(weights_used.values())
            if total_weight == 0:
                continue
                
            composite_score = sum(
                scores[k] * (weights_used[k] / total_weight)
                for k in scores
            )
            
            # Determine confidence level
            confidence = self._determine_confidence(
                composite_score, len(features_used), features_used
            )
            
            matches.append(IdentityMatch(
                person_id=candidate["person_id"],
                composite_score=composite_score,
                face_score=scores.get("face", 0),
                body_score=scores.get("body", 0),
                gait_score=scores.get("gait", 0),
                height_score=scores.get("height", 0),
                marks_score=scores.get("marks", 0),
                features_used=features_used,
                confidence_level=confidence,
                display_name=candidate.get("display_name"),
                status=candidate.get("status"),
                threat_level=candidate.get("threat_level", 0),
                total_incidents=candidate.get("total_incidents", 0),
            ))
        
        # Sort by composite score
        matches.sort(key=lambda m: m.composite_score, reverse=True)
        
        # Filter by threshold
        return [m for m in matches if m.composite_score >= self.composite_threshold]

    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        """Compute cosine similarity between two vectors."""
        if len(a) != len(b):
            return 0.0
        dot = np.dot(a, b)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(dot / (norm_a * norm_b))

    def _match_marks(self, marks_a: Dict, marks_b: Dict) -> float:
        """Match distinguishing marks between two profiles."""
        if not marks_a or not marks_b:
            return 0.0
        
        common_features = 0
        total_features = 0
        
        # Check common mark types
        for mark_type in ["tattoos", "scars", "glasses", "facial_hair", "piercings"]:
            a_has = marks_a.get(mark_type, False)
            b_has = marks_b.get(mark_type, False)
            total_features += 1
            if a_has == b_has:
                common_features += 1
        
        return common_features / max(total_features, 1)

    def _determine_confidence(
        self, score: float, num_features: int, features: List[str]
    ) -> str:
        """Determine confidence level based on score and feature count."""
        if score >= 0.90 and num_features >= 3 and "face" in features:
            return "very_high"
        elif score >= 0.80 and num_features >= 2:
            return "high"
        elif score >= 0.72 and num_features >= 2:
            return "medium"
        else:
            return "low"
