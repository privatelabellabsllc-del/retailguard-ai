"""
DetectionPipeline — Orchestrates the full AI detection flow.

This is the main loop that processes camera frames:
1. Person detection & tracking
2. Face detection & identity matching
3. Pose estimation & concealment detection
4. Alert generation for known offenders
5. Video clip capture for incidents
"""
import asyncio
import cv2
import numpy as np
import logging
import time
from typing import Optional, Dict, List, Tuple
from datetime import datetime, timedelta
from collections import deque
from dataclasses import dataclass

from app.ai.face_engine import FaceEngine, FaceDetection
from app.ai.concealment_detector import ConcealmentDetector, ConcealmentEvent
from app.ai.identity_matcher import IdentityMatcher, IdentityMatch
from app.ai.zone_tracker import ZoneTracker, ZoneDefinition, TheftClassification, PersonJourney
from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class TrackedPerson:
    """A person currently being tracked in the scene."""
    track_id: str
    person_id: Optional[str]  # Matched DB person ID (None if unknown)
    bbox: Tuple[int, int, int, int]
    last_seen: float
    identity_match: Optional[IdentityMatch] = None
    face_detections: List[FaceDetection] = None
    is_offender: bool = False
    is_blacklisted: bool = False
    alert_sent: bool = False
    
    def __post_init__(self):
        if self.face_detections is None:
            self.face_detections = []


@dataclass 
class ClipCapture:
    """Active video clip being captured for an incident."""
    track_id: str
    person_id: Optional[str]
    camera_id: str
    start_time: float
    max_duration: float
    frames: List[Tuple[np.ndarray, float]]  # (frame, timestamp)
    trigger_event: ConcealmentEvent
    completed: bool = False


class DetectionPipeline:
    """
    Main AI pipeline that processes camera streams.
    Runs one instance per camera.
    """

    def __init__(
        self,
        camera_id: str,
        face_engine: FaceEngine,
        concealment_detector: ConcealmentDetector,
        identity_matcher: IdentityMatcher,
        zone_tracker: Optional[ZoneTracker] = None,
        on_alert_callback=None,       # Called when known offender detected
        on_incident_callback=None,    # Called when concealment detected
        on_clip_ready_callback=None,  # Called when evidence clip is ready
        on_theft_classified_callback=None,  # Called when theft/paid is determined
    ):
        self.camera_id = camera_id
        self.face_engine = face_engine
        self.concealment_detector = concealment_detector
        self.identity_matcher = identity_matcher
        self.zone_tracker = zone_tracker or ZoneTracker()
        
        self.on_alert = on_alert_callback
        self.on_incident = on_incident_callback
        self.on_clip_ready = on_clip_ready_callback
        self.on_theft_classified = on_theft_classified_callback
        
        # Wire up zone tracker callback
        self.zone_tracker.on_theft_classified = self._on_journey_classified
        
        # Tracking state
        self.tracked_persons: Dict[str, TrackedPerson] = {}
        self.active_clips: Dict[str, ClipCapture] = {}
        self.frame_count = 0
        self.fps = 0
        self.frame_width = 0
        self.frame_height = 0
        
        # Frame buffer for pre-event recording
        self.frame_buffer: deque = deque(maxlen=settings.CLIP_PRE_SECONDS * 30)
        
        # Processing intervals (not every frame needs full AI)
        self.face_detect_interval = 5     # Run face detection every 5 frames
        self.identity_match_interval = 15  # Run identity matching every 15 frames
        self.pose_interval = 2            # Run pose every 2 frames (important for concealment)
        self.zone_check_interval = 3      # Check zone positions every 3 frames
        self.timeout_check_interval = 150  # Check journey timeouts every 150 frames (~5s)
        
        self._running = False
        self._track_counter = 0

    async def start(self, rtsp_url: str):
        """Start processing a camera stream."""
        logger.info(f"Starting detection pipeline for camera {self.camera_id}")
        self._running = True
        
        cap = cv2.VideoCapture(rtsp_url)
        if not cap.isOpened():
            logger.error(f"Failed to open stream: {rtsp_url}")
            return
        
        actual_fps = cap.get(cv2.CAP_PROP_FPS) or 25
        self.fps = actual_fps
        
        try:
            while self._running:
                ret, frame = cap.read()
                if not ret:
                    logger.warning("Frame read failed, reconnecting...")
                    await asyncio.sleep(1)
                    cap.release()
                    cap = cv2.VideoCapture(rtsp_url)
                    continue
                
                timestamp = time.time()
                self.frame_count += 1
                
                # Store frame in buffer (for pre-event clips)
                self.frame_buffer.append((frame.copy(), timestamp))
                
                # Track frame dimensions for zone calculations
                if self.frame_height == 0:
                    self.frame_height, self.frame_width = frame.shape[:2]
                
                # Process frame
                await self._process_frame(frame, timestamp)
                
                # Update active clip captures
                await self._update_clips(frame, timestamp)
                
                # Yield to event loop
                await asyncio.sleep(0.001)
                
        except Exception as e:
            logger.error(f"Pipeline error: {e}", exc_info=True)
        finally:
            cap.release()
            self._running = False

    async def _process_frame(self, frame: np.ndarray, timestamp: float):
        """Process a single frame through the AI pipeline."""
        
        # === STEP 1: Person Detection (every frame) ===
        # Using background subtraction + contour detection for speed
        person_bboxes = self._detect_persons(frame)
        
        # Update tracked persons
        self._update_tracks(person_bboxes, timestamp)
        
        # === STEP 2: Face Detection & Recognition (periodic) ===
        if self.frame_count % self.face_detect_interval == 0:
            for track_id, person in self.tracked_persons.items():
                x1, y1, x2, y2 = person.bbox
                person_crop = frame[y1:y2, x1:x2]
                
                if person_crop.size == 0:
                    continue
                
                faces = self.face_engine.detect_faces(person_crop)
                if faces:
                    person.face_detections = faces
                    
                    # Try to match identity
                    if self.frame_count % self.identity_match_interval == 0:
                        best_face = max(faces, key=lambda f: f.quality_score)
                        face_matches = self.face_engine.match_against_database(best_face)
                        
                        if face_matches:
                            top_match = face_matches[0]
                            person.person_id = top_match.person_id
                            
                            # Check if this is an offender or blacklisted person
                            await self._check_offender_status(person, top_match, timestamp)
        
        # === STEP 3: Pose Estimation & Concealment Detection (high frequency) ===
        if self.frame_count % self.pose_interval == 0:
            for track_id, person in self.tracked_persons.items():
                event = self.concealment_detector.process_frame(
                    frame=frame,
                    person_id=track_id,
                    frame_number=self.frame_count,
                    timestamp=timestamp,
                    person_bbox=person.bbox,
                )
                
                if event and event.confidence >= settings.CONCEALMENT_CONFIDENCE_THRESHOLD:
                    await self._handle_concealment_event(person, event, timestamp)
        
        # === STEP 4: Zone Tracking (for persons with active journeys) ===
        if self.frame_count % self.zone_check_interval == 0:
            for track_id, person in self.tracked_persons.items():
                if self.zone_tracker.get_journey(track_id):
                    self.zone_tracker.update_position(
                        track_id=track_id,
                        bbox=person.bbox,
                        frame_w=self.frame_width,
                        frame_h=self.frame_height,
                        timestamp=timestamp,
                        camera_id=self.camera_id,
                    )
        
        # Check journey timeouts periodically
        if self.frame_count % self.timeout_check_interval == 0:
            self.zone_tracker.check_timeouts(timestamp)
        
        # Clean up stale tracks
        self._cleanup_tracks(timestamp)

    def _detect_persons(self, frame: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """
        Detect persons in frame using HOG detector.
        In production, replace with YOLO or similar for better speed/accuracy.
        """
        try:
            hog = cv2.HOGDescriptor()
            hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
            
            # Resize for speed
            scale = 0.5
            small = cv2.resize(frame, None, fx=scale, fy=scale)
            
            boxes, weights = hog.detectMultiScale(
                small, winStride=(8, 8), padding=(4, 4), scale=1.05
            )
            
            # Scale back to original
            bboxes = []
            for (x, y, w, h) in boxes:
                bboxes.append((
                    int(x / scale), int(y / scale),
                    int((x + w) / scale), int((y + h) / scale)
                ))
            
            return bboxes
        except Exception:
            return []

    def _update_tracks(self, bboxes: List[Tuple], timestamp: float):
        """Simple IoU-based tracker to maintain person tracks across frames."""
        used_tracks = set()
        used_bboxes = set()
        
        # Match new bboxes to existing tracks
        for i, bbox in enumerate(bboxes):
            best_iou = 0
            best_track = None
            
            for track_id, person in self.tracked_persons.items():
                if track_id in used_tracks:
                    continue
                iou = self._compute_iou(bbox, person.bbox)
                if iou > best_iou:
                    best_iou = iou
                    best_track = track_id
            
            if best_iou > 0.3 and best_track:
                # Update existing track
                self.tracked_persons[best_track].bbox = bbox
                self.tracked_persons[best_track].last_seen = timestamp
                used_tracks.add(best_track)
                used_bboxes.add(i)
            else:
                # New track
                self._track_counter += 1
                new_id = f"track_{self._track_counter}"
                self.tracked_persons[new_id] = TrackedPerson(
                    track_id=new_id,
                    person_id=None,
                    bbox=bbox,
                    last_seen=timestamp,
                )
                used_bboxes.add(i)

    def _compute_iou(self, box1, box2) -> float:
        """Compute Intersection over Union."""
        x1 = max(box1[0], box2[0])
        y1 = max(box1[1], box2[1])
        x2 = min(box1[2], box2[2])
        y2 = min(box1[3], box2[3])
        
        intersection = max(0, x2 - x1) * max(0, y2 - y1)
        area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
        area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
        union = area1 + area2 - intersection
        
        return intersection / max(union, 1)

    async def _check_offender_status(
        self, person: TrackedPerson, face_match, timestamp: float
    ):
        """Check if matched person is a known offender and trigger alert."""
        if person.alert_sent:
            return
            
        # This would query the database - simplified here
        if self.on_alert:
            await self.on_alert(
                camera_id=self.camera_id,
                person_id=face_match.person_id,
                match_score=face_match.face_score,
                timestamp=timestamp,
            )
            person.alert_sent = True

    async def _handle_concealment_event(
        self, person: TrackedPerson, event: ConcealmentEvent, timestamp: float
    ):
        """Handle a detected concealment event — start clip capture."""
        logger.warning(
            f"CONCEALMENT DETECTED: {event.description} "
            f"(track={person.track_id}, confidence={event.confidence:.0%})"
        )
        
        # Start zone-based journey tracking for this person
        self.zone_tracker.start_journey(
            track_id=person.track_id,
            person_id=person.person_id,
            camera_id=self.camera_id,
            concealment_time=timestamp,
            concealment_description=event.description,
        )
        
        # Start capturing evidence clip
        clip = ClipCapture(
            track_id=person.track_id,
            person_id=person.person_id,
            camera_id=self.camera_id,
            start_time=timestamp - settings.CLIP_PRE_SECONDS,
            max_duration=settings.CLIP_MAX_SECONDS,
            frames=[],
            trigger_event=event,
        )
        
        # Add buffered pre-event frames
        for buffered_frame, buffered_ts in self.frame_buffer:
            if buffered_ts >= clip.start_time:
                clip.frames.append((buffered_frame, buffered_ts))
        
        self.active_clips[person.track_id] = clip
        
        # Notify incident handler
        if self.on_incident:
            await self.on_incident(
                camera_id=self.camera_id,
                track_id=person.track_id,
                person_id=person.person_id,
                event=event,
                timestamp=timestamp,
            )

    async def _update_clips(self, frame: np.ndarray, timestamp: float):
        """Add frames to active clips and finalize completed ones."""
        completed = []
        
        for track_id, clip in self.active_clips.items():
            if clip.completed:
                continue
                
            elapsed = timestamp - clip.start_time
            
            if elapsed <= clip.max_duration:
                clip.frames.append((frame.copy(), timestamp))
            else:
                clip.completed = True
                completed.append(track_id)
                
                # Save clip and notify
                if self.on_clip_ready:
                    await self.on_clip_ready(clip)
        
        for track_id in completed:
            del self.active_clips[track_id]

    def _cleanup_tracks(self, timestamp: float, timeout: float = 5.0):
        """Remove tracks not seen for `timeout` seconds."""
        stale = [
            tid for tid, p in self.tracked_persons.items()
            if timestamp - p.last_seen > timeout
        ]
        for tid in stale:
            self.concealment_detector.clear_track(tid)
            del self.tracked_persons[tid]

    async def _on_journey_classified(self, journey: PersonJourney):
        """Called by ZoneTracker when a theft/purchase determination is made."""
        logger.info(
            f"Journey classified: {journey.track_id} → "
            f"{journey.classification.value} ({journey.classification_confidence:.0%})"
        )
        
        if self.on_theft_classified:
            await self.on_theft_classified(
                track_id=journey.track_id,
                person_id=journey.person_id,
                camera_id=self.camera_id,
                classification=journey.classification,
                confidence=journey.classification_confidence,
                reason=journey.classification_reason,
                journey=journey,
            )

    def stop(self):
        """Stop the pipeline."""
        self._running = False
