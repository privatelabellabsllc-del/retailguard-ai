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
import os
import cv2
import numpy as np
import logging
import time

# Configure FFMPEG capture options BEFORE any VideoCapture is created:
# TCP transport (ngrok tunnels drop UDP), 5s socket timeout so a dead
# stream fails fast instead of hanging forever.
os.environ.setdefault(
    "OPENCV_FFMPEG_CAPTURE_OPTIONS",
    "rtsp_transport;tcp|stimeout;5000000|max_delay;500000"
)
from typing import Optional, Dict, List, Tuple
from datetime import datetime, timedelta
from collections import deque
from dataclasses import dataclass

from app.ai.face_engine import FaceEngine, FaceDetection
from app.ai.concealment_detector import ConcealmentDetector, ConcealmentEvent
from app.ai.identity_matcher import IdentityMatcher, IdentityMatch
from app.ai.zone_tracker import ZoneTracker, ZoneDefinition, ZoneType, TheftClassification, PersonJourney
from app.ai.behavior_analyzer import BehaviorAnalyzer
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
    # k-of-n consistency: recent person_id match results (None = no match)
    match_history: List[Optional[str]] = None
    
    def __post_init__(self):
        if self.face_detections is None:
            self.face_detections = []
        if self.match_history is None:
            self.match_history = []


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
        on_face_sample_callback=None,  # Called with good-quality face samples for enrollment
    ):
        self.camera_id = camera_id
        self.face_engine = face_engine
        self.concealment_detector = concealment_detector
        self.identity_matcher = identity_matcher
        self.zone_tracker = zone_tracker or ZoneTracker(
            retrieval_confidence_boost=getattr(settings, "RETRIEVAL_CONFIDENCE_BOOST", 0.35),
            behavior_weight=getattr(settings, "BEHAVIOR_WEIGHT", 0.15),
        )

        # Behavioral suspicion scoring (loitering, repeat passes, head
        # scanning, grab-and-run). Context only — never fires incidents alone.
        self.behavior_analyzer = BehaviorAnalyzer(
            loiter_seconds=getattr(settings, "LOITER_SECONDS", 120.0),
            repeat_zone_threshold=getattr(settings, "REPEAT_ZONE_THRESHOLD", 3),
        )
        
        self.on_alert = on_alert_callback
        self.on_incident = on_incident_callback
        self.on_clip_ready = on_clip_ready_callback
        self.on_theft_classified = on_theft_classified_callback
        self.on_face_sample = on_face_sample_callback
        
        # Wire up zone tracker callback
        self.zone_tracker.on_theft_classified = self._on_journey_classified
        
        # Tracking state
        self.tracked_persons: Dict[str, TrackedPerson] = {}
        self.active_clips: Dict[str, ClipCapture] = {}
        self.frame_count = 0          # ANALYZED frame counter
        self.fps = 0                  # Source stream FPS
        self.analyze_fps = getattr(settings, "ANALYZE_FPS", 5.0)
        self.analyze_width = getattr(settings, "ANALYZE_WIDTH", 960)
        self.frame_width = 0
        self.frame_height = 0
        
        # Frame buffer for pre-event recording — sized for the ANALYSIS rate,
        # since only analyzed (downscaled) frames are buffered
        buf_len = max(1, int(settings.CLIP_PRE_SECONDS * self.analyze_fps) + 2)
        self.frame_buffer: deque = deque(maxlen=buf_len)
        
        # Processing intervals in ANALYZED frames (~5 fps analysis rate)
        self.face_detect_interval = 2      # Face detection every 2 analyzed frames
        self.identity_match_interval = 2   # Identity matching alongside detection
        self.pose_interval = 1             # Pose every analyzed frame (critical for concealment)
        self.zone_check_interval = 1       # Zone positions every analyzed frame
        self.timeout_check_interval = 25   # Journey timeouts every ~5s at 5fps
        
        # False-positive controls
        self.match_consecutive_required = getattr(settings, "FACE_MATCH_CONSECUTIVE", 3)
        self.alert_cooldown_seconds = getattr(settings, "ALERT_COOLDOWN_SECONDS", 600)
        self._alert_last_sent: Dict[str, float] = {}   # person_id -> last alert ts
        self._last_face_sample: Dict[str, float] = {}  # person_id -> last enrollment sample ts
        
        # HOG person detector — construct ONCE (was rebuilt every frame)
        self._hog = cv2.HOGDescriptor()
        self._hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
        
        self._running = False
        self._track_counter = 0

    def _open_capture(self, rtsp_url: str) -> Optional[cv2.VideoCapture]:
        """Open an RTSP capture with FFMPEG backend, TCP transport and timeouts."""
        cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
        # Newer OpenCV builds support explicit open/read timeouts
        for prop, ms in (("CAP_PROP_OPEN_TIMEOUT_MSEC", 8000), ("CAP_PROP_READ_TIMEOUT_MSEC", 8000)):
            prop_id = getattr(cv2, prop, None)
            if prop_id is not None:
                try:
                    cap.set(prop_id, ms)
                except Exception:
                    pass
        try:
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)
        except Exception:
            pass
        if not cap.isOpened():
            cap.release()
            return None
        return cap

    async def start(self, rtsp_url: str):
        """
        Start processing a camera stream.
        Robustness:
        - Auto-reconnect with exponential backoff (ngrok tunnels drop often)
        - All blocking cv2 reads run in a worker thread (never block the event loop)
        - Frames are subsampled to ~ANALYZE_FPS and downscaled to ANALYZE_WIDTH
          before AI (source is 4K — full-rate/full-res analysis is infeasible)
        """
        logger.info(f"Starting detection pipeline for camera {self.camera_id}")
        self._running = True
        max_backoff = getattr(settings, "RTSP_RECONNECT_MAX_BACKOFF", 60.0)
        backoff = 1.0
        cap = None

        try:
            while self._running:
                # === (Re)connect with exponential backoff ===
                if cap is None:
                    cap = await asyncio.to_thread(self._open_capture, rtsp_url)
                    if cap is None:
                        logger.warning(
                            f"Camera {self.camera_id}: stream unavailable, "
                            f"retrying in {backoff:.0f}s"
                        )
                        await asyncio.sleep(backoff)
                        backoff = min(backoff * 2, max_backoff)
                        continue
                    backoff = 1.0
                    src_fps = cap.get(cv2.CAP_PROP_FPS)
                    if not src_fps or src_fps <= 0 or src_fps > 120:
                        src_fps = 25.0
                    self.fps = src_fps
                    frame_skip = max(1, round(src_fps / self.analyze_fps))
                    raw_counter = 0
                    consecutive_failures = 0
                    logger.info(
                        f"Camera {self.camera_id}: connected @ {src_fps:.0f}fps, "
                        f"analyzing every {frame_skip} frame(s)"
                    )

                raw_counter += 1

                # Skip frames cheaply with grab() — only decode analysis frames
                if raw_counter % frame_skip != 0:
                    ok = await asyncio.to_thread(cap.grab)
                    if not ok:
                        consecutive_failures += 1
                        if consecutive_failures >= 25:
                            logger.warning(f"Camera {self.camera_id}: stream dropped, reconnecting...")
                            cap.release()
                            cap = None
                        continue
                    consecutive_failures = 0
                    continue

                ret, frame = await asyncio.to_thread(cap.read)
                if not ret or frame is None:
                    consecutive_failures += 1
                    if consecutive_failures >= 25:
                        logger.warning(f"Camera {self.camera_id}: stream dropped, reconnecting...")
                        cap.release()
                        cap = None
                    else:
                        await asyncio.sleep(0.05)
                    continue
                consecutive_failures = 0

                # Downscale before AI (e.g. 3840px -> 960px wide)
                h, w = frame.shape[:2]
                if w > self.analyze_width:
                    scale = self.analyze_width / w
                    frame = cv2.resize(
                        frame, (self.analyze_width, max(1, int(h * scale))),
                        interpolation=cv2.INTER_AREA,
                    )

                timestamp = time.time()
                self.frame_count += 1

                # Store frame in buffer (for pre-event clips)
                self.frame_buffer.append((frame.copy(), timestamp))

                # Track frame dimensions for zone calculations
                if self.frame_height == 0:
                    self.frame_height, self.frame_width = frame.shape[:2]

                # Process frame — one bad frame must never kill the pipeline
                try:
                    await self._process_frame(frame, timestamp)
                except Exception:
                    logger.exception(f"Camera {self.camera_id}: frame processing error (continuing)")

                # Update active clip captures
                await self._update_clips(frame, timestamp)

                # Yield to event loop
                await asyncio.sleep(0)

        except asyncio.CancelledError:
            logger.info(f"Pipeline for camera {self.camera_id} cancelled")
            raise
        except Exception as e:
            logger.error(f"Pipeline error: {e}", exc_info=True)
        finally:
            if cap is not None:
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
                        
                        matched_id = face_matches[0].person_id if face_matches else None
                        
                        # k-of-n consistency: require the SAME person matched in
                        # N consecutive samples before accepting the identity —
                        # a single-frame match is not enough to fire an alert.
                        person.match_history.append(matched_id)
                        if len(person.match_history) > self.match_consecutive_required:
                            person.match_history.pop(0)
                        
                        if face_matches:
                            top_match = face_matches[0]
                            consistent = (
                                len(person.match_history) >= self.match_consecutive_required
                                and all(m == matched_id for m in person.match_history)
                            )
                            
                            if consistent:
                                person.person_id = top_match.person_id
                                
                                # Multi-sample enrollment: feed good-quality face
                                # samples back for persistence (DB + cache), at
                                # most one sample per person per 30s
                                if (
                                    self.on_face_sample
                                    and best_face.quality_score >= 0.6
                                    and timestamp - self._last_face_sample.get(top_match.person_id, 0) > 30
                                ):
                                    self._last_face_sample[top_match.person_id] = timestamp
                                    try:
                                        await self.on_face_sample(
                                            person_id=top_match.person_id,
                                            embedding=best_face.embedding,
                                            quality=best_face.quality_score,
                                            angle=best_face.angle,
                                            camera_id=self.camera_id,
                                        )
                                    except Exception:
                                        logger.exception("Face sample enrollment failed")
                                
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
                journey = self.zone_tracker.get_journey(track_id)
                if journey:
                    self.zone_tracker.update_position(
                        track_id=track_id,
                        bbox=person.bbox,
                        frame_w=self.frame_width,
                        frame_h=self.frame_height,
                        timestamp=timestamp,
                        camera_id=self.camera_id,
                    )

        # === STEP 5: Behavior analysis + register retrieval detection ===
        if self.frame_count % self.zone_check_interval == 0:
            self._update_behavior_and_retrieval(timestamp)

        # Check journey timeouts periodically
        if self.frame_count % self.timeout_check_interval == 0:
            self.zone_tracker.check_timeouts(timestamp)
        
        # Clean up stale tracks
        self._cleanup_tracks(timestamp)

    def _update_behavior_and_retrieval(self, timestamp: float):
        """
        Per-frame behavioral intelligence:
        1. Feed every tracked person's current zone + pose to the
           BehaviorAnalyzer (loitering / repeat passes / head-scanning run for
           ALL shoppers, since suspicious behavior starts before concealment).
        2. For persons with an active journey standing in a REGISTER zone,
           run item-RETRIEVAL detection (pocket → counter, the reverse of
           concealment). A retrieval flips the journey strongly toward PAID.
        3. Keep each journey's behavior score/signals current so they are
           fused into the classification the moment it is decided.
        """
        for track_id, person in self.tracked_persons.items():
            # --- Zone observation (all tracked persons) ---
            zone = None
            try:
                zone = self.zone_tracker.zone_at(
                    person.bbox, self.frame_width, self.frame_height, self.camera_id
                )
            except Exception:
                pass
            self.behavior_analyzer.observe_zone(
                track_id,
                zone.zone_id if zone else None,
                zone.zone_type.value if zone else None,
                timestamp,
            )
            if zone and zone.zone_type == ZoneType.EXIT:
                self.behavior_analyzer.note_exit(track_id, timestamp)

            # --- Head-scanning from pose landmarks (graceful if absent) ---
            try:
                keypoints = self.concealment_detector.get_latest_pose(track_id)
            except Exception:
                keypoints = None
            if keypoints:
                self.behavior_analyzer.observe_pose(track_id, keypoints, timestamp)

            # --- Journey enrichment + retrieval at register ---
            journey = self.zone_tracker.get_journey(track_id)
            if journey is None:
                continue

            score, signals = self.behavior_analyzer.compute(track_id, now=timestamp)
            self.zone_tracker.set_behavior(track_id, score, signals)

            if (
                zone is not None
                and zone.zone_type == ZoneType.REGISTER
                and not journey.retrieval_detected
            ):
                try:
                    retrieval = self.concealment_detector.detect_retrieval(
                        track_id, timestamp
                    )
                except Exception:
                    logger.exception("Retrieval detection error (continuing)")
                    retrieval = None
                if retrieval:
                    logger.info(
                        f"Retrieval gesture at register: {retrieval.description}"
                    )
                    self.zone_tracker.record_retrieval(
                        track_id, timestamp, retrieval.confidence
                    )

    def _detect_persons(self, frame: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """
        Detect persons in frame using HOG detector.
        In production, replace with YOLO or similar for better speed/accuracy.
        """
        try:
            # Reuse the detector built in __init__ (rebuilding per-frame was slow)
            hog = self._hog
            
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
        
        # Global per-person alert cooldown — never spam the clerk with repeat
        # alerts for the same person within the cooldown window (default 10 min),
        # even across different tracks/re-entries.
        last_sent = self._alert_last_sent.get(face_match.person_id, 0.0)
        if timestamp - last_sent < self.alert_cooldown_seconds:
            person.alert_sent = True  # Suppress further attempts on this track
            return
        
        # StreamManager._on_alert checks person status (offender/blacklisted) in DB
        if self.on_alert:
            await self.on_alert(
                camera_id=self.camera_id,
                person_id=face_match.person_id,
                match_score=face_match.face_score,
                timestamp=timestamp,
            )
            person.alert_sent = True
            self._alert_last_sent[face_match.person_id] = timestamp

    async def _handle_concealment_event(
        self, person: TrackedPerson, event: ConcealmentEvent, timestamp: float
    ):
        """Handle a detected concealment event — start clip capture."""
        # Dedup: if this track already has an evidence clip in progress, don't
        # restart it (would lose frames) or double-create incidents.
        if person.track_id in self.active_clips:
            return
        
        logger.warning(
            f"CONCEALMENT DETECTED: {event.description} "
            f"(track={person.track_id}, confidence={event.confidence:.0%})"
        )
        
        # Feed behavior analyzer (enables grab-and-run signal)
        self.behavior_analyzer.note_concealment(person.track_id, timestamp)

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
            self.behavior_analyzer.clear_track(tid)
            del self.tracked_persons[tid]

    async def _on_journey_classified(self, journey: PersonJourney):
        """Called by ZoneTracker when a theft/purchase determination is made."""
        logger.info(
            f"Journey classified: {journey.track_id} → "
            f"{journey.classification.value} ({journey.classification_confidence:.0%})"
        )
        
        # For theft-side classifications, finalize the evidence clip NOW so it
        # covers everything up to the exit and attaches to the incident
        # immediately (instead of waiting for the max-duration timer).
        if journey.classification in (
            TheftClassification.LIKELY_THEFT,
            TheftClassification.PARTIAL_THEFT,
            TheftClassification.GRAB_AND_RUN,
        ):
            await self._finalize_clip(journey.track_id)
        
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

    async def _finalize_clip(self, track_id: str):
        """
        Immediately complete and hand off an in-progress evidence clip for a
        track (e.g. the moment a theft classification lands at the exit).
        Safe no-op if there is no active clip for the track.
        """
        clip = self.active_clips.get(track_id)
        if clip is None or clip.completed:
            return
        clip.completed = True
        self.active_clips.pop(track_id, None)
        if clip.frames and self.on_clip_ready:
            try:
                await self.on_clip_ready(clip)
            except Exception:
                logger.exception("Clip finalize handoff failed")

    def stop(self):
        """Stop the pipeline."""
        self._running = False
