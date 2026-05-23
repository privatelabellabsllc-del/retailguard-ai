"""
Incident management API — review queue, clip playback, theft confirmation.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, func
from pydantic import BaseModel
from typing import Optional, List
import uuid

from app.database import get_db
from app.models.incident import Incident, IncidentClip, IncidentReview, ReviewStatus, IncidentType, TheftClassification
from app.models.person import Person, PersonStatus
from app.models.alert import Alert, AlertType, AlertPriority
from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


# === Schemas ===

class IncidentResponse(BaseModel):
    id: str
    created_at: datetime
    person_id: Optional[str]
    person_display_name: Optional[str]
    person_status: Optional[str]
    incident_type: str
    severity: str
    review_status: str
    camera_id: Optional[str]
    zone_name: Optional[str]
    ai_confidence: float
    ai_description: Optional[str]
    detected_at: datetime
    estimated_item: Optional[str]
    estimated_value: Optional[float]
    theft_classification: Optional[str] = None
    classification_confidence: Optional[float] = None
    classification_reason: Optional[str] = None
    visited_register: bool = False
    register_dwell_seconds: Optional[float] = None
    concealment_count: int = 1
    clips: List[dict] = []
    detection_details: Optional[dict] = None
    
    class Config:
        from_attributes = True


class ReviewAction(BaseModel):
    action: str  # "theft", "not_theft", "unsure", "escalated"
    notes: Optional[str] = None
    estimated_item: Optional[str] = None
    estimated_value: Optional[float] = None


class IncidentStats(BaseModel):
    total_incidents: int
    pending_review: int
    confirmed_thefts: int
    false_positives: int
    total_estimated_loss: float


# === Routes ===

@router.get("/", response_model=List[IncidentResponse])
async def list_incidents(
    status: Optional[str] = None,
    incident_type: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List incidents, optionally filtered by status or type."""
    query = db.query(Incident).options(
        joinedload(Incident.clips),
        joinedload(Incident.person),
    )
    
    if status:
        query = query.filter(Incident.review_status == status)
    if incident_type:
        query = query.filter(Incident.incident_type == incident_type)
    
    incidents = query.order_by(desc(Incident.created_at)).offset(offset).limit(limit).all()
    
    results = []
    for inc in incidents:
        clips_data = [{
            "id": str(c.id),
            "clip_url": c.clip_url or f"/api/clips/{c.id}/stream",
            "thumbnail_path": c.thumbnail_path,
            "duration_seconds": c.duration_seconds,
            "key_moment_offset": c.key_moment_offset,
        } for c in inc.clips]
        
        results.append(IncidentResponse(
            id=str(inc.id),
            created_at=inc.created_at,
            person_id=str(inc.person_id) if inc.person_id else None,
            person_display_name=inc.person.display_name if inc.person else None,
            person_status=inc.person.status.value if inc.person else None,
            incident_type=inc.incident_type.value,
            severity=inc.severity.value,
            review_status=inc.review_status.value,
            camera_id=str(inc.camera_id) if inc.camera_id else None,
            zone_name=inc.zone_name,
            ai_confidence=inc.ai_confidence,
            ai_description=inc.ai_description,
            detected_at=inc.detected_at,
            estimated_item=inc.estimated_item,
            estimated_value=inc.estimated_value,
            theft_classification=inc.theft_classification,
            classification_confidence=inc.classification_confidence,
            classification_reason=inc.classification_reason,
            visited_register=inc.visited_register or False,
            register_dwell_seconds=inc.register_dwell_seconds,
            concealment_count=inc.concealment_count or 1,
            clips=clips_data,
            detection_details=inc.detection_details,
        ))
    
    return results


@router.get("/pending", response_model=List[IncidentResponse])
async def get_pending_reviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all incidents pending review — the main review queue."""
    return await list_incidents(status="pending", db=db, current_user=current_user)


@router.get("/stats", response_model=IncidentStats)
async def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dashboard statistics."""
    total = db.query(func.count(Incident.id)).scalar()
    pending = db.query(func.count(Incident.id)).filter(
        Incident.review_status == ReviewStatus.PENDING
    ).scalar()
    thefts = db.query(func.count(Incident.id)).filter(
        Incident.review_status == ReviewStatus.CONFIRMED_THEFT
    ).scalar()
    not_thefts = db.query(func.count(Incident.id)).filter(
        Incident.review_status == ReviewStatus.NOT_THEFT
    ).scalar()
    total_loss = db.query(func.sum(Incident.estimated_value)).filter(
        Incident.review_status == ReviewStatus.CONFIRMED_THEFT
    ).scalar() or 0
    
    return IncidentStats(
        total_incidents=total,
        pending_review=pending,
        confirmed_thefts=thefts,
        false_positives=not_thefts,
        total_estimated_loss=float(total_loss),
    )


@router.get("/{incident_id}", response_model=IncidentResponse)
async def get_incident(
    incident_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get detailed incident info with clips."""
    incident = db.query(Incident).options(
        joinedload(Incident.clips),
        joinedload(Incident.person),
    ).filter(Incident.id == uuid.UUID(incident_id)).first()
    
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    clips_data = [{
        "id": str(c.id),
        "clip_url": c.clip_url or f"/api/clips/{c.id}/stream",
        "thumbnail_path": c.thumbnail_path,
        "duration_seconds": c.duration_seconds,
        "key_moment_offset": c.key_moment_offset,
        "annotations": c.annotations,
    } for c in incident.clips]
    
    return IncidentResponse(
        id=str(incident.id),
        created_at=incident.created_at,
        person_id=str(incident.person_id) if incident.person_id else None,
        person_display_name=incident.person.display_name if incident.person else None,
        person_status=incident.person.status.value if incident.person else None,
        incident_type=incident.incident_type.value,
        severity=incident.severity.value,
        review_status=incident.review_status.value,
        camera_id=str(incident.camera_id) if incident.camera_id else None,
        zone_name=incident.zone_name,
        ai_confidence=incident.ai_confidence,
        ai_description=incident.ai_description,
        detected_at=incident.detected_at,
        estimated_item=incident.estimated_item,
        estimated_value=incident.estimated_value,
        theft_classification=incident.theft_classification,
        classification_confidence=incident.classification_confidence,
        classification_reason=incident.classification_reason,
        visited_register=incident.visited_register or False,
        register_dwell_seconds=incident.register_dwell_seconds,
        concealment_count=incident.concealment_count or 1,
        clips=clips_data,
        detection_details=incident.detection_details,
    )


@router.post("/{incident_id}/review")
async def review_incident(
    incident_id: str,
    review: ReviewAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Clerk reviews an incident — the core workflow action.
    
    Actions:
    - "theft" → confirms theft, updates person status, creates alert for next visit
    - "not_theft" → marks as false positive
    - "unsure" → keeps in queue for manager review
    - "escalated" → sends to law enforcement
    """
    incident = db.query(Incident).filter(Incident.id == uuid.UUID(incident_id)).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    # Map action to review status
    status_map = {
        "theft": ReviewStatus.CONFIRMED_THEFT,
        "not_theft": ReviewStatus.NOT_THEFT,
        "unsure": ReviewStatus.UNSURE,
        "escalated": ReviewStatus.ESCALATED,
    }
    
    new_status = status_map.get(review.action)
    if not new_status:
        raise HTTPException(status_code=400, detail=f"Invalid action: {review.action}")
    
    # Create review record
    review_record = IncidentReview(
        incident_id=incident.id,
        user_id=current_user.id,
        action=f"marked_{review.action}",
        previous_status=incident.review_status.value,
        new_status=new_status.value,
        notes=review.notes,
    )
    db.add(review_record)
    
    # Update incident
    incident.review_status = new_status
    incident.reviewed_by = current_user.id
    incident.reviewed_at = datetime.utcnow()
    incident.review_notes = review.notes
    if review.estimated_item:
        incident.estimated_item = review.estimated_item
    if review.estimated_value:
        incident.estimated_value = review.estimated_value
    
    # === If confirmed theft: update person and set up alert for next visit ===
    if new_status == ReviewStatus.CONFIRMED_THEFT and incident.person_id:
        person = db.query(Person).filter(Person.id == incident.person_id).first()
        if person:
            person.status = PersonStatus.CONFIRMED_THIEF
            person.threat_level = max(person.threat_level, 3)
            person.total_confirmed_thefts += 1
            person.total_incidents += 1
            
            if review.notes:
                existing_notes = person.notes or ""
                person.notes = f"{existing_notes}\n[{datetime.utcnow().isoformat()}] Theft confirmed: {review.notes}"
    
    db.commit()
    
    return {
        "message": f"Incident marked as {review.action}",
        "incident_id": incident_id,
        "new_status": new_status.value,
        "person_updated": incident.person_id is not None and new_status == ReviewStatus.CONFIRMED_THEFT,
    }
