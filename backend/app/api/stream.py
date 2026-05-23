"""
Stream Management API — start/stop camera AI processing and demo mode.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import asyncio

from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/stream", tags=["stream"])


class StartCameraRequest(BaseModel):
    camera_id: str


class DemoRequest(BaseModel):
    interval_seconds: int = 60  # How often to generate demo incidents
    count: Optional[int] = None  # Generate specific count (None = continuous)


@router.get("/status")
async def get_stream_status(current_user: User = Depends(get_current_user)):
    """Get status of all active camera streams and AI engine."""
    from app.services.stream_manager import StreamManager
    manager = StreamManager.get_instance()
    return manager.get_status()


@router.post("/start")
async def start_camera(
    req: StartCameraRequest,
    current_user: User = Depends(get_current_user),
):
    """Start AI processing for a specific camera."""
    if current_user.role not in ("owner", "manager"):
        raise HTTPException(403, "Only owners/managers can control camera streams")
    
    from app.services.stream_manager import StreamManager
    manager = StreamManager.get_instance()
    result = await manager.start_camera(req.camera_id)
    
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result


@router.post("/stop")
async def stop_camera(
    req: StartCameraRequest,
    current_user: User = Depends(get_current_user),
):
    """Stop AI processing for a specific camera."""
    if current_user.role not in ("owner", "manager"):
        raise HTTPException(403, "Only owners/managers can control camera streams")
    
    from app.services.stream_manager import StreamManager
    manager = StreamManager.get_instance()
    result = await manager.stop_camera(req.camera_id)
    
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result


@router.post("/start-all")
async def start_all(current_user: User = Depends(get_current_user)):
    """Start AI processing for all active, AI-enabled cameras."""
    if current_user.role not in ("owner", "manager"):
        raise HTTPException(403, "Only owners/managers can control camera streams")
    
    from app.services.stream_manager import StreamManager
    manager = StreamManager.get_instance()
    return await manager.start_all()


@router.post("/stop-all")
async def stop_all(current_user: User = Depends(get_current_user)):
    """Stop all active camera streams."""
    if current_user.role not in ("owner", "manager"):
        raise HTTPException(403, "Only owners/managers can control camera streams")
    
    from app.services.stream_manager import StreamManager
    manager = StreamManager.get_instance()
    return await manager.stop_all()


@router.post("/refresh-embeddings")
async def refresh_embeddings(current_user: User = Depends(get_current_user)):
    """Reload face embeddings cache (after new person enrolled)."""
    from app.services.stream_manager import StreamManager
    manager = StreamManager.get_instance()
    await manager.refresh_embeddings()
    return {"message": "Embeddings cache refreshed"}


# === Demo Mode ===

@router.post("/demo/generate")
async def generate_demo_incident(current_user: User = Depends(get_current_user)):
    """Generate a single demo incident for testing the review workflow."""
    from app.services.demo_simulator import demo_simulator
    result = await demo_simulator.generate_single_incident()
    if "error" in result:
        raise HTTPException(500, result["error"])
    return result


@router.post("/demo/start")
async def start_demo_mode(
    req: DemoRequest,
    current_user: User = Depends(get_current_user),
):
    """Start continuous demo mode — generates fake incidents at the given interval."""
    if current_user.role not in ("owner", "manager"):
        raise HTTPException(403, "Only owners/managers can control demo mode")
    
    from app.services.demo_simulator import demo_simulator
    
    if req.count:
        results = []
        for _ in range(req.count):
            result = await demo_simulator.generate_single_incident()
            results.append(result)
        return {"generated": len(results), "incidents": results}
    else:
        asyncio.create_task(demo_simulator.start(req.interval_seconds))
        return {"message": f"Demo mode started (interval: {req.interval_seconds}s)"}


@router.post("/demo/stop")
async def stop_demo_mode(current_user: User = Depends(get_current_user)):
    """Stop continuous demo mode."""
    from app.services.demo_simulator import demo_simulator
    await demo_simulator.stop()
    return {"message": "Demo mode stopped"}
