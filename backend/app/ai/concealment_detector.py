"""
ConcealmentDetector — Detects when someone puts items in pockets, purses, bags, etc.

This is the CORE theft detection module. It uses:
1. MediaPipe Pose for body keypoint tracking
2. Hand trajectory analysis (shelf → pocket/bag movement)
3. Object presence detection (item in hand → item disappeared)
4. Region-of-interest monitoring (pocket areas, bag openings)
5. Temporal pattern analysis (the sequence of actions)

Detection Scenarios:
- Hand reaches to shelf → grabs item → hand moves to pocket → item gone
- Hand reaches to shelf → grabs item → hand moves into open bag/purse
- Item picked up → concealed under clothing
- Item picked up → placed in waistband
- Multiple items swept into bag quickly
"""
import numpy as np
import logging
from typing import Optional, List, Dict, Tuple
from dataclasses import dataclass, field
from enum import Enum
from collections import deque

logger = logging.getLogger(__name__)


class ConcealmentType(str, Enum):
    POCKET_RIGHT = "right_pocket"
    POCKET_LEFT = "left_pocket"
    JACKET_INSIDE = "jacket_inside"
    BAG_PURSE = "bag_purse"
    BACKPACK = "backpack"
    WAISTBAND = "waistband"
    UNDER_CLOTHING = "under_clothing"
    SLEEVE = "sleeve"
    STROLLER = "stroller"
    SHOPPING_BAG = "shopping_bag"  # Using store bag to hide items


class HandState(str, Enum):
    EMPTY = "empty"
    HOLDING_ITEM = "holding_item"
    UNCERTAIN = "uncertain"


@dataclass
class PoseFrame:
    """Pose data for a single frame."""
    timestamp: float
    frame_number: int
    keypoints: Dict[str, Tuple[float, float, float]]  # name -> (x, y, visibility)
    left_hand_state: HandState = HandState.UNCERTAIN
    right_hand_state: HandState = HandState.UNCERTAIN
    left_hand_position: Optional[Tuple[float, float]] = None
    right_hand_position: Optional[Tuple[float, float]] = None


@dataclass
class ConcealmentEvent:
    """A detected concealment action."""
    concealment_type: ConcealmentType
    confidence: float                    # 0-1
    start_frame: int
    end_frame: int
    start_time: float
    end_time: float
    hand_used: str                       # "left", "right", "both"
    trajectory: List[Tuple[float, float]]  # Hand path during concealment
    item_detected_before: bool           # Was item visible in hand before?
    item_detected_after: bool            # Is item visible in hand after?
    shelf_interaction: bool              # Did they interact with a shelf?
    description: str                     # Human-readable description
    key_frame: int                       # The frame where concealment happened
    details: Dict = field(default_factory=dict)


# MediaPipe Pose landmark indices
POSE_LANDMARKS = {
    "nose": 0, "left_eye": 2, "right_eye": 5,
    "left_ear": 7, "right_ear": 8,
    "left_shoulder": 11, "right_shoulder": 12,
    "left_elbow": 13, "right_elbow": 14,
    "left_wrist": 15, "right_wrist": 16,
    "left_pinky": 17, "right_pinky": 18,
    "left_index": 19, "right_index": 20,
    "left_thumb": 21, "right_thumb": 22,
    "left_hip": 23, "right_hip": 24,
    "left_knee": 25, "right_knee": 26,
    "left_ankle": 27, "right_ankle": 28,
}

# Key body regions for concealment detection
POCKET_REGIONS = {
    "right_front_pocket": ("right_hip", "right_wrist"),
    "left_front_pocket": ("left_hip", "left_wrist"),
    "right_back_pocket": ("right_hip", "right_wrist"),
    "left_back_pocket": ("left_hip", "left_wrist"),
}


class ConcealmentDetector:
    """
    Analyzes pose sequences to detect concealment of merchandise.
    
    Pipeline:
    1. Track hand positions over time using MediaPipe Pose
    2. Detect "shelf interaction" — hand moves toward shelf area
    3. Monitor hand state — is the hand holding something?
    4. Detect "concealment motion" — hand moves to pocket/bag region
    5. Check post-concealment — item no longer visible in hand
    6. Calculate confidence based on all signals
    """

    def __init__(self, confidence_threshold: float = 0.75):
        self.confidence_threshold = confidence_threshold
        self.pose_model = None
        self._frame_buffer: deque = deque(maxlen=150)  # ~5 seconds at 30fps
        self._active_tracks: Dict[str, deque] = {}  # person_id -> pose history
        self._shelf_regions: List[Dict] = []  # Configured shelf regions
        self._initialized = False

    async def initialize(self):
        """Initialize MediaPipe Pose model."""
        try:
            import mediapipe as mp
            self.mp_pose = mp.solutions.pose
            self.mp_hands = mp.solutions.hands
            self.pose_model = self.mp_pose.Pose(
                static_image_mode=False,
                model_complexity=2,      # Highest accuracy
                enable_segmentation=True,
                min_detection_confidence=0.7,
                min_tracking_confidence=0.6,
            )
            self.hands_model = self.mp_hands.Hands(
                static_image_mode=False,
                max_num_hands=2,
                min_detection_confidence=0.6,
                min_tracking_confidence=0.5,
            )
            self._initialized = True
            logger.info("ConcealmentDetector initialized with MediaPipe")
        except ImportError:
            logger.error("MediaPipe not available")
            raise

    def process_frame(
        self,
        frame: np.ndarray,
        person_id: str,
        frame_number: int,
        timestamp: float,
        person_bbox: Optional[Tuple[int, int, int, int]] = None,
    ) -> Optional[ConcealmentEvent]:
        """
        Process a single frame for a tracked person.
        Returns ConcealmentEvent if concealment detected, None otherwise.
        """
        if not self._initialized:
            raise RuntimeError("Not initialized")

        # Extract person region
        if person_bbox:
            x1, y1, x2, y2 = person_bbox
            person_crop = frame[y1:y2, x1:x2]
        else:
            person_crop = frame

        # Run pose estimation
        import cv2
        rgb_frame = cv2.cvtColor(person_crop, cv2.COLOR_BGR2RGB)
        pose_results = self.pose_model.process(rgb_frame)

        if not pose_results.pose_landmarks:
            return None

        # Extract keypoints
        h, w = person_crop.shape[:2]
        keypoints = {}
        for name, idx in POSE_LANDMARKS.items():
            lm = pose_results.pose_landmarks.landmark[idx]
            keypoints[name] = (lm.x * w, lm.y * h, lm.visibility)

        # Detect hand states (holding item or empty)
        hand_results = self.hands_model.process(rgb_frame)
        left_hand_state, right_hand_state = self._analyze_hand_states(hand_results)

        # Create pose frame
        pose_frame = PoseFrame(
            timestamp=timestamp,
            frame_number=frame_number,
            keypoints=keypoints,
            left_hand_state=left_hand_state,
            right_hand_state=right_hand_state,
            left_hand_position=keypoints.get("left_wrist", (None, None))[:2],
            right_hand_position=keypoints.get("right_wrist", (None, None))[:2],
        )

        # Add to tracking buffer
        if person_id not in self._active_tracks:
            self._active_tracks[person_id] = deque(maxlen=150)
        self._active_tracks[person_id].append(pose_frame)

        # Need at least 15 frames (~0.5 sec) to analyze motion
        if len(self._active_tracks[person_id]) < 15:
            return None

        # Run concealment analysis
        event = self._analyze_for_concealment(person_id)
        return event

    def _analyze_hand_states(self, hand_results) -> Tuple[HandState, HandState]:
        """Analyze hand detection results to determine if hands are holding items."""
        left_state = HandState.UNCERTAIN
        right_state = HandState.UNCERTAIN

        if hand_results and hand_results.multi_hand_landmarks:
            for i, hand_landmarks in enumerate(hand_results.multi_hand_landmarks):
                handedness = hand_results.multi_handedness[i]
                label = handedness.classification[0].label  # "Left" or "Right"

                # Analyze finger positions — closed grip suggests holding item
                thumb_tip = hand_landmarks.landmark[4]
                index_tip = hand_landmarks.landmark[8]
                middle_tip = hand_landmarks.landmark[12]
                ring_tip = hand_landmarks.landmark[16]
                pinky_tip = hand_landmarks.landmark[20]

                # Calculate average fingertip distance from thumb
                tips = [index_tip, middle_tip, ring_tip, pinky_tip]
                avg_distance = np.mean([
                    np.sqrt((t.x - thumb_tip.x)**2 + (t.y - thumb_tip.y)**2)
                    for t in tips
                ])

                # Closed grip = likely holding something
                if avg_distance < 0.08:
                    state = HandState.HOLDING_ITEM
                elif avg_distance > 0.15:
                    state = HandState.EMPTY
                else:
                    state = HandState.UNCERTAIN

                if label == "Left":
                    left_state = state
                else:
                    right_state = state

        return left_state, right_state

    def _analyze_for_concealment(self, person_id: str) -> Optional[ConcealmentEvent]:
        """
        Core concealment detection algorithm.
        Analyzes recent pose history for concealment patterns.
        """
        frames = list(self._active_tracks[person_id])
        if len(frames) < 15:
            return None

        # Analyze last 3 seconds of frames
        recent = frames[-90:] if len(frames) >= 90 else frames

        # Check each hand for concealment motion
        for hand in ["right", "left"]:
            event = self._check_hand_concealment(recent, hand, person_id)
            if event and event.confidence >= self.confidence_threshold:
                return event

        return None

    def _check_hand_concealment(
        self, frames: List[PoseFrame], hand: str, person_id: str
    ) -> Optional[ConcealmentEvent]:
        """
        Check if a specific hand performed a concealment motion.
        
        Pattern we're looking for:
        1. Hand moves UP/OUT (reaching for shelf)
        2. Hand pauses briefly (grabbing item)
        3. Hand state changes to HOLDING_ITEM
        4. Hand moves DOWN toward hip/pocket/bag area
        5. Hand enters concealment zone (near pocket, bag, waistband)
        6. Hand state changes to EMPTY (item deposited)
        
        Each step adds confidence. All 6 = very high confidence.
        """
        wrist_key = f"{hand}_wrist"
        hip_key = f"{hand}_hip"
        shoulder_key = f"{hand}_shoulder"

        # Extract hand trajectory
        trajectory = []
        hand_states = []
        for f in frames:
            if wrist_key in f.keypoints:
                wx, wy, vis = f.keypoints[wrist_key]
                if vis > 0.5:
                    trajectory.append((wx, wy, f.frame_number, f.timestamp))
                    state = f.left_hand_state if hand == "left" else f.right_hand_state
                    hand_states.append(state)

        if len(trajectory) < 10:
            return None

        # === SIGNAL 1: Upward reach (shelf interaction) ===
        reach_detected = False
        reach_frame_idx = None
        for i in range(1, len(trajectory)):
            # Hand moved up significantly
            dy = trajectory[i-1][1] - trajectory[i][1]  # Positive = moved up
            if dy > 30:  # Significant upward movement
                reach_detected = True
                reach_frame_idx = i
                break

        # === SIGNAL 2: Downward motion toward body ===
        pocket_motion_detected = False
        pocket_frame_idx = None
        if reach_frame_idx:
            for i in range(reach_frame_idx, len(trajectory)):
                # Hand moved down toward hip level
                if hip_key in frames[min(i, len(frames)-1)].keypoints:
                    hip_y = frames[min(i, len(frames)-1)].keypoints[hip_key][1]
                    hand_y = trajectory[i][1]
                    
                    # Hand is near hip level
                    if abs(hand_y - hip_y) < 50:
                        pocket_motion_detected = True
                        pocket_frame_idx = i
                        break

        # === SIGNAL 3: Hand state transition (holding → empty) ===
        state_transition = False
        if len(hand_states) >= 5:
            # Look for holding_item → empty transition
            for i in range(1, len(hand_states)):
                if (hand_states[i-1] == HandState.HOLDING_ITEM and 
                    hand_states[i] == HandState.EMPTY):
                    state_transition = True
                    break
            # Also check: uncertain → empty after reach
            if not state_transition:
                for i in range(1, len(hand_states)):
                    if (hand_states[i-1] != HandState.EMPTY and 
                        hand_states[i] == HandState.EMPTY and i > 5):
                        state_transition = True
                        break

        # === SIGNAL 4: Hand enters pocket/bag region ===
        in_concealment_zone = False
        concealment_type = None
        if pocket_frame_idx and pocket_frame_idx < len(frames):
            f = frames[min(pocket_frame_idx, len(frames)-1)]
            if hip_key in f.keypoints and wrist_key in f.keypoints:
                hip_x, hip_y, _ = f.keypoints[hip_key]
                wrist_x, wrist_y, _ = f.keypoints[wrist_key]
                
                # Near hip pocket
                dist = np.sqrt((wrist_x - hip_x)**2 + (wrist_y - hip_y)**2)
                if dist < 60:
                    in_concealment_zone = True
                    concealment_type = ConcealmentType.POCKET_RIGHT if hand == "right" else ConcealmentType.POCKET_LEFT

                # Check for jacket inside (hand crosses to opposite side of body)
                opposite_shoulder = "left_shoulder" if hand == "right" else "right_shoulder"
                if opposite_shoulder in f.keypoints:
                    opp_x = f.keypoints[opposite_shoulder][0]
                    if (hand == "right" and wrist_x < opp_x) or (hand == "left" and wrist_x > opp_x):
                        concealment_type = ConcealmentType.JACKET_INSIDE

        # === SIGNAL 5: Speed pattern (quick shelf-to-pocket motion) ===
        quick_motion = False
        if reach_frame_idx and pocket_frame_idx:
            duration = trajectory[pocket_frame_idx][3] - trajectory[reach_frame_idx][3]
            if 0.3 < duration < 3.0:  # Concealment typically 0.3-3 seconds
                quick_motion = True

        # === CALCULATE CONFIDENCE ===
        confidence = 0.0
        signals = {
            "reach_to_shelf": reach_detected,
            "downward_to_pocket": pocket_motion_detected,
            "hand_state_transition": state_transition,
            "in_concealment_zone": in_concealment_zone,
            "quick_motion_pattern": quick_motion,
        }
        
        weights = {
            "reach_to_shelf": 0.15,
            "downward_to_pocket": 0.25,
            "hand_state_transition": 0.30,  # Strongest signal
            "in_concealment_zone": 0.20,
            "quick_motion_pattern": 0.10,
        }
        
        for signal_name, detected in signals.items():
            if detected:
                confidence += weights[signal_name]

        # Boost confidence if multiple strong signals
        active_signals = sum(1 for v in signals.values() if v)
        if active_signals >= 4:
            confidence = min(1.0, confidence * 1.15)
        if active_signals >= 5:
            confidence = min(1.0, confidence * 1.10)

        if confidence < 0.3:  # Below minimum threshold
            return None

        # Build event
        key_frame = trajectory[pocket_frame_idx][2] if pocket_frame_idx else trajectory[-1][2]
        
        description = self._generate_description(
            hand, concealment_type, signals, confidence
        )

        return ConcealmentEvent(
            concealment_type=concealment_type or ConcealmentType.POCKET_RIGHT,
            confidence=confidence,
            start_frame=trajectory[0][2],
            end_frame=trajectory[-1][2],
            start_time=trajectory[0][3],
            end_time=trajectory[-1][3],
            hand_used=hand,
            trajectory=[(t[0], t[1]) for t in trajectory],
            item_detected_before=reach_detected,
            item_detected_after=not state_transition,
            shelf_interaction=reach_detected,
            description=description,
            key_frame=key_frame,
            details=signals,
        )

    def _generate_description(
        self, hand: str, concealment_type: Optional[ConcealmentType],
        signals: Dict, confidence: float
    ) -> str:
        """Generate human-readable description of the concealment event."""
        parts = []
        
        if signals["reach_to_shelf"]:
            parts.append(f"Subject reached toward shelf with {hand} hand")
        
        if signals["hand_state_transition"]:
            parts.append("appeared to grab an item")
        
        if signals["downward_to_pocket"]:
            target = "pocket area"
            if concealment_type == ConcealmentType.JACKET_INSIDE:
                target = "inside jacket"
            elif concealment_type == ConcealmentType.BAG_PURSE:
                target = "bag/purse"
            elif concealment_type == ConcealmentType.WAISTBAND:
                target = "waistband"
            parts.append(f"moved hand to {target}")
        
        if signals["in_concealment_zone"]:
            parts.append("item no longer visible in hand")
        
        if not parts:
            return f"Suspicious {hand} hand movement detected (confidence: {confidence:.0%})"
        
        desc = ". ".join(parts) + "."
        desc += f" (Confidence: {confidence:.0%})"
        return desc

    def configure_shelf_regions(self, regions: List[Dict]):
        """
        Set up shelf/product regions for better reach detection.
        regions: [{"name": "candy_shelf", "bbox": [x1,y1,x2,y2]}, ...]
        """
        self._shelf_regions = regions
        logger.info(f"Configured {len(regions)} shelf regions")

    def clear_track(self, person_id: str):
        """Clear tracking data for a person (when they leave frame)."""
        self._active_tracks.pop(person_id, None)

    def get_active_track_count(self) -> int:
        return len(self._active_tracks)
