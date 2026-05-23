from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base


class TrafficCount(Base):
    __tablename__ = "traffic_counts"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False)
    camera_id = Column(UUID(as_uuid=True), ForeignKey("cameras.id"), nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    total_in = Column(Integer, default=0)
    total_out = Column(Integer, default=0)
    unique_visitors = Column(Integer, default=0)
    returning_visitors = Column(Integer, default=0)
    staff_filtered = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TrafficVisitor(Base):
    __tablename__ = "traffic_visitors"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False)
    person_id = Column(UUID(as_uuid=True), ForeignKey("persons.id"), nullable=True)
    face_embedding_hash = Column(String(64), nullable=True)
    is_staff = Column(Boolean, default=False)
    first_seen = Column(DateTime(timezone=True), server_default=func.now())
    last_seen = Column(DateTime(timezone=True), server_default=func.now())
    visit_count = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
