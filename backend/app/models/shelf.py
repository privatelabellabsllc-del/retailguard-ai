from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, JSON
from sqlalchemy.sql import func
from app.database import Base


class Shelf(Base):
    __tablename__ = "shelves"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    camera_id = Column(Integer, ForeignKey("cameras.id"), nullable=True)
    name = Column(String(100), nullable=False)
    aisle = Column(String(50), nullable=True)
    section = Column(String(50), nullable=True)
    reference_image_url = Column(Text, nullable=True)
    current_image_url = Column(Text, nullable=True)
    stock_level = Column(Float, default=100.0)  # percentage
    status = Column(String(20), default="stocked")  # stocked, low, empty, unknown
    last_checked = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ShelfProduct(Base):
    __tablename__ = "shelf_products"

    id = Column(Integer, primary_key=True, index=True)
    shelf_id = Column(Integer, ForeignKey("shelves.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    position_x = Column(Float, nullable=True)
    position_y = Column(Float, nullable=True)
    facings = Column(Integer, default=1)
    is_present = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    name = Column(String(200), nullable=False)
    sku = Column(String(100), nullable=True, index=True)
    barcode = Column(String(100), nullable=True, index=True)
    category = Column(String(100), nullable=True)
    price = Column(Float, nullable=True)
    image_url = Column(Text, nullable=True)
    avg_daily_sales = Column(Float, default=0)
    restock_threshold = Column(Integer, default=5)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class OutOfStockAlert(Base):
    __tablename__ = "out_of_stock_alerts"

    id = Column(Integer, primary_key=True, index=True)
    shelf_id = Column(Integer, ForeignKey("shelves.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    detected_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    duration_minutes = Column(Integer, default=0)
    estimated_lost_revenue = Column(Float, default=0)
    status = Column(String(20), default="active")  # active, resolved, dismissed
    notified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class StoreScan(Base):
    __tablename__ = "store_scans"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    scanned_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    scan_type = Column(String(50), default="full")  # full, aisle, shelf
    status = Column(String(20), default="processing")  # processing, complete, failed
    total_products_found = Column(Integer, default=0)
    planogram_compliance = Column(Float, nullable=True)
    images = Column(JSON, default=list)
    results = Column(JSON, default=dict)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
