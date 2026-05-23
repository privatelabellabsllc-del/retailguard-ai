"""
Traffic counting & analytics models — unique visitor counting with face de-duplication.
"""
import uuid
from datetime import datetime, date
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime, Date, Text,
    ForeignKey, JSON, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class DailyTraffic(Base):
    """Aggregated daily foot traffic for a location."""
    __tablename__ = "daily_traffic"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=True)
    date = Column(Date, nullable=False, index=True)

    # Counts
    total_entries = Column(Integer, default=0)
    unique_visitors = Column(Integer, default=0)
    returning_visitors = Column(Integer, default=0)
    staff_entries = Column(Integer, default=0)  # Filtered out from unique count

    # Hourly breakdown (24 slots)
    hourly_entries = Column(JSON, nullable=True)  # {"0": 0, "1": 0, ..., "23": 12}
    hourly_unique = Column(JSON, nullable=True)

    # Conversion (if POS connected)
    total_transactions = Column(Integer, nullable=True)
    total_revenue = Column(Float, nullable=True)
    conversion_rate = Column(Float, nullable=True)  # transactions / unique_visitors

    # YoY comparison
    yoy_visitor_change = Column(Float, nullable=True)  # % change vs same day last year
    yoy_revenue_change = Column(Float, nullable=True)

    # Peak info
    peak_hour = Column(Integer, nullable=True)  # 0-23
    peak_hour_count = Column(Integer, nullable=True)

    # Weather (for correlation)
    weather_condition = Column(String(50), nullable=True)
    temperature_f = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("location_id", "date", name="uq_daily_traffic_location_date"),
        Index("ix_daily_traffic_date", "date"),
    )


class VisitorEntry(Base):
    """Individual visitor entry event — for real-time counting and de-duplication."""
    __tablename__ = "visitor_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=True)
    camera_id = Column(UUID(as_uuid=True), ForeignKey("cameras.id"), nullable=True)

    person_id = Column(UUID(as_uuid=True), ForeignKey("persons.id"), nullable=True)
    is_staff = Column(Boolean, default=False)  # Recognized as clerk/staff
    is_unique_today = Column(Boolean, default=True)  # First entry today

    entered_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    exited_at = Column(DateTime, nullable=True)
    duration_minutes = Column(Float, nullable=True)

    # Snapshot for the entry
    snapshot_path = Column(String(500), nullable=True)
    match_confidence = Column(Float, nullable=True)

    __table_args__ = (
        Index("ix_visitor_entries_date", "entered_at"),
        Index("ix_visitor_entries_person", "person_id", "entered_at"),
    )


class HeatmapData(Base):
    """Aggregated heatmap data for store zones — traffic density per area."""
    __tablename__ = "heatmap_data"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=True)
    camera_id = Column(UUID(as_uuid=True), ForeignKey("cameras.id"), nullable=True)
    date = Column(Date, nullable=False, index=True)
    hour = Column(Integer, nullable=True)  # 0-23, null for full-day aggregate

    # Grid-based heatmap (normalized coordinates)
    grid_data = Column(JSON, nullable=True)
    # [[count, count, ...], [count, count, ...], ...]  — 20x20 grid

    # Zone-level summary
    zone_traffic = Column(JSON, nullable=True)
    # {"entrance": 450, "aisle_1": 120, "checkout": 380, ...}

    # Dwell time per zone (average seconds)
    zone_dwell_time = Column(JSON, nullable=True)
    # {"entrance": 8, "aisle_1": 45, "checkout": 120}

    # Path analysis — most common routes
    common_paths = Column(JSON, nullable=True)
    # [{"path": ["entrance", "aisle_2", "checkout"], "count": 89}, ...]

    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_heatmap_date_location", "location_id", "date"),
    )
