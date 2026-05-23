"""Cameras API — manage camera feeds and zones."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import uuid

from app.database import get_db
from app.models.camera import Camera, CameraZone
from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/cameras", tags=["cameras"])


class CameraResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
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
    return [{
        "id": str(c.id),
        "name": c.name,
        "description": c.description,
        "channel_number": c.channel_number,
        "is_active": c.is_active,
        "is_ptz": c.is_ptz,
        "resolution": c.resolution,
        "fps": c.fps,
        "ai_enabled": c.ai_enabled,
        "position_x": c.position_x,
        "position_y": c.position_y,
    } for c in cameras]


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
    return {
        "id": str(camera.id),
        "name": camera.name,
        "description": camera.description,
        "channel_number": camera.channel_number,
        "is_active": camera.is_active,
        "is_ptz": camera.is_ptz,
        "resolution": camera.resolution,
        "fps": camera.fps,
        "ai_enabled": camera.ai_enabled,
        "position_x": camera.position_x,
        "position_y": camera.position_y,
    }


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
