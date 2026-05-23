from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base


class CashSession(Base):
    __tablename__ = "cash_sessions"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False)
    register_id = Column(String(50), nullable=False)
    clerk_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    shift_id = Column(Integer, ForeignKey("shifts.id"), nullable=True)
    opening_amount = Column(Float, nullable=False)
    closing_amount = Column(Float, nullable=True)
    expected_amount = Column(Float, nullable=True)
    variance = Column(Float, nullable=True)
    status = Column(String(20), default="open")  # open, closed, flagged
    notes = Column(Text, nullable=True)
    opened_at = Column(DateTime(timezone=True), server_default=func.now())
    closed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CashTransaction(Base):
    __tablename__ = "cash_transactions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("cash_sessions.id"), nullable=False)
    clerk_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False)
    transaction_type = Column(String(30), nullable=False)  # sale, refund, no_sale, payout, drop, pickup
    amount = Column(Float, nullable=False)
    payment_method = Column(String(30), default="cash")  # cash, card, mixed
    receipt_number = Column(String(100), nullable=True)
    is_flagged = Column(Boolean, default=False)
    flag_reason = Column(String(200), nullable=True)
    video_clip_url = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CashAlert(Base):
    __tablename__ = "cash_alerts"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("cash_sessions.id"), nullable=True)
    transaction_id = Column(Integer, ForeignKey("cash_transactions.id"), nullable=True)
    clerk_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False)
    alert_type = Column(String(50), nullable=False)  # no_sale, variance, sweethearting, unusual_refund, drawer_open
    severity = Column(String(20), default="medium")  # low, medium, high, critical
    description = Column(Text, nullable=True)
    video_clip_url = Column(Text, nullable=True)
    is_reviewed = Column(Boolean, default=False)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolution = Column(String(50), nullable=True)  # legitimate, suspicious, confirmed_theft, dismissed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
