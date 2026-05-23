"""
Incident models — theft detection events, video clips, and review workflow.
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime, Text,
    ForeignKey, JSON, Enum as SAEnum, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import enum
from app.database import Base


class IncidentType(str, enum.Enum):
    CONCEALMENT = "concealment"        # Item put in pocket/bag/purse
    GRAB_AND_RUN = "grab_and_run"      # Grabbed item and ran
    SWEEPING = "sweeping"              # Sweeping items into bag
    TAG_REMOVAL = "tag_removal"        # Removing security tags
    PACKAGE_SWITCH = "package_switch"  # Switching packaging
    SELF_CHECKOUT = "self_checkout"    # Scan skip at self-checkout
    SUSPICIOUS = "suspicious"          # General suspicious behavior
    OTHER = "other"


class IncidentSeverity(str, enum.Enum):
    LOW = "low"         # Possible false positive
    MEDIUM = "medium"   # Likely theft, review needed
    HIGH = "high"       # High confidence theft
    CRITICAL = "critical"  # Known offender + active theft


class ReviewStatus(str, enum.Enum):
    PENDING = "pending"        # Waiting for clerk review
    CONFIRMED_THEFT = "theft"  # Clerk confirmed theft
    NOT_THEFT = "not_theft"    # False positive
    UNSURE = "unsure"          # Needs manager review
    ESCALATED = "escalated"    # Sent to law enforcement


class Incident(Base):
    """A detected theft or suspicious behavior event."""
    __tablename__ = "incidents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Who
    person_id = Column(UUID(as_uuid=True), ForeignKey("persons.id"), nullable=True, index=True)
    
    # What
    incident_type = Column(SAEnum(IncidentType), nullable=False, index=True)
    severity = Column(SAEnum(IncidentSeverity), default=IncidentSeverity.MEDIUM)
    review_status = Column(SAEnum(ReviewStatus), default=ReviewStatus.PENDING, index=True)
    
    # Where
    camera_id = Column(UUID(as_uuid=True), ForeignKey("cameras.id"), nullable=True)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=True)
    zone_name = Column(String(100), nullable=True)  # "aisle_3", "candy_section"
    
    # When
    detected_at = Column(DateTime, nullable=False, index=True)
    
    # AI Detection Details
    ai_confidence = Column(Float, nullable=False)  # 0-1
    detection_details = Column(JSON, nullable=True)
    # Example detection_details:
    # {
    #   "action": "right_hand_to_right_pocket",
    #   "item_detected": true,
    #   "item_description": "small rectangular object",
    #   "hand_trajectory": [[x1,y1], [x2,y2], ...],
    #   "pocket_region": "right_front_pants",
    #   "concealment_type": "pocket",
    #   "pose_keypoints_before": {...},
    #   "pose_keypoints_during": {...},
    #   "pose_keypoints_after": {...},
    #   "shelf_interaction": true,
    #   "item_in_hand_before": true,
    #   "item_in_hand_after": false
    # }
    
    # Human description (auto-generated)
    ai_description = Column(Text, nullable=True)
    # e.g., "Male subject picked up item from shelf with right hand, 
    #         moved hand to right front pocket. Item no longer visible in hand."
    
    # Review
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)
    
    # Estimated loss
    estimated_item = Column(String(255), nullable=True)
    estimated_value = Column(Float, nullable=True)
    
    # Relationships
    person = relationship("Person", back_populates="incidents")
    clips = relationship("IncidentClip", back_populates="incident", cascade="all, delete-orphan")
    reviews = relationship("IncidentReview", back_populates="incident", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index("ix_incidents_review", "review_status", "created_at"),
        Index("ix_incidents_person_time", "person_id", "detected_at"),
    )


class IncidentClip(Base):
    """Video clip evidence for an incident."""
    __tablename__ = "incident_clips"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=False, index=True)
    camera_id = Column(UUID(as_uuid=True), ForeignKey("cameras.id"), nullable=True)
    
    # Clip file
    clip_path = Column(String(500), nullable=False)  # Local or S3 path
    clip_url = Column(String(500), nullable=True)     # Signed URL for frontend
    thumbnail_path = Column(String(500), nullable=True)
    
    # Timing
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    duration_seconds = Column(Float, nullable=False)
    
    # Key moment (the exact frame of concealment)
    key_moment_offset = Column(Float, nullable=True)  # Seconds into clip
    key_moment_frame_path = Column(String(500), nullable=True)
    
    # Annotations (bounding boxes, pose overlays for key frames)
    annotations = Column(JSON, nullable=True)
    # {
    #   "bounding_boxes": [{"frame": 45, "x": 100, "y": 200, "w": 80, "h": 150}],
    #   "pose_overlay_frames": [40, 45, 50],
    #   "item_highlight_frames": [42, 43, 44, 45]
    # }
    
    # Metadata
    resolution = Column(String(20), nullable=True)  # "1920x1080"
    file_size_bytes = Column(Integer, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    incident = relationship("Incident", back_populates="clips")


class IncidentReview(Base):
    """Audit trail of all review actions on an incident."""
    __tablename__ = "incident_reviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    action = Column(String(50), nullable=False)  # "marked_theft", "marked_not_theft", "escalated", etc.
    previous_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=False)
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    incident = relationship("Incident", back_populates="reviews")
