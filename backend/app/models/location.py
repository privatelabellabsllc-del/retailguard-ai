"""Location model — for multi-store deployments."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Text, JSON, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Location(Base):
    __tablename__ = "locations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)  # "Shell Station - Main St"
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(50), nullable=True)
    zip_code = Column(String(20), nullable=True)
    
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    
    # Store layout (for zone mapping)
    floor_plan_path = Column(String(500), nullable=True)
    store_dimensions = Column(JSON, nullable=True)  # {"width_ft": 40, "length_ft": 60}
    
    # NVR Connection
    nvr_ip = Column(String(100), nullable=True)
    nvr_port = Column(String(10), default="554")
    nvr_model = Column(String(100), default="Uniview NR324XPC")
    
    # Network sharing
    share_offenders = Column(Boolean, default=True)  # Share offender DB with other locations
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    cameras = relationship("Camera", back_populates="location")
    persons = relationship("Person", back_populates="location")
