"""
Clips API — serve video clips and thumbnails for the review queue.
"""
import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.config import settings

router = APIRouter(prefix="/api/clips", tags=["clips"])


@router.get("/{filename}")
async def serve_clip(filename: str):
    """Serve a video clip or thumbnail file."""
    # Sanitize filename
    safe_name = os.path.basename(filename)
    filepath = os.path.join(settings.LOCAL_CLIP_DIR, safe_name)
    
    if not os.path.exists(filepath):
        raise HTTPException(404, "Clip not found")
    
    # Determine content type
    if filepath.endswith(".mp4"):
        media_type = "video/mp4"
    elif filepath.endswith(".jpg") or filepath.endswith(".jpeg"):
        media_type = "image/jpeg"
    elif filepath.endswith(".png"):
        media_type = "image/png"
    else:
        media_type = "application/octet-stream"
    
    return FileResponse(filepath, media_type=media_type)
