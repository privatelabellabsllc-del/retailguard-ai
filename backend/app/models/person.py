"""
Person models — the identity core of RetailGuard AI.
Stores facial embeddings, body biometrics, and sighting history.
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime, Text,
    ForeignKey, LargeBinary, JSON, Enum as SAEnum, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, ARRAY
import enum
from app.database import Base


class PersonStatus(str, enum.Enum):
    UNKNOWN = "unknown"           # First-time visitor, no history
    KNOWN = "known"               # Recognized repeat visitor
    SUSPECTED_THIEF = "suspected" # Flagged by AI, pending review
    CONFIRMED_THIEF = "thief"     # Confirmed theft by clerk review
    BLACKLISTED = "blacklisted"   # Permanently banned
    CLEARED = "cleared"           # Was suspected but cleared


class Person(Base):
    """A unique individual tracked by the system."""
    __tablename__ = "persons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Status
    status = Column(SAEnum(PersonStatus), default=PersonStatus.UNKNOWN, nullable=False, index=True)
    threat_level = Column(Integer, default=0)  # 0=none, 1=low, 2=medium, 3=high, 4=critical
    
    # Human-readable label (auto-generated or set by clerk)
    display_name = Column(String(255), nullable=True)  # e.g., "Male, ~6ft, red jacket"
    notes = Column(Text, nullable=True)
    
    # Physical description (AI-estimated)
    estimated_age_range = Column(String(20), nullable=True)  # e.g., "25-35"
    estimated_gender = Column(String(20), nullable=True)
    estimated_height_cm = Column(Float, nullable=True)
    estimated_build = Column(String(50), nullable=True)  # slim, medium, heavy, athletic
    hair_description = Column(String(100), nullable=True)
    skin_tone = Column(String(50), nullable=True)
    
    # Distinguishing features (AI-detected)
    distinguishing_marks = Column(JSON, nullable=True)  # tattoos, scars, glasses, etc.
    typical_clothing_style = Column(JSON, nullable=True)  # recurring patterns
    
    # Gait signature (walking pattern embedding)
    gait_embedding = Column(LargeBinary, nullable=True)
    gait_confidence = Column(Float, nullable=True)
    
    # Manually entered personal info (from clerk / ID scan)
    full_name = Column(String(255), nullable=True)
    date_of_birth = Column(String(20), nullable=True)  # "MM/DD/YYYY"
    address = Column(Text, nullable=True)
    phone_number = Column(String(30), nullable=True)
    drivers_license = Column(String(50), nullable=True)
    id_photo_path = Column(String(500), nullable=True)  # Photo of their ID
    id_type = Column(String(50), nullable=True)  # "drivers_license", "state_id", "passport"
    
    # Best portrait image path
    best_portrait_path = Column(String(500), nullable=True)
    
    # Stats
    total_visits = Column(Integer, default=1)
    total_incidents = Column(Integer, default=0)
    total_confirmed_thefts = Column(Integer, default=0)
    first_seen = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow)
    
    # Multi-location
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=True)
    shared_across_locations = Column(Boolean, default=False)
    
    # Relationships
    face_embeddings = relationship("FaceEmbedding", back_populates="person", cascade="all, delete-orphan")
    body_profiles = relationship("BodyProfile", back_populates="person", cascade="all, delete-orphan")
    sightings = relationship("PersonSighting", back_populates="person", cascade="all, delete-orphan")
    incidents = relationship("Incident", back_populates="person")
    alerts = relationship("Alert", back_populates="person")
    location = relationship("Location", back_populates="persons")
    
    __table_args__ = (
        Index("ix_persons_status_threat", "status", "threat_level"),
        Index("ix_persons_last_seen", "last_seen"),
    )


class FaceEmbedding(Base):
    """
    Stores multiple face embeddings per person from different angles.
    We keep the best 5 embeddings for robust matching.
    """
    __tablename__ = "face_embeddings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    person_id = Column(UUID(as_uuid=True), ForeignKey("persons.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 128-dim face encoding stored as binary (numpy array)
    embedding = Column(LargeBinary, nullable=False)
    
    # Quality metrics
    face_angle = Column(String(20), nullable=True)  # front, left_quarter, right_quarter, etc.
    quality_score = Column(Float, nullable=True)  # 0-1, higher = better lighting/focus/angle
    confidence = Column(Float, nullable=True)  # Detection confidence
    
    # Source
    source_camera_id = Column(UUID(as_uuid=True), ForeignKey("cameras.id"), nullable=True)
    source_frame_path = Column(String(500), nullable=True)  # Cropped face image
    
    person = relationship("Person", back_populates="face_embeddings")


class BodyProfile(Base):
    """
    Body biometric profile — height, proportions, build.
    Used alongside face for composite identity matching.
    """
    __tablename__ = "body_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    person_id = Column(UUID(as_uuid=True), ForeignKey("persons.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Body measurements (AI-estimated from pose landmarks)
    height_cm = Column(Float, nullable=True)
    shoulder_width_ratio = Column(Float, nullable=True)  # Relative to height
    torso_length_ratio = Column(Float, nullable=True)
    arm_length_ratio = Column(Float, nullable=True)
    leg_length_ratio = Column(Float, nullable=True)
    
    # Body embedding (pose-based biometric vector)
    body_embedding = Column(LargeBinary, nullable=True)
    
    # Clothing at time of capture (for short-term re-identification)
    upper_body_color = Column(String(50), nullable=True)
    lower_body_color = Column(String(50), nullable=True)
    has_bag = Column(Boolean, nullable=True)
    bag_type = Column(String(50), nullable=True)  # backpack, purse, tote, etc.
    has_hat = Column(Boolean, nullable=True)
    has_glasses = Column(Boolean, nullable=True)
    
    person = relationship("Person", back_populates="body_profiles")


class PersonSighting(Base):
    """Every time a person is detected entering/in the store."""
    __tablename__ = "person_sightings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    person_id = Column(UUID(as_uuid=True), ForeignKey("persons.id"), nullable=False, index=True)
    camera_id = Column(UUID(as_uuid=True), ForeignKey("cameras.id"), nullable=True)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=True)
    
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Match quality
    match_confidence = Column(Float, nullable=True)  # Composite match score
    face_match_score = Column(Float, nullable=True)
    body_match_score = Column(Float, nullable=True)
    gait_match_score = Column(Float, nullable=True)
    
    # Snapshot
    snapshot_path = Column(String(500), nullable=True)
    
    # Duration
    entered_at = Column(DateTime, nullable=True)
    exited_at = Column(DateTime, nullable=True)
    
    # Zone tracking (which areas they visited)
    zones_visited = Column(JSON, nullable=True)  # ["entrance", "aisle_3", "checkout"]
    
    person = relationship("Person", back_populates="sightings")
    
    __table_args__ = (
        Index("ix_sightings_person_time", "person_id", "timestamp"),
    )
