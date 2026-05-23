from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from app.database import get_db
from app.models.shelf import Shelf, ShelfProduct, Product, OutOfStockAlert, StoreScan

router = APIRouter(prefix="/api/shelves", tags=["Shelves & Products"])


class ShelfCreate(BaseModel):
    name: str
    aisle: Optional[str] = None
    section: Optional[str] = None
    camera_id: Optional[int] = None
    location_id: int = 1


class ProductCreate(BaseModel):
    name: str
    sku: Optional[str] = None
    barcode: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    location_id: int = 1


@router.get("/")
def get_shelves(location_id: int = 1, db: Session = Depends(get_db)):
    shelves = db.query(Shelf).filter(Shelf.location_id == location_id).all()
    return {
        "shelves": [{
            "id": s.id,
            "name": s.name,
            "aisle": s.aisle,
            "section": s.section,
            "stock_level": s.stock_level,
            "status": s.status,
            "last_checked": str(s.last_checked) if s.last_checked else None,
            "reference_image_url": s.reference_image_url,
            "current_image_url": s.current_image_url,
        } for s in shelves],
        "summary": {
            "total": len(shelves),
            "stocked": sum(1 for s in shelves if s.status == "stocked"),
            "low": sum(1 for s in shelves if s.status == "low"),
            "empty": sum(1 for s in shelves if s.status == "empty"),
        }
    }


@router.post("/")
def create_shelf(data: ShelfCreate, db: Session = Depends(get_db)):
    shelf = Shelf(**data.dict())
    db.add(shelf)
    db.commit()
    db.refresh(shelf)
    return {"id": shelf.id, "name": shelf.name}


@router.get("/out-of-stock")
def get_out_of_stock(
    status: str = "active",
    location_id: int = 1,
    db: Session = Depends(get_db)
):
    alerts = db.query(OutOfStockAlert).filter(
        OutOfStockAlert.location_id == location_id,
        OutOfStockAlert.status == status
    ).order_by(OutOfStockAlert.detected_at.desc()).all()
    
    return {
        "alerts": [{
            "id": a.id,
            "shelf_id": a.shelf_id,
            "product_id": a.product_id,
            "detected_at": str(a.detected_at),
            "duration_minutes": a.duration_minutes,
            "estimated_lost_revenue": a.estimated_lost_revenue,
            "status": a.status,
        } for a in alerts],
        "total_active": len([a for a in alerts if a.status == "active"]),
        "total_lost_revenue": sum(a.estimated_lost_revenue for a in alerts),
    }


@router.post("/out-of-stock/{alert_id}/resolve")
def resolve_oos(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(OutOfStockAlert).filter(OutOfStockAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status = "resolved"
    alert.resolved_at = datetime.utcnow()
    if alert.detected_at:
        alert.duration_minutes = int((datetime.utcnow() - alert.detected_at).total_seconds() / 60)
    db.commit()
    return {"id": alert.id, "status": "resolved"}


@router.get("/products")
def get_products(
    category: Optional[str] = None,
    search: Optional[str] = None,
    location_id: int = 1,
    db: Session = Depends(get_db)
):
    q = db.query(Product).filter(Product.location_id == location_id)
    if category:
        q = q.filter(Product.category == category)
    if search:
        q = q.filter(Product.name.ilike(f"%{search}%"))
    
    products = q.order_by(Product.name).limit(100).all()
    return {
        "products": [{
            "id": p.id,
            "name": p.name,
            "sku": p.sku,
            "barcode": p.barcode,
            "category": p.category,
            "price": p.price,
            "avg_daily_sales": p.avg_daily_sales,
            "image_url": p.image_url,
        } for p in products]
    }


@router.post("/products")
def create_product(data: ProductCreate, db: Session = Depends(get_db)):
    product = Product(**data.dict())
    db.add(product)
    db.commit()
    db.refresh(product)
    return {"id": product.id, "name": product.name}


@router.get("/scans")
def get_scans(location_id: int = 1, db: Session = Depends(get_db)):
    scans = db.query(StoreScan).filter(
        StoreScan.location_id == location_id
    ).order_by(StoreScan.created_at.desc()).limit(20).all()
    
    return {
        "scans": [{
            "id": s.id,
            "scan_type": s.scan_type,
            "status": s.status,
            "total_products_found": s.total_products_found,
            "planogram_compliance": s.planogram_compliance,
            "started_at": str(s.started_at),
            "completed_at": str(s.completed_at) if s.completed_at else None,
        } for s in scans]
    }


@router.post("/scans")
def start_scan(location_id: int = 1, scan_type: str = "full", db: Session = Depends(get_db)):
    scan = StoreScan(
        location_id=location_id,
        scanned_by=1,  # TODO: get from auth
        scan_type=scan_type,
        status="processing"
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)
    return {"scan_id": scan.id, "status": "processing"}
