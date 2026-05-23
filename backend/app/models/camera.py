"""
Camera and zone models — maps your Uniview Tec camera system.
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime, Text,
    ForeignKey, JSON, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Camera(Base):
    """A physical camera connected to the NVR."""
    __tablename__ = "cameras"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=True)
    
    name = Column(String(100), nullable=False)  # "Front Door Cam", "Aisle 3"
    description = Column(Text, nullable=True)
    
    # Connection
    rtsp_url = Column(String(500), nullable=True)  # RTSP stream URL
    channel_number = Column(Integer, nullable=True)  # NVR channel
    is_active = Column(Boolean, default=True)
    is_ptz = Column(Boolean, default=False)  # Can pan/tilt/zoom
    
    # Capabilities
    resolution = Column(String(20), nullable=True)  # "2560x1440"
    fps = Column(Integer, default=25)
    has_audio = Column(Boolean, default=False)
    has_ir = Column(Boolean, default=True)  # Infrared/night vision
    
    # Position in store
    position_x = Column(Float, nullable=True)  # For store map overlay
    position_y = Column(Float, nullable=True)
    viewing_angle = Column(Float, nullable=True)  # Degrees
    
    # AI Processing
    ai_enabled = Column(Boolean, default=True)  # Process with AI pipeline
    detection_zones = Column(JSON, nullable=True)  # Polygons defining monitored areas
    
    # Calibration (for height estimation)
    calibration_data = Column(JSON, nullable=True)
    # {
    #   "reference_height_cm": 175,
    #   "reference_pixels": 450,
    #   "floor_plane": [[x1,y1], [x2,y2], [x3,y3], [x4,y4]],
    #   "camera_height_cm": 300
    # }
    
    # Customer-facing display (for showing theft video to thief)
    is_display_screen = Column(Boolean, default=False)
    display_target_camera_id = Column(UUID(as_uuid=True), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    zones = relationship("CameraZone", back_populates="camera", cascade="all, delete-orphan")
    location = relationship("Location", back_populates="cameras")


class CameraZone(Base):
    """Defined zones within a camera's view for targeted monitoring."""
    __tablename__ = "camera_zones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    camera_id = Column(UUID(as_uuid=True), ForeignKey("cameras.id"), nullable=False, index=True)
    
    name = Column(String(100), nullable=False)  # "entrance", "register", "high_value_shelf"
    zone_type = Column(String(50), nullable=False)  # "entrance", "exit", "shelf", "register", "general"
    
    # Polygon defining the zone (list of [x, y] points in frame coordinates)
    polygon = Column(JSON, nullable=False)
    
    # What to monitor in this zone
    detect_entry = Column(Boolean, default=False)
    detect_exit = Column(Boolean, default=False)
    detect_concealment = Column(Boolean, default=True)
    detect_loitering = Column(Boolean, default=False)
    loitering_threshold_seconds = Column(Integer, default=60)
    
    # Zone metadata
    product_category = Column(String(100), nullable=True)  # For theft analytics
    is_high_value = Column(Boolean, default=False)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    camera = relationship("Camera", back_populates="zones")
