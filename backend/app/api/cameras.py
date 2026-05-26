"""Cameras API — manage camera feeds and zones, live snapshot proxy."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Tuple
import uuid
import asyncio
import subprocess
import time
import logging

from app.database import get_db, SessionLocal
from app.models.camera import Camera, CameraZone
from app.api.auth import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cameras", tags=["cameras"])

# ── Snapshot cache (camera_id → (jpeg_bytes, timestamp)) ──
_snapshot_cache: Dict[str, Tuple[bytes, float]] = {}
_snapshot_locks: Dict[str, asyncio.Lock] = {}
_rtsp_url_cache: Dict[str, str] = {}  # camera_id -> rtsp_url (refreshed on list/get)
_ffmpeg_semaphore: Optional[asyncio.Semaphore] = None

def _get_ffmpeg_semaphore() -> asyncio.Semaphore:
    global _ffmpeg_semaphore
    if _ffmpeg_semaphore is None:
        _ffmpeg_semaphore = asyncio.Semaphore(4)  # max 4 concurrent ffmpeg processes
    return _ffmpeg_semaphore
SNAPSHOT_TTL = 2.0  # seconds

# ── Persistent live MJPEG stream manager ──────────────────────────────
import threading

class LiveStream:
    """Manages a persistent ffmpeg process for one camera."""
    def __init__(self, camera_id: str, rtsp_url: str):
        self.camera_id = camera_id
        self.rtsp_url = rtsp_url
        self.process: Optional[subprocess.Popen] = None
        self.clients: int = 0
        self.last_frame: Optional[bytes] = None
        self.lock = threading.Lock()
        self._stop_timer: Optional[threading.Timer] = None
        self._running = False

    def start(self):
        if self._running:
            return
        self._running = True
        cmd = [
            "ffmpeg", "-rtsp_transport", "tcp",
            "-i", self.rtsp_url,
            "-f", "mjpeg",
            "-q:v", "5",
            "-r", "8",
            "-an",
            "pipe:1",
        ]
        self.process = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            bufsize=10**6,
        )
        self._reader_thread = threading.Thread(target=self._read_frames, daemon=True)
        self._reader_thread.start()

    def _read_frames(self):
        """Read JPEG frames from ffmpeg stdout."""
        buf = b""
        while self._running and self.process and self.process.poll() is None:
            chunk = self.process.stdout.read(4096)
            if not chunk:
                break
            buf += chunk
            while True:
                soi = buf.find(b'\xff\xd8')
                if soi == -1:
                    buf = b""
                    break
                eoi = buf.find(b'\xff\xd9', soi + 2)
                if eoi == -1:
                    buf = buf[soi:]
                    break
                frame = buf[soi:eoi + 2]
                with self.lock:
                    self.last_frame = frame
                buf = buf[eoi + 2:]

    def get_frame(self) -> Optional[bytes]:
        with self.lock:
            return self.last_frame

    def stop(self):
        self._running = False
        if self.process:
            try:
                self.process.kill()
                self.process.wait(timeout=3)
            except Exception:
                pass
            self.process = None


_live_streams: Dict[str, LiveStream] = {}
_live_streams_lock = threading.Lock()
_MAX_LIVE_STREAMS = 6


def _get_or_create_live_stream(camera_id: str, rtsp_url: str) -> Optional[LiveStream]:
    with _live_streams_lock:
        if camera_id in _live_streams:
            stream = _live_streams[camera_id]
            if stream._stop_timer:
                stream._stop_timer.cancel()
                stream._stop_timer = None
            stream.clients += 1
            return stream
        if len(_live_streams) >= _MAX_LIVE_STREAMS:
            for sid, s in list(_live_streams.items()):
                if s.clients <= 0:
                    s.stop()
                    del _live_streams[sid]
                    break
            if len(_live_streams) >= _MAX_LIVE_STREAMS:
                return None
        stream = LiveStream(camera_id, rtsp_url)
        stream.clients = 1
        stream.start()
        _live_streams[camera_id] = stream
        return stream


def _release_live_stream(camera_id: str):
    with _live_streams_lock:
        stream = _live_streams.get(camera_id)
        if stream:
            stream.clients = max(0, stream.clients - 1)
            if stream.clients <= 0:
                def cleanup():
                    with _live_streams_lock:
                        s = _live_streams.get(camera_id)
                        if s and s.clients <= 0:
                            s.stop()
                            del _live_streams[camera_id]
                stream._stop_timer = threading.Timer(30.0, cleanup)
                stream._stop_timer.start()



class CameraResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    rtsp_url: Optional[str]
    channel_number: Optional[int]
    is_active: bool
    is_ptz: bool
    resolution: Optional[str]
    fps: int
    ai_enabled: bool
    position_x: Optional[float]
    position_y: Optional[float]

    class Config:
        from_attributes = True


def _camera_dict(c: Camera) -> dict:
    return {
        "id": str(c.id),
        "name": c.name,
        "description": c.description,
        "rtsp_url": c.rtsp_url,
        "channel_number": c.channel_number,
        "is_active": c.is_active,
        "is_ptz": c.is_ptz,
        "resolution": c.resolution,
        "fps": c.fps,
        "ai_enabled": c.ai_enabled,
        "position_x": c.position_x,
        "position_y": c.position_y,
    }


class CameraCreate(BaseModel):
    name: str
    description: Optional[str] = None
    rtsp_url: Optional[str] = None
    channel_number: Optional[int] = None
    resolution: Optional[str] = None
    fps: int = 25
    is_ptz: bool = False
    ai_enabled: bool = True
    position_x: Optional[float] = None
    position_y: Optional[float] = None


class CameraUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    rtsp_url: Optional[str] = None
    channel_number: Optional[int] = None
    resolution: Optional[str] = None
    fps: Optional[int] = None
    is_ptz: Optional[bool] = None
    ai_enabled: Optional[bool] = None
    is_active: Optional[bool] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None


class ZoneCreate(BaseModel):
    name: str
    zone_type: str
    polygon: List[List[float]]
    detect_entry: bool = False
    detect_exit: bool = False
    detect_concealment: bool = True
    detect_loitering: bool = False
    loitering_threshold_seconds: int = 60
    product_category: Optional[str] = None
    is_high_value: bool = False


@router.get("/", response_model=List[CameraResponse])
async def list_cameras(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cameras = db.query(Camera).filter(Camera.is_active == True).all()
    result = [_camera_dict(c) for c in cameras]
    # Populate RTSP URL cache
    for c in cameras:
        if c.rtsp_url:
            _rtsp_url_cache[str(c.id)] = c.rtsp_url
    return result


@router.get("/{camera_id}", response_model=CameraResponse)
async def get_camera(
    camera_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    camera = db.query(Camera).filter(Camera.id == uuid.UUID(camera_id)).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    return _camera_dict(camera)


@router.post("/", response_model=CameraResponse)
async def create_camera(
    camera_data: CameraCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    camera = Camera(**camera_data.model_dump())
    db.add(camera)
    db.commit()
    db.refresh(camera)
    return _camera_dict(camera)


@router.put("/{camera_id}", response_model=CameraResponse)
async def update_camera(
    camera_id: str,
    camera_data: CameraUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    camera = db.query(Camera).filter(Camera.id == uuid.UUID(camera_id)).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    update_dict = camera_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(camera, key, value)
    db.commit()
    db.refresh(camera)
    return _camera_dict(camera)


@router.delete("/{camera_id}")
async def delete_camera(
    camera_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    camera = db.query(Camera).filter(Camera.id == uuid.UUID(camera_id)).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    camera.is_active = False
    db.commit()
    return {"status": "deleted", "id": camera_id}


@router.post("/{camera_id}/zones")
async def create_zone(
    camera_id: str,
    zone_data: ZoneCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    zone = CameraZone(camera_id=uuid.UUID(camera_id), **zone_data.model_dump())
    db.add(zone)
    db.commit()
    return {"id": str(zone.id), "name": zone.name, "zone_type": zone.zone_type}


@router.get("/{camera_id}/zones")
async def get_zones(
    camera_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    zones = db.query(CameraZone).filter(
        CameraZone.camera_id == uuid.UUID(camera_id)
    ).all()
    return [{
        "id": str(z.id),
        "name": z.name,
        "zone_type": z.zone_type,
        "polygon": z.polygon,
        "detect_concealment": z.detect_concealment,
        "is_high_value": z.is_high_value,
        "product_category": z.product_category,
    } for z in zones]


# ── Live snapshot / MJPEG feed ──────────────────────────────────────

async def _grab_snapshot(rtsp_url: str) -> Optional[bytes]:
    """Grab a single JPEG frame from an RTSP stream using ffmpeg."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y",
            "-rtsp_transport", "tcp",
            "-i", rtsp_url,
            "-frames:v", "1",
            "-q:v", "5",
            "-f", "image2pipe",
            "-vcodec", "mjpeg",
            "-an",
            "pipe:1",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=5)
        if proc.returncode == 0 and stdout and len(stdout) > 1000:
            return stdout
        logger.warning(f"ffmpeg snapshot failed (rc={proc.returncode}): {stderr[-200:] if stderr else 'no stderr'}")
        return None
    except asyncio.TimeoutError:
        logger.warning("ffmpeg snapshot timed out")
        try:
            proc.kill()
            await proc.wait()
        except Exception:
            pass
        return None
    except Exception as e:
        logger.error(f"Snapshot error: {e}")
        return None


async def _get_cached_snapshot(camera_id: str, rtsp_url: str) -> Optional[bytes]:
    """Get a snapshot with caching to avoid hammering the camera."""
    now = time.time()
    cached = _snapshot_cache.get(camera_id)
    if cached and (now - cached[1]) < SNAPSHOT_TTL:
        return cached[0]

    # Per-camera lock to avoid concurrent ffmpeg calls for the same camera
    if camera_id not in _snapshot_locks:
        _snapshot_locks[camera_id] = asyncio.Lock()

    async with _snapshot_locks[camera_id]:
        # Double-check after acquiring lock
        cached = _snapshot_cache.get(camera_id)
        if cached and (now - cached[1]) < SNAPSHOT_TTL:
            return cached[0]

        jpeg = await _grab_snapshot(rtsp_url)
        if jpeg:
            _snapshot_cache[camera_id] = (jpeg, time.time())
        return jpeg



def _resolve_user_from_token(token: Optional[str]) -> Optional[User]:
    """Decode a JWT token query parameter and return the User, or None."""
    if not token:
        return None
    try:
        from jose import jwt, JWTError
        from app.config import settings
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username = payload.get("sub")
        if username:
            db = SessionLocal()
            try:
                return db.query(User).filter(User.username == username).first()
            finally:
                db.close()
    except Exception:
        pass
    return None

@router.get("/{camera_id}/snapshot")
async def get_snapshot(
    camera_id: str,
    token: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Get a live JPEG snapshot from the camera — no DB session held during ffmpeg."""
    if not current_user and token:
        current_user = _resolve_user_from_token(token)
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    # Check in-memory URL cache first (no DB needed)
    rtsp_url = _rtsp_url_cache.get(camera_id)
    if not rtsp_url:
        # Quick DB lookup then release immediately
        db = SessionLocal()
        try:
            camera = db.query(Camera).filter(Camera.id == uuid.UUID(camera_id)).first()
            if not camera:
                raise HTTPException(404, "Camera not found")
            if not camera.rtsp_url:
                raise HTTPException(400, "No RTSP URL configured for this camera")
            rtsp_url = camera.rtsp_url
            _rtsp_url_cache[camera_id] = rtsp_url
        finally:
            db.close()

    # Limit concurrent ffmpeg processes
    sem = _get_ffmpeg_semaphore()
    async with sem:
        jpeg = await _get_cached_snapshot(camera_id, rtsp_url)
    if not jpeg:
        raise HTTPException(502, "Failed to capture frame from camera")

    return Response(
        content=jpeg,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
        },
    )


async def _mjpeg_generator(camera_id: str, rtsp_url: str, fps: float = 2.0):
    """Generate MJPEG stream from snapshots."""
    interval = 1.0 / fps
    while True:
        jpeg = await _get_cached_snapshot(camera_id, rtsp_url)
        if jpeg:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n"
                b"Content-Length: " + str(len(jpeg)).encode() + b"\r\n\r\n"
                + jpeg + b"\r\n"
            )
        await asyncio.sleep(interval)


async def _live_mjpeg_generator(camera_id: str, rtsp_url: str):
    """Generate MJPEG stream from persistent ffmpeg process."""
    stream = _get_or_create_live_stream(camera_id, rtsp_url)
    if not stream:
        return

    last_frame_id = None
    try:
        # Wait up to 2 seconds for first frame
        for _ in range(20):
            if stream.get_frame():
                break
            await asyncio.sleep(0.1)

        while True:
            frame = stream.get_frame()
            if frame and id(frame) != last_frame_id:
                last_frame_id = id(frame)
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(frame)).encode() + b"\r\n\r\n"
                    + frame + b"\r\n"
                )
            await asyncio.sleep(0.08)
    finally:
        _release_live_stream(camera_id)


@router.get("/{camera_id}/stream")
async def get_mjpeg_stream(
    camera_id: str,
    token: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Stream live MJPEG from the camera via persistent ffmpeg process."""
    if not current_user and token:
        current_user = _resolve_user_from_token(token)
    if not current_user:
        raise HTTPException(401, "Not authenticated")

    rtsp_url = _rtsp_url_cache.get(camera_id)
    if not rtsp_url:
        db = SessionLocal()
        try:
            camera = db.query(Camera).filter(Camera.id == uuid.UUID(camera_id)).first()
            if not camera:
                raise HTTPException(404, "Camera not found")
            if not camera.rtsp_url:
                raise HTTPException(400, "No RTSP URL configured for this camera")
            rtsp_url = camera.rtsp_url
            _rtsp_url_cache[camera_id] = rtsp_url
        finally:
            db.close()

    return StreamingResponse(
        _live_mjpeg_generator(camera_id, rtsp_url),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-cache"},
    )
