"""
Alert models — real-time notifications when offenders/blacklisted persons enter.
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


class AlertType(str, enum.Enum):
    KNOWN_THIEF_ENTERED = "known_thief_entered"
    BLACKLISTED_ENTERED = "blacklisted_entered"
    ACTIVE_THEFT = "active_theft"
    SUSPICIOUS_BEHAVIOR = "suspicious_behavior"
    REPEAT_OFFENDER = "repeat_offender"
    HIGH_VALUE_AREA = "high_value_area"


class AlertPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AlertStatus(str, enum.Enum):
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class ClerkAction(str, enum.Enum):
    CALL_POLICE = "call_police"
    LET_GO = "let_go"
    BLACKLIST = "blacklist"
    MONITOR = "monitor"         # Keep watching, don't act yet
    CONFRONT = "confront"       # Show customer their video


class Alert(Base):
    """Real-time alert sent to clerk when a person of interest is detected."""
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Who triggered the alert
    person_id = Column(UUID(as_uuid=True), ForeignKey("persons.id"), nullable=False, index=True)
    
    # Alert type and priority
    alert_type = Column(SAEnum(AlertType), nullable=False, index=True)
    priority = Column(SAEnum(AlertPriority), default=AlertPriority.HIGH)
    status = Column(SAEnum(AlertStatus), default=AlertStatus.ACTIVE, index=True)
    
    # Where
    camera_id = Column(UUID(as_uuid=True), ForeignKey("cameras.id"), nullable=True)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=True)
    
    # Alert content
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=True)
    # e.g., "⚠️ CONFIRMED THIEF DETECTED — Last stole on 05/20/2026. 2 prior thefts."
    
    # Live tracking
    current_camera_id = Column(UUID(as_uuid=True), nullable=True)  # Which camera they're on now
    tracking_active = Column(Boolean, default=True)
    
    # Reference to previous incident (for showing the theft video)
    reference_incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=True)
    reference_clip_url = Column(String(500), nullable=True)  # Quick access to the theft video
    
    # Person snapshot at time of alert
    current_snapshot_path = Column(String(500), nullable=True)
    match_confidence = Column(Float, nullable=True)
    
    # Match breakdown for the clerk to see
    match_details = Column(JSON, nullable=True)
    # {
    #   "face_score": 0.92,
    #   "body_score": 0.85,
    #   "gait_score": 0.78,
    #   "height_match": true,
    #   "composite_score": 0.88
    # }
    
    # Resolution
    acknowledged_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    
    # Relationships
    person = relationship("Person", back_populates="alerts")
    actions = relationship("AlertAction", back_populates="alert", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index("ix_alerts_active", "status", "priority", "created_at"),
    )


class AlertAction(Base):
    """Actions taken by clerk in response to alert."""
    __tablename__ = "alert_actions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alert_id = Column(UUID(as_uuid=True), ForeignKey("alerts.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    action = Column(SAEnum(ClerkAction), nullable=False)
    notes = Column(Text, nullable=True)
    
    # If police called
    police_called_at = Column(DateTime, nullable=True)
    police_report_number = Column(String(100), nullable=True)
    
    # Auto-generated evidence package path
    evidence_package_path = Column(String(500), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    alert = relationship("Alert", back_populates="actions")
