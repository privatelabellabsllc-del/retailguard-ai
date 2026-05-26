"""Cameras API — manage camera feeds and zones, live snapshot proxy."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Tuple
import uuid
import asyncio
import subprocess
import time
import logging

from app.database import get_db
from app.models.camera import Camera, CameraZone
from app.api.auth import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cameras", tags=["cameras"])

# ── Snapshot cache (camera_id → (jpeg_bytes, timestamp)) ──
_snapshot_cache: Dict[str, Tuple[bytes, float]] = {}
_snapshot_locks: Dict[str, asyncio.Lock] = {}
SNAPSHOT_TTL = 2.0  # seconds


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
    return [_camera_dict(c) for c in cameras]


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


@router.get("/{camera_id}/snapshot")
async def get_snapshot(
    camera_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a live JPEG snapshot from the camera."""
    camera = db.query(Camera).filter(Camera.id == uuid.UUID(camera_id)).first()
    if not camera:
        raise HTTPException(404, "Camera not found")
    if not camera.rtsp_url:
        raise HTTPException(400, "No RTSP URL configured for this camera")

    jpeg = await _get_cached_snapshot(str(camera.id), camera.rtsp_url)
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


@router.get("/{camera_id}/stream")
async def get_mjpeg_stream(
    camera_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream live MJPEG from the camera (for <img> tag)."""
    camera = db.query(Camera).filter(Camera.id == uuid.UUID(camera_id)).first()
    if not camera:
        raise HTTPException(404, "Camera not found")
    if not camera.rtsp_url:
        raise HTTPException(400, "No RTSP URL configured for this camera")

    return StreamingResponse(
        _mjpeg_generator(str(camera.id), camera.rtsp_url, fps=1.5),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-cache"},
    )
