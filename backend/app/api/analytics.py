from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel
from app.database import get_db
from app.models.analytics import HeatmapData, FridgeDoorEvent, RevenueRecord, DailyAnalytics

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


class RevenueCreate(BaseModel):
    date: str
    total_revenue: float
    transaction_count: int = 0
    cash_revenue: float = 0
    card_revenue: float = 0
    source: str = "manual"
    location_id: int = 1


@router.get("/dashboard")
def get_dashboard_analytics(location_id: int = 1, db: Session = Depends(get_db)):
    today = datetime.utcnow().date()
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)
    
    today_analytics = db.query(DailyAnalytics).filter(
        func.date(DailyAnalytics.date) == today,
        DailyAnalytics.location_id == location_id
    ).first()
    
    week_data = db.query(DailyAnalytics).filter(
        DailyAnalytics.date >= week_ago,
        DailyAnalytics.location_id == location_id
    ).all()
    
    month_data = db.query(DailyAnalytics).filter(
        DailyAnalytics.date >= month_ago,
        DailyAnalytics.location_id == location_id
    ).all()
    
    return {
        "today": {
            "foot_traffic": today_analytics.foot_traffic if today_analytics else 0,
            "revenue": today_analytics.total_revenue if today_analytics else 0,
            "conversion_rate": today_analytics.conversion_rate if today_analytics else 0,
            "avg_dwell": today_analytics.avg_dwell_minutes if today_analytics else 0,
        },
        "week": {
            "total_traffic": sum(d.foot_traffic for d in week_data),
            "total_revenue": sum(d.total_revenue for d in week_data),
            "avg_daily_traffic": round(sum(d.foot_traffic for d in week_data) / max(len(week_data), 1)),
            "avg_conversion": round(sum(d.conversion_rate for d in week_data) / max(len(week_data), 1), 1),
        },
        "month": {
            "total_traffic": sum(d.foot_traffic for d in month_data),
            "total_revenue": sum(d.total_revenue for d in month_data),
            "avg_daily_traffic": round(sum(d.foot_traffic for d in month_data) / max(len(month_data), 1)),
            "avg_conversion": round(sum(d.conversion_rate for d in month_data) / max(len(month_data), 1), 1),
        },
    }


@router.get("/heatmap")
def get_heatmap(
    camera_id: Optional[int] = None,
    date: Optional[str] = None,
    location_id: int = 1,
    db: Session = Depends(get_db)
):
    target = datetime.strptime(date, "%Y-%m-%d") if date else datetime.utcnow()
    q = db.query(HeatmapData).filter(
        HeatmapData.location_id == location_id,
        func.date(HeatmapData.period_start) == target.date()
    )
    if camera_id:
        q = q.filter(HeatmapData.camera_id == camera_id)
    
    data = q.order_by(HeatmapData.period_start.desc()).limit(24).all()
    return {
        "zones": [{
            "id": d.id,
            "zone_name": d.zone_name,
            "camera_id": d.camera_id,
            "grid_data": d.grid_data,
            "peak_count": d.peak_count,
            "avg_dwell_seconds": d.avg_dwell_seconds,
            "period": str(d.period_start),
        } for d in data]
    }


@router.get("/fridge")
def get_fridge_analytics(
    fridge_id: Optional[str] = None,
    location_id: int = 1,
    db: Session = Depends(get_db)
):
    today = datetime.utcnow().date()
    q = db.query(FridgeDoorEvent).filter(
        FridgeDoorEvent.location_id == location_id,
        func.date(FridgeDoorEvent.created_at) == today
    )
    if fridge_id:
        q = q.filter(FridgeDoorEvent.fridge_id == fridge_id)
    
    events = q.all()
    
    # Aggregate by fridge
    fridges = {}
    for e in events:
        if e.fridge_id not in fridges:
            fridges[e.fridge_id] = {
                "fridge_id": e.fridge_id,
                "name": e.fridge_name or e.fridge_id,
                "opens_today": 0,
                "avg_duration": 0,
                "grab_rate": 0,
                "left_open_count": 0,
                "durations": [],
                "grabs": 0,
            }
        f = fridges[e.fridge_id]
        if e.event_type == "opened":
            f["opens_today"] += 1
            if e.duration_seconds:
                f["durations"].append(e.duration_seconds)
            if e.grabbed_product:
                f["grabs"] += 1
        elif e.event_type == "left_open":
            f["left_open_count"] += 1
    
    for f in fridges.values():
        if f["durations"]:
            f["avg_duration"] = round(sum(f["durations"]) / len(f["durations"]), 1)
        if f["opens_today"] > 0:
            f["grab_rate"] = round(f["grabs"] / f["opens_today"] * 100, 1)
        del f["durations"]
        del f["grabs"]
    
    return {"fridges": list(fridges.values()), "total_opens": len(events)}


@router.post("/revenue")
def add_revenue(data: RevenueCreate, db: Session = Depends(get_db)):
    record = RevenueRecord(
        location_id=data.location_id,
        date=datetime.fromisoformat(data.date),
        total_revenue=data.total_revenue,
        transaction_count=data.transaction_count,
        cash_revenue=data.cash_revenue,
        card_revenue=data.card_revenue,
        source=data.source,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"id": record.id, "date": data.date, "revenue": record.total_revenue}


@router.get("/revenue")
def get_revenue(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    location_id: int = 1,
    db: Session = Depends(get_db)
):
    q = db.query(RevenueRecord).filter(RevenueRecord.location_id == location_id)
    if start_date:
        q = q.filter(RevenueRecord.date >= datetime.fromisoformat(start_date))
    if end_date:
        q = q.filter(RevenueRecord.date <= datetime.fromisoformat(end_date))
    
    records = q.order_by(RevenueRecord.date.desc()).limit(90).all()
    return {
        "records": [{
            "id": r.id,
            "date": str(r.date.date()) if hasattr(r.date, 'date') else str(r.date),
            "total_revenue": r.total_revenue,
            "transaction_count": r.transaction_count,
            "avg_transaction": r.avg_transaction_value,
            "cash": r.cash_revenue,
            "card": r.card_revenue,
            "source": r.source,
        } for r in records]
    }


@router.get("/projections")
def get_projections(location_id: int = 1, db: Session = Depends(get_db)):
    """AI-powered revenue projections based on traffic + historical data"""
    last_30 = db.query(DailyAnalytics).filter(
        DailyAnalytics.location_id == location_id,
        DailyAnalytics.date >= datetime.utcnow() - timedelta(days=30)
    ).all()
    
    if not last_30:
        return {"projections": {"daily": 0, "weekly": 0, "monthly": 0}, "confidence": "low"}
    
    avg_revenue = sum(d.total_revenue for d in last_30) / len(last_30)
    avg_traffic = sum(d.foot_traffic for d in last_30) / len(last_30)
    avg_conversion = sum(d.conversion_rate for d in last_30) / len(last_30)
    
    # Simple projection with trend
    revenues = [d.total_revenue for d in sorted(last_30, key=lambda x: x.date)]
    if len(revenues) >= 7:
        recent_avg = sum(revenues[-7:]) / 7
        older_avg = sum(revenues[:7]) / 7
        trend = (recent_avg - older_avg) / max(older_avg, 1)
    else:
        trend = 0
    
    projected_daily = avg_revenue * (1 + trend * 0.1)
    
    return {
        "projections": {
            "daily": round(projected_daily, 2),
            "weekly": round(projected_daily * 7, 2),
            "monthly": round(projected_daily * 30, 2),
        },
        "trend_percent": round(trend * 100, 1),
        "avg_traffic": round(avg_traffic),
        "avg_conversion": round(avg_conversion, 1),
        "confidence": "high" if len(last_30) >= 21 else "medium" if len(last_30) >= 7 else "low",
    }
