from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import datetime, timedelta
from typing import Optional
from app.database import get_db
from app.models.traffic import TrafficCount, TrafficVisitor
from app.models.analytics import DailyAnalytics, RevenueRecord

router = APIRouter(prefix="/api/traffic", tags=["Traffic"])


@router.get("/today")
def get_today_traffic(location_id: int = 1, db: Session = Depends(get_db)):
    today = datetime.utcnow().date()
    record = db.query(TrafficCount).filter(
        func.date(TrafficCount.timestamp) == today,
        TrafficCount.location_id == location_id
    ).order_by(TrafficCount.timestamp.desc()).first()
    
    yesterday = today - timedelta(days=1)
    yesterday_record = db.query(TrafficCount).filter(
        func.date(TrafficCount.timestamp) == yesterday,
        TrafficCount.location_id == location_id
    ).order_by(TrafficCount.timestamp.desc()).first()
    
    current = record.total_in if record else 0
    prev = yesterday_record.total_in if yesterday_record else 0
    change = ((current - prev) / prev * 100) if prev > 0 else 0
    
    return {
        "today": current,
        "unique_visitors": record.unique_visitors if record else 0,
        "returning_visitors": record.returning_visitors if record else 0,
        "currently_in_store": (record.total_in - record.total_out) if record else 0,
        "yesterday": prev,
        "change_percent": round(change, 1),
    }


@router.get("/hourly")
def get_hourly_traffic(
    date: Optional[str] = None,
    location_id: int = 1,
    db: Session = Depends(get_db)
):
    target = datetime.strptime(date, "%Y-%m-%d").date() if date else datetime.utcnow().date()
    records = db.query(TrafficCount).filter(
        func.date(TrafficCount.timestamp) == target,
        TrafficCount.location_id == location_id
    ).order_by(TrafficCount.timestamp).all()
    
    hourly = {}
    for r in records:
        hour = r.timestamp.hour
        if hour not in hourly:
            hourly[hour] = {"hour": hour, "count": 0, "unique": 0}
        hourly[hour]["count"] = r.total_in
        hourly[hour]["unique"] = r.unique_visitors
    
    return {"date": str(target), "hours": list(hourly.values())}


@router.get("/calendar")
def get_calendar_data(
    month: int = Query(...),
    year: int = Query(...),
    location_id: int = 1,
    db: Session = Depends(get_db)
):
    analytics = db.query(DailyAnalytics).filter(
        extract("month", DailyAnalytics.date) == month,
        extract("year", DailyAnalytics.date) == year,
        DailyAnalytics.location_id == location_id
    ).all()
    
    # Get same month last year for YoY
    last_year = db.query(DailyAnalytics).filter(
        extract("month", DailyAnalytics.date) == month,
        extract("year", DailyAnalytics.date) == year - 1,
        DailyAnalytics.location_id == location_id
    ).all()
    ly_map = {a.date.day: a for a in last_year}
    
    days = []
    for a in analytics:
        ly = ly_map.get(a.date.day)
        days.append({
            "date": str(a.date.date()) if hasattr(a.date, 'date') else str(a.date),
            "foot_traffic": a.foot_traffic,
            "unique_visitors": a.unique_visitors,
            "revenue": a.total_revenue,
            "conversion_rate": a.conversion_rate,
            "peak_hour": a.peak_hour,
            "incidents": a.incidents_count,
            "yoy_traffic": a.yoy_traffic_change,
            "yoy_revenue": a.yoy_revenue_change,
            "ai_summary": a.ai_summary,
            "last_year_traffic": ly.foot_traffic if ly else None,
            "last_year_revenue": ly.total_revenue if ly else None,
        })
    
    total_traffic = sum(a.foot_traffic for a in analytics)
    total_revenue = sum(a.total_revenue for a in analytics)
    
    return {
        "month": month,
        "year": year,
        "days": days,
        "summary": {
            "total_traffic": total_traffic,
            "total_revenue": total_revenue,
            "avg_daily_traffic": round(total_traffic / max(len(analytics), 1)),
            "avg_daily_revenue": round(total_revenue / max(len(analytics), 1), 2),
            "best_day": max(days, key=lambda d: d["foot_traffic"])["date"] if days else None,
        }
    }


@router.get("/visitors/known")
def get_known_visitors(location_id: int = 1, db: Session = Depends(get_db)):
    """List visitors recognized as clerks (excluded from count)"""
    visitors = db.query(TrafficVisitor).filter(
        TrafficVisitor.is_staff == True,
        TrafficVisitor.location_id == location_id
    ).all()
    return [{"id": v.id, "person_id": v.person_id, "name": f"Staff #{v.person_id}"} for v in visitors]
