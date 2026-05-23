"""
Team management models — shifts, schedules, performance tracking, and AI reviews.
"""
import uuid
from datetime import datetime, date, time
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime, Date, Time, Text,
    ForeignKey, JSON, Enum as SAEnum, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import enum
from app.database import Base


# ─── Shift Management ───────────────────────────────────────────────────────

class ShiftStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    CLOCKED_IN = "clocked_in"
    ON_BREAK = "on_break"
    CLOCKED_OUT = "clocked_out"
    NO_SHOW = "no_show"
    LATE = "late"


class Shift(Base):
    """A work shift for a team member."""
    __tablename__ = "shifts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=True)

    # Scheduled times
    scheduled_date = Column(Date, nullable=False, index=True)
    scheduled_start = Column(DateTime, nullable=False)
    scheduled_end = Column(DateTime, nullable=False)

    # Actual times
    clock_in = Column(DateTime, nullable=True)
    clock_out = Column(DateTime, nullable=True)
    clock_in_method = Column(String(50), nullable=True)  # "face_recognition", "manual", "pin"
    clock_out_method = Column(String(50), nullable=True)

    # Face verification on clock-in (anti-buddy-punch)
    face_verified = Column(Boolean, default=False)
    face_snapshot_path = Column(String(500), nullable=True)

    # Status
    status = Column(SAEnum(ShiftStatus), default=ShiftStatus.SCHEDULED, nullable=False)
    is_late = Column(Boolean, default=False)
    late_minutes = Column(Integer, default=0)

    # Break tracking
    total_break_minutes = Column(Integer, default=0)
    break_log = Column(JSON, nullable=True)
    # [{"start": "2026-01-12T12:00:00", "end": "2026-01-12T12:30:00", "duration_min": 30}]

    # Overtime
    overtime_minutes = Column(Integer, default=0)
    is_overtime_approved = Column(Boolean, default=False)

    # Notes
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_shifts_user_date", "user_id", "scheduled_date"),
    )


class ShiftSwapRequest(Base):
    """Request to swap shifts between two team members."""
    __tablename__ = "shift_swap_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    requester_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    target_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # Who they want to swap with
    shift_id = Column(UUID(as_uuid=True), ForeignKey("shifts.id"), nullable=False)

    status = Column(String(20), default="pending")  # pending, accepted, rejected, approved
    reason = Column(Text, nullable=True)

    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)


# ─── Performance Tracking ────────────────────────────────────────────────────

class DailyPerformance(Base):
    """Daily performance metrics for each clerk — computed from cameras + POS."""
    __tablename__ = "daily_performance"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=True)
    date = Column(Date, nullable=False, index=True)
    shift_id = Column(UUID(as_uuid=True), ForeignKey("shifts.id"), nullable=True)

    # Speed metrics
    total_transactions = Column(Integer, default=0)
    avg_transaction_seconds = Column(Float, nullable=True)
    transactions_per_hour = Column(Float, nullable=True)
    fastest_transaction_seconds = Column(Float, nullable=True)
    slowest_transaction_seconds = Column(Float, nullable=True)

    # Accuracy metrics
    void_count = Column(Integer, default=0)
    void_rate = Column(Float, nullable=True)  # void_count / total_transactions
    refund_count = Column(Integer, default=0)
    cash_variance = Column(Float, default=0.0)  # Over/short amount

    # Revenue metrics
    total_revenue = Column(Float, default=0.0)
    avg_transaction_value = Column(Float, nullable=True)
    revenue_per_hour = Column(Float, nullable=True)
    upsell_count = Column(Integer, default=0)  # Multi-item transactions

    # Customer service (AI-observed from camera)
    greeting_rate = Column(Float, nullable=True)  # % of customers greeted
    avg_customer_wait_seconds = Column(Float, nullable=True)
    customers_served = Column(Integer, default=0)

    # Attendance
    shift_duration_minutes = Column(Integer, nullable=True)
    active_register_minutes = Column(Integer, nullable=True)
    idle_minutes = Column(Integer, nullable=True)
    was_on_time = Column(Boolean, default=True)

    # Loss prevention
    alert_response_time_avg = Column(Float, nullable=True)  # Seconds to respond to alerts
    incidents_during_shift = Column(Integer, default=0)
    no_sale_opens = Column(Integer, default=0)  # Drawer opens with no transaction

    # Computed overall score (0-100)
    overall_score = Column(Float, nullable=True)

    # Score breakdown
    score_breakdown = Column(JSON, nullable=True)
    # {"speed": 85, "accuracy": 92, "service": 78, "reliability": 100, "loss_prevention": 95, "revenue": 80}

    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "date", "shift_id", name="uq_daily_perf_user_date_shift"),
        Index("ix_daily_perf_user_date", "user_id", "date"),
    )


# ─── AI Weekly Reviews ────────────────────────────────────────────────────────

class ReviewApprovalMode(str, enum.Enum):
    MANUAL = "manual"           # All reviews queued for manager approval
    AUTO_GOOD = "auto_good"     # 75+ auto-send, below queued
    FULL_AUTO = "full_auto"     # All auto-send, manager gets digest


class PerformanceReview(Base):
    """AI-generated weekly performance review for a clerk."""
    __tablename__ = "performance_reviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=True)

    # Review period
    week_start = Column(Date, nullable=False)
    week_end = Column(Date, nullable=False)

    # Overall score
    overall_score = Column(Float, nullable=False)
    previous_week_score = Column(Float, nullable=True)
    score_trend = Column(String(10), nullable=True)  # "up", "down", "stable"

    # Category scores
    speed_score = Column(Float, nullable=True)
    accuracy_score = Column(Float, nullable=True)
    service_score = Column(Float, nullable=True)
    reliability_score = Column(Float, nullable=True)
    loss_prevention_score = Column(Float, nullable=True)
    revenue_score = Column(Float, nullable=True)

    # AI-generated content
    summary = Column(Text, nullable=True)
    # "Great week, Jordan! Your transaction speed improved 12%..."
    highlights = Column(JSON, nullable=True)
    # ["Fastest avg transaction time in the team", "Zero cash variances all week"]
    improvement_areas = Column(JSON, nullable=True)
    # ["Greeting rate dropped to 65% — aim for 80%+", "2 late clock-ins this week"]
    ai_recommendations = Column(JSON, nullable=True)
    # ["Consider cross-training on inventory", "Ready for shift lead trial"]

    # Key stats summary
    stats_summary = Column(JSON, nullable=True)
    # {"total_transactions": 847, "total_revenue": 12450, "avg_speed": 42, ...}

    # Badges earned
    badges = Column(JSON, nullable=True)
    # [{"name": "Speed Demon", "icon": "⚡", "reason": "Top transaction speed"}]

    # Approval workflow
    status = Column(String(20), default="pending")  # pending, approved, sent, rejected
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    manager_notes = Column(Text, nullable=True)
    sent_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "week_start", name="uq_review_user_week"),
        Index("ix_reviews_user", "user_id", "week_start"),
    )


class Badge(Base):
    """Gamification badges earned by team members."""
    __tablename__ = "badges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    name = Column(String(100), nullable=False)  # "Speed Demon", "Cash King"
    icon = Column(String(10), nullable=True)  # Emoji: ⚡, 💰, 🛡️
    category = Column(String(50), nullable=True)  # "speed", "accuracy", "service"
    description = Column(String(255), nullable=True)

    earned_at = Column(DateTime, default=datetime.utcnow)
    week_of = Column(Date, nullable=True)
