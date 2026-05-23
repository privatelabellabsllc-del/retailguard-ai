from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import Optional, List
from pydantic import BaseModel
from app.database import get_db
from app.models.team import Shift, PerformanceMetric, PerformanceReview
from app.models.user import User

router = APIRouter(prefix="/api/team", tags=["Team"])


class ShiftCreate(BaseModel):
    user_id: int
    location_id: int = 1
    scheduled_start: str
    scheduled_end: str


class ClockInRequest(BaseModel):
    user_id: int
    location_id: int = 1


class ReviewAction(BaseModel):
    action: str  # approve, reject, edit
    notes: Optional[str] = None


class ReviewSettingsUpdate(BaseModel):
    auto_send_mode: str  # manual, auto_good, full_auto
    auto_send_threshold: int = 75


@router.get("/members")
def get_team_members(location_id: int = 1, db: Session = Depends(get_db)):
    users = db.query(User).filter(
        User.is_active == True,
        (User.location_id == location_id) | (User.role == "owner")
    ).all()
    
    members = []
    for u in users:
        current_shift = db.query(Shift).filter(
            Shift.user_id == u.id,
            Shift.actual_start != None,
            Shift.actual_end == None
        ).first()
        
        members.append({
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name or u.username,
            "role": u.role,
            "email": u.email,
            "phone": u.phone,
            "avatar_url": u.avatar_url,
            "is_clocked_in": current_shift is not None,
            "current_shift_start": str(current_shift.actual_start) if current_shift else None,
            "last_login": str(u.last_login) if u.last_login else None,
        })
    
    return {"members": members, "total": len(members)}


@router.post("/shifts")
def create_shift(data: ShiftCreate, db: Session = Depends(get_db)):
    shift = Shift(
        user_id=data.user_id,
        location_id=data.location_id,
        scheduled_start=datetime.fromisoformat(data.scheduled_start),
        scheduled_end=datetime.fromisoformat(data.scheduled_end),
        status="scheduled"
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return {"id": shift.id, "status": "scheduled"}


@router.post("/clock-in")
def clock_in(data: ClockInRequest, db: Session = Depends(get_db)):
    # Find scheduled shift or create ad-hoc
    now = datetime.utcnow()
    shift = db.query(Shift).filter(
        Shift.user_id == data.user_id,
        Shift.status == "scheduled",
        Shift.scheduled_start <= now + timedelta(minutes=15),
        Shift.scheduled_end >= now
    ).first()
    
    if not shift:
        shift = Shift(
            user_id=data.user_id,
            location_id=data.location_id,
            scheduled_start=now,
            scheduled_end=now + timedelta(hours=8),
            status="active"
        )
        db.add(shift)
    
    shift.actual_start = now
    shift.status = "active"
    
    if shift.scheduled_start:
        diff = (now - shift.scheduled_start).total_seconds() / 60
        if diff > 5:
            shift.is_late = True
            shift.late_minutes = int(diff)
    
    db.commit()
    db.refresh(shift)
    return {"shift_id": shift.id, "status": "clocked_in", "is_late": shift.is_late}


@router.post("/clock-out")
def clock_out(data: ClockInRequest, db: Session = Depends(get_db)):
    shift = db.query(Shift).filter(
        Shift.user_id == data.user_id,
        Shift.status == "active"
    ).first()
    
    if not shift:
        raise HTTPException(status_code=404, detail="No active shift found")
    
    now = datetime.utcnow()
    shift.actual_end = now
    shift.status = "completed"
    
    if shift.actual_start:
        total = (now - shift.actual_start).total_seconds() / 3600
        shift.total_hours = round(total, 2)
        if shift.scheduled_end and now > shift.scheduled_end:
            overtime = (now - shift.scheduled_end).total_seconds() / 3600
            shift.overtime_hours = round(overtime, 2)
    
    db.commit()
    return {"shift_id": shift.id, "status": "completed", "total_hours": shift.total_hours}


@router.get("/shifts")
def get_shifts(
    user_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    location_id: int = 1,
    db: Session = Depends(get_db)
):
    q = db.query(Shift).filter(Shift.location_id == location_id)
    if user_id:
        q = q.filter(Shift.user_id == user_id)
    if start_date:
        q = q.filter(Shift.scheduled_start >= datetime.fromisoformat(start_date))
    if end_date:
        q = q.filter(Shift.scheduled_end <= datetime.fromisoformat(end_date))
    
    shifts = q.order_by(Shift.scheduled_start.desc()).limit(100).all()
    return {
        "shifts": [{
            "id": s.id,
            "user_id": s.user_id,
            "status": s.status,
            "scheduled_start": str(s.scheduled_start) if s.scheduled_start else None,
            "scheduled_end": str(s.scheduled_end) if s.scheduled_end else None,
            "actual_start": str(s.actual_start) if s.actual_start else None,
            "actual_end": str(s.actual_end) if s.actual_end else None,
            "total_hours": s.total_hours,
            "is_late": s.is_late,
            "late_minutes": s.late_minutes,
            "overtime_hours": s.overtime_hours,
        } for s in shifts]
    }


@router.get("/performance/{user_id}")
def get_performance(user_id: int, days: int = 30, db: Session = Depends(get_db)):
    since = datetime.utcnow() - timedelta(days=days)
    metrics = db.query(PerformanceMetric).filter(
        PerformanceMetric.user_id == user_id,
        PerformanceMetric.date >= since
    ).order_by(PerformanceMetric.date.desc()).all()
    
    if not metrics:
        return {"user_id": user_id, "period_days": days, "metrics": [], "summary": None}
    
    summary = {
        "avg_transaction_speed": round(sum(m.avg_transaction_seconds or 0 for m in metrics) / len(metrics), 1),
        "avg_transactions_per_hour": round(sum(m.transactions_per_hour or 0 for m in metrics) / len(metrics), 1),
        "total_transactions": sum(m.total_transactions or 0 for m in metrics),
        "avg_customer_greeting_rate": round(sum(m.customer_greeting_rate or 0 for m in metrics) / len(metrics), 1),
        "total_void_count": sum(m.void_count or 0 for m in metrics),
        "avg_revenue_per_hour": round(sum(m.revenue_per_hour or 0 for m in metrics) / len(metrics), 2),
        "on_time_rate": round(sum(1 for m in metrics if not m.late_arrival) / len(metrics) * 100, 1),
        "overall_score": round(sum(m.overall_score or 0 for m in metrics) / len(metrics), 1),
    }
    
    return {
        "user_id": user_id,
        "period_days": days,
        "metrics": [{
            "date": str(m.date.date()) if hasattr(m.date, 'date') else str(m.date),
            "overall_score": m.overall_score,
            "transactions_per_hour": m.transactions_per_hour,
            "avg_transaction_seconds": m.avg_transaction_seconds,
            "revenue_per_hour": m.revenue_per_hour,
            "customer_greeting_rate": m.customer_greeting_rate,
        } for m in metrics[:30]],
        "summary": summary,
    }


@router.get("/reviews")
def get_reviews(
    status: Optional[str] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    q = db.query(PerformanceReview)
    if status:
        q = q.filter(PerformanceReview.status == status)
    if user_id:
        q = q.filter(PerformanceReview.user_id == user_id)
    
    reviews = q.order_by(PerformanceReview.created_at.desc()).limit(50).all()
    return {
        "reviews": [{
            "id": r.id,
            "user_id": r.user_id,
            "period_start": str(r.period_start),
            "period_end": str(r.period_end),
            "overall_score": r.overall_score,
            "speed_score": r.speed_score,
            "accuracy_score": r.accuracy_score,
            "service_score": r.service_score,
            "reliability_score": r.reliability_score,
            "highlights": r.highlights,
            "improvements": r.improvements,
            "ai_summary": r.ai_summary,
            "status": r.status,
            "auto_send": r.auto_send,
            "sent_at": str(r.sent_at) if r.sent_at else None,
        } for r in reviews]
    }


@router.post("/reviews/{review_id}/action")
def review_action(review_id: int, data: ReviewAction, db: Session = Depends(get_db)):
    review = db.query(PerformanceReview).filter(PerformanceReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    if data.action == "approve":
        review.status = "sent"
        review.sent_at = datetime.utcnow()
    elif data.action == "reject":
        review.status = "rejected"
    
    if data.notes:
        review.manager_notes = data.notes
    
    db.commit()
    return {"id": review.id, "status": review.status}
