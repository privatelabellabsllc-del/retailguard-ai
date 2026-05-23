from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, JSON, Text
from sqlalchemy.sql import func
from app.database import Base


class HeatmapData(Base):
    __tablename__ = "heatmap_data"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    camera_id = Column(Integer, ForeignKey("cameras.id"), nullable=False)
    zone_name = Column(String(100), nullable=True)
    grid_data = Column(JSON, nullable=False)  # 2D array of traffic density
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), nullable=False)
    peak_count = Column(Integer, default=0)
    avg_dwell_seconds = Column(Float, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class FridgeDoorEvent(Base):
    __tablename__ = "fridge_door_events"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    camera_id = Column(Integer, ForeignKey("cameras.id"), nullable=True)
    fridge_id = Column(String(50), nullable=False)
    fridge_name = Column(String(100), nullable=True)
    event_type = Column(String(30), nullable=False)  # opened, closed, left_open
    duration_seconds = Column(Float, nullable=True)
    grabbed_product = Column(Boolean, nullable=True)
    person_id = Column(Integer, ForeignKey("persons.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RevenueRecord(Base):
    __tablename__ = "revenue_records"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    date = Column(DateTime(timezone=True), nullable=False, index=True)
    total_revenue = Column(Float, default=0)
    transaction_count = Column(Integer, default=0)
    avg_transaction_value = Column(Float, default=0)
    cash_revenue = Column(Float, default=0)
    card_revenue = Column(Float, default=0)
    source = Column(String(50), default="manual")  # manual, pos_sync, api, csv
    pos_provider = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class DailyAnalytics(Base):
    __tablename__ = "daily_analytics"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    date = Column(DateTime(timezone=True), nullable=False, index=True)
    foot_traffic = Column(Integer, default=0)
    unique_visitors = Column(Integer, default=0)
    returning_visitors = Column(Integer, default=0)
    total_revenue = Column(Float, default=0)
    conversion_rate = Column(Float, default=0)  # purchases / visitors
    avg_dwell_minutes = Column(Float, default=0)
    peak_hour = Column(Integer, nullable=True)
    peak_hour_traffic = Column(Integer, default=0)
    incidents_count = Column(Integer, default=0)
    out_of_stock_minutes = Column(Integer, default=0)
    estimated_lost_revenue = Column(Float, default=0)
    yoy_traffic_change = Column(Float, nullable=True)
    yoy_revenue_change = Column(Float, nullable=True)
    ai_summary = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
