import asyncio
import cv2
import logging
import time
import os
from datetime import datetime
from typing import Dict, Optional, List
from dataclasses import dataclass

from app.config import settings
from app.database import SessionLocal

logger = logging.getLogger(__name__)


@dataclass
class CameraStream:
    camera_id: str
    camera_name: str
    rtsp_url: str
    pipeline: object  # DetectionPipeline
    task: Optional[asyncio.Task] = None
    status: str = "stopped"  # stopped, starting, running, error
    error: Optional[str] = None
    frames_processed: int = 0
    started_at: Optional[datetime] = None


class StreamManager:
    _instance = None
    
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def __init__(self):
        self.streams: Dict[str, CameraStream] = {}
        self.face_engine = None
        self.concealment_detector = None
        self.identity_matcher = None
        self.ai_available = False
        self._initialized = False
    
    async def initialize(self):
        """Initialize AI engines and load embeddings cache."""
        if self._initialized:
            return
        
        try:
            from app.ai.face_engine import FaceEngine
            from app.ai.concealment_detector import ConcealmentDetector
            from app.ai.identity_matcher import IdentityMatcher
            
            self.face_engine = FaceEngine(
                model=settings.FACE_RECOGNITION_MODEL,
                tolerance=settings.FACE_MATCH_TOLERANCE,
            )
            self.concealment_detector = ConcealmentDetector(
                confidence_threshold=settings.CONCEALMENT_CONFIDENCE_THRESHOLD,
            )
            self.identity_matcher = IdentityMatcher(
                face_weight=settings.FACE_MATCH_WEIGHT,
                body_weight=settings.BODY_MATCH_WEIGHT,
                gait_weight=settings.GAIT_MATCH_WEIGHT,
                height_weight=settings.HEIGHT_MATCH_WEIGHT,
                marks_weight=settings.MARKS_MATCH_WEIGHT,
                composite_threshold=settings.COMPOSITE_MATCH_THRESHOLD,
            )
            
            await self.face_engine.initialize()
            await self.concealment_detector.initialize()
            
            # Load face embeddings from database
            await self._load_embeddings()
            
            self.ai_available = True
            self._initialized = True
            logger.info("StreamManager initialized — AI engines ready")
            
        except ImportError as e:
            logger.warning(f"AI dependencies not available: {e}. Running in API-only mode.")
            self.ai_available = False
            self._initialized = True
        except Exception as e:
            logger.error(f"AI initialization error: {e}")
            self.ai_available = False
            self._initialized = True
    
    async def _load_embeddings(self):
        """Load all face embeddings from DB into FaceEngine cache."""
        if not self.face_engine:
            return
        try:
            from app.models.person import FaceEmbedding
            db = SessionLocal()
            embeddings = db.query(FaceEmbedding).all()
            data = [{
                "person_id": str(e.person_id),
                "embedding_id": str(e.id),
                "embedding": e.embedding,
                "quality_score": e.quality_score or 0.5,
            } for e in embeddings]
            self.face_engine.load_embeddings_cache(data)
            db.close()
            logger.info(f"Loaded {len(data)} face embeddings into cache")
        except Exception as e:
            logger.error(f"Failed to load embeddings: {e}")
    
    async def refresh_embeddings(self):
        """Reload embeddings (call after new person enrolled)."""
        await self._load_embeddings()
    
    def _build_rtsp_url(self, camera) -> str:
        """Build RTSP URL for a camera."""
        if camera.rtsp_url:
            return camera.rtsp_url
        # Build from NVR settings + channel number
        username = settings.NVR_USERNAME or ""
        password = settings.NVR_PASSWORD or ""
        host = settings.NVR_IP or "localhost"
        port = settings.NVR_PORT or 554
        channel = camera.channel_number or 1
        return f"rtsp://{username}:{password}@{host}:{port}/unicast/c{channel}/s0/live"
    
    async def start_camera(self, camera_id: str) -> dict:
        """Start AI processing for a specific camera."""
        if not self.ai_available:
            return {"error": "AI engines not available", "status": "unavailable"}
        
        if camera_id in self.streams and self.streams[camera_id].status == "running":
            return {"error": "Camera already running", "status": "running"}
        
        # Get camera from DB
        from app.models.camera import Camera
        db = SessionLocal()
        camera = db.query(Camera).filter(Camera.id == camera_id).first()
        if not camera:
            db.close()
            return {"error": "Camera not found"}
        
        if not camera.ai_enabled:
            db.close()
            return {"error": "AI not enabled for this camera"}
        
        rtsp_url = self._build_rtsp_url(camera)
        db.close()
        
        # Create pipeline with callbacks
        from app.ai.detection_pipeline import DetectionPipeline
        
        pipeline = DetectionPipeline(
            camera_id=str(camera.id),
            face_engine=self.face_engine,
            concealment_detector=self.concealment_detector,
            identity_matcher=self.identity_matcher,
            on_alert_callback=self._on_alert,
            on_incident_callback=self._on_incident,
            on_clip_ready_callback=self._on_clip_ready,
        )
        
        stream = CameraStream(
            camera_id=str(camera.id),
            camera_name=camera.name,
            rtsp_url=rtsp_url,
            pipeline=pipeline,
            status="starting",
            started_at=datetime.utcnow(),
        )
        
        self.streams[str(camera.id)] = stream
        
        # Start pipeline in background task
        stream.task = asyncio.create_task(self._run_pipeline(stream))
        
        return {
            "camera_id": str(camera.id),
            "camera_name": camera.name,
            "status": "starting",
            "rtsp_url": rtsp_url.replace(settings.NVR_PASSWORD or "", "***"),
        }
    
    async def _run_pipeline(self, stream: CameraStream):
        """Run a detection pipeline (runs in background task)."""
        try:
            stream.status = "running"
            logger.info(f"Pipeline started for camera {stream.camera_name} ({stream.camera_id})")
            await stream.pipeline.start(stream.rtsp_url)
        except Exception as e:
            stream.status = "error"
            stream.error = str(e)
            logger.error(f"Pipeline error for {stream.camera_name}: {e}")
        finally:
            if stream.status != "error":
                stream.status = "stopped"
    
    async def stop_camera(self, camera_id: str) -> dict:
        """Stop AI processing for a specific camera."""
        if camera_id not in self.streams:
            return {"error": "Camera not active"}
        
        stream = self.streams[camera_id]
        stream.pipeline.stop()
        
        if stream.task and not stream.task.done():
            stream.task.cancel()
        
        stream.status = "stopped"
        del self.streams[camera_id]
        
        return {"camera_id": camera_id, "status": "stopped"}
    
    async def start_all(self) -> dict:
        """Start AI processing for all AI-enabled cameras."""
        from app.models.camera import Camera
        db = SessionLocal()
        cameras = db.query(Camera).filter(
            Camera.is_active == True,
            Camera.ai_enabled == True,
        ).all()
        db.close()
        
        results = []
        for cam in cameras:
            result = await self.start_camera(str(cam.id))
            results.append(result)
        
        return {"started": len(results), "results": results}
    
    async def stop_all(self) -> dict:
        """Stop all active pipelines."""
        camera_ids = list(self.streams.keys())
        for cid in camera_ids:
            await self.stop_camera(cid)
        return {"stopped": len(camera_ids)}
    
    def get_status(self) -> dict:
        """Get status of all streams."""
        return {
            "ai_available": self.ai_available,
            "active_streams": len(self.streams),
            "streams": {
                cid: {
                    "camera_name": s.camera_name,
                    "status": s.status,
                    "frames_processed": s.pipeline.frame_count if s.pipeline else 0,
                    "tracked_persons": len(s.pipeline.tracked_persons) if s.pipeline else 0,
                    "active_clips": len(s.pipeline.active_clips) if s.pipeline else 0,
                    "started_at": s.started_at.isoformat() if s.started_at else None,
                    "error": s.error,
                }
                for cid, s in self.streams.items()
            },
            "face_cache": {
                "persons": self.face_engine.persons_in_cache if self.face_engine else 0,
                "embeddings": self.face_engine.cache_size if self.face_engine else 0,
            }
        }
    
    # === Pipeline Callbacks ===
    
    async def _on_alert(self, camera_id: str, person_id: str, match_score: float, timestamp: float):
        """Called when a known offender/blacklisted person is detected."""
        try:
            from app.models.person import Person, PersonStatus
            from app.models.alert import Alert, AlertType, AlertPriority, AlertStatus
            from app.models.incident import Incident
            from app.api.alerts import alert_manager
            import uuid
            
            db = SessionLocal()
            person = db.query(Person).filter(Person.id == uuid.UUID(person_id)).first()
            if not person:
                db.close()
                return
            
            # Only alert for confirmed thieves and blacklisted
            if person.status not in (PersonStatus.CONFIRMED_THIEF, PersonStatus.BLACKLISTED):
                db.close()
                return
            
            # Determine alert type
            if person.status == PersonStatus.BLACKLISTED:
                alert_type = AlertType.BLACKLISTED_ENTERED
                priority = AlertPriority.CRITICAL
                title = f"⛔ BLACKLISTED PERSON DETECTED"
                message = (
                    f"{person.display_name or 'Unknown'} entered the store. "
                    f"BLACKLISTED — {person.total_confirmed_thefts} prior thefts."
                )
            else:
                alert_type = AlertType.KNOWN_THIEF_ENTERED
                priority = AlertPriority.HIGH
                title = f"⚠️ KNOWN THIEF DETECTED"
                message = (
                    f"{person.display_name or 'Unknown'} entered the store. "
                    f"{person.total_confirmed_thefts} confirmed thefts."
                )
            
            # Get reference clip from latest theft
            latest_theft = db.query(Incident).filter(
                Incident.person_id == person.id,
                Incident.review_status == "theft",
            ).order_by(Incident.detected_at.desc()).first()
            
            ref_clip_url = None
            ref_incident_id = None
            if latest_theft and latest_theft.clips:
                ref_clip_url = latest_theft.clips[0].clip_url
                ref_incident_id = latest_theft.id
            
            alert = Alert(
                person_id=person.id,
                alert_type=alert_type,
                priority=priority,
                title=title,
                message=message,
                camera_id=uuid.UUID(camera_id),
                current_camera_id=uuid.UUID(camera_id),
                tracking_active=True,
                reference_incident_id=ref_incident_id,
                reference_clip_url=ref_clip_url,
                match_confidence=match_score,
                current_snapshot_path=person.best_portrait_path,
            )
            db.add(alert)
            db.commit()
            db.refresh(alert)
            
            # Push via WebSocket
            await alert_manager.broadcast_alert({
                "type": "new_alert",
                "alert": {
                    "id": str(alert.id),
                    "alert_type": alert_type.value,
                    "priority": priority.value,
                    "title": title,
                    "message": message,
                    "person_id": str(person.id),
                    "person_name": person.display_name,
                    "person_status": person.status.value,
                    "threat_level": person.threat_level,
                    "total_thefts": person.total_confirmed_thefts,
                    "portrait_path": person.best_portrait_path,
                    "reference_clip_url": ref_clip_url,
                    "match_confidence": match_score,
                    "tracking_active": True,
                }
            })
            
            # Record sighting
            from app.models.person import PersonSighting
            sighting = PersonSighting(
                person_id=person.id,
                camera_id=uuid.UUID(camera_id),
                match_confidence=match_score,
                face_match_score=match_score,
                entered_at=datetime.utcfromtimestamp(timestamp),
            )
            db.add(sighting)
            person.total_visits += 1
            person.last_seen = datetime.utcfromtimestamp(timestamp)
            db.commit()
            db.close()
            
            logger.warning(f"ALERT: {title} — {person.display_name} (camera: {camera_id})")
            
        except Exception as e:
            logger.error(f"Alert callback error: {e}", exc_info=True)
    
    async def _on_incident(self, camera_id: str, track_id: str, person_id: Optional[str],
                           event, timestamp: float):
        """Called when concealment is detected."""
        try:
            from app.models.incident import Incident, IncidentType, IncidentSeverity, ReviewStatus
            from app.models.person import Person, PersonStatus
            from app.api.alerts import alert_manager
            import uuid
            
            db = SessionLocal()
            
            # Map concealment type to incident type
            incident_type = IncidentType.CONCEALMENT
            
            # Determine severity
            severity = IncidentSeverity.MEDIUM
            if person_id:
                person = db.query(Person).filter(Person.id == uuid.UUID(person_id)).first()
                if person and person.status in (PersonStatus.CONFIRMED_THIEF, PersonStatus.BLACKLISTED):
                    severity = IncidentSeverity.CRITICAL
                elif person and person.status == PersonStatus.SUSPECTED_THIEF:
                    severity = IncidentSeverity.HIGH
            
            if event.confidence >= 0.9:
                severity = max(severity, IncidentSeverity.HIGH, key=lambda s: ["low","medium","high","critical"].index(s.value))
            
            incident = Incident(
                person_id=uuid.UUID(person_id) if person_id else None,
                incident_type=incident_type,
                severity=severity,
                review_status=ReviewStatus.PENDING,
                camera_id=uuid.UUID(camera_id),
                detected_at=datetime.utcfromtimestamp(timestamp),
                ai_confidence=event.confidence,
                ai_description=event.description,
                zone_name=None,
                detection_details={
                    "concealment_type": event.concealment_type.value if event.concealment_type else None,
                    "hand_used": event.hand_used,
                    "shelf_interaction": event.shelf_interaction,
                    "item_before": event.item_detected_before,
                    "item_after": event.item_detected_after,
                    "signals": event.details,
                    "start_frame": event.start_frame,
                    "end_frame": event.end_frame,
                },
            )
            db.add(incident)
            db.commit()
            db.refresh(incident)
            
            # Store incident_id on the stream for clip association
            if camera_id in self.streams:
                self.streams[camera_id]._current_incident_id = str(incident.id)
            
            # Push real-time notification
            await alert_manager.broadcast_alert({
                "type": "new_incident",
                "incident": {
                    "id": str(incident.id),
                    "incident_type": incident_type.value,
                    "severity": severity.value,
                    "ai_confidence": event.confidence,
                    "ai_description": event.description,
                    "camera_id": camera_id,
                    "person_id": person_id,
                    "detected_at": incident.detected_at.isoformat(),
                }
            })
            
            db.close()
            logger.warning(f"INCIDENT: Concealment detected (confidence: {event.confidence:.0%}, camera: {camera_id})")
            
        except Exception as e:
            logger.error(f"Incident callback error: {e}", exc_info=True)
    
    async def _on_clip_ready(self, clip):
        """Called when evidence clip capture is complete."""
        try:
            import uuid
            from app.models.incident import IncidentClip, Incident
            
            # Save frames as MP4
            if not clip.frames:
                return
            
            clip_dir = settings.LOCAL_CLIP_DIR
            os.makedirs(clip_dir, exist_ok=True)
            
            timestamp_str = datetime.utcfromtimestamp(clip.start_time).strftime("%Y%m%d_%H%M%S")
            filename = f"{clip.camera_id}_{timestamp_str}.mp4"
            filepath = os.path.join(clip_dir, filename)
            
            # Write frames to video file
            first_frame = clip.frames[0][0]
            h, w = first_frame.shape[:2]
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            fps = 25.0
            writer = cv2.VideoWriter(filepath, fourcc, fps, (w, h))
            
            for frame, ts in clip.frames:
                writer.write(frame)
            writer.release()
            
            # Generate thumbnail from key frame
            thumb_filename = f"{clip.camera_id}_{timestamp_str}_thumb.jpg"
            thumb_path = os.path.join(clip_dir, thumb_filename)
            key_idx = len(clip.frames) // 3  # ~1/3 into clip (around the event)
            cv2.imwrite(thumb_path, clip.frames[key_idx][0])
            
            # Find or create incident clip record
            db = SessionLocal()
            
            # Find the most recent pending incident for this camera
            incident = db.query(Incident).filter(
                Incident.camera_id == uuid.UUID(clip.camera_id),
                Incident.review_status == "pending",
            ).order_by(Incident.created_at.desc()).first()
            
            if incident:
                clip_record = IncidentClip(
                    incident_id=incident.id,
                    camera_id=uuid.UUID(clip.camera_id),
                    clip_path=filepath,
                    clip_url=f"/api/clips/{filename}",
                    thumbnail_path=f"/api/clips/{thumb_filename}",
                    start_time=datetime.utcfromtimestamp(clip.start_time),
                    end_time=datetime.utcfromtimestamp(clip.frames[-1][1]),
                    duration_seconds=clip.frames[-1][1] - clip.start_time,
                    key_moment_offset=clip.trigger_event.start_time - clip.start_time if clip.trigger_event else None,
                    file_size_bytes=os.path.getsize(filepath),
                )
                db.add(clip_record)
                db.commit()
                logger.info(f"Clip saved: {filepath} ({len(clip.frames)} frames, linked to incident {incident.id})")
            
            db.close()
            
        except Exception as e:
            logger.error(f"Clip save error: {e}", exc_info=True)
