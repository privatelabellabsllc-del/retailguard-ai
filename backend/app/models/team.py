from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base


class Shift(Base):
    __tablename__ = "shifts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False)
    scheduled_start = Column(DateTime(timezone=True), nullable=True)
    scheduled_end = Column(DateTime(timezone=True), nullable=True)
    actual_start = Column(DateTime(timezone=True), nullable=True)
    actual_end = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), default="scheduled")  # scheduled, active, completed, missed
    is_late = Column(Boolean, default=False)
    late_minutes = Column(Integer, default=0)
    total_hours = Column(Float, nullable=True)
    overtime_hours = Column(Float, default=0)
    break_minutes = Column(Integer, default=0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class PerformanceMetric(Base):
    __tablename__ = "performance_metrics"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False)
    date = Column(DateTime(timezone=True), nullable=False, index=True)
    overall_score = Column(Float, nullable=True)
    transactions_per_hour = Column(Float, nullable=True)
    avg_transaction_seconds = Column(Float, nullable=True)
    total_transactions = Column(Integer, default=0)
    revenue_per_hour = Column(Float, nullable=True)
    customer_greeting_rate = Column(Float, nullable=True)
    void_count = Column(Integer, default=0)
    void_rate = Column(Float, default=0)
    cash_variance = Column(Float, default=0)
    late_arrival = Column(Boolean, default=False)
    upsell_rate = Column(Float, nullable=True)
    avg_basket_value = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PerformanceReview(Base):
    __tablename__ = "performance_reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False)
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), nullable=False)
    overall_score = Column(Float, nullable=True)
    speed_score = Column(Float, nullable=True)
    accuracy_score = Column(Float, nullable=True)
    service_score = Column(Float, nullable=True)
    reliability_score = Column(Float, nullable=True)
    lp_score = Column(Float, nullable=True)  # loss prevention
    highlights = Column(JSON, default=list)
    improvements = Column(JSON, default=list)
    ai_summary = Column(Text, nullable=True)
    manager_notes = Column(Text, nullable=True)
    status = Column(String(20), default="pending")  # pending, approved, sent, rejected
    auto_send = Column(Boolean, default=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ReviewTemplate(Base):
    __tablename__ = "review_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    template_text = Column(Text, nullable=False)
    metrics_included = Column(JSON, default=list)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
