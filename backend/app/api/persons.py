"""
Persons API — manage tracked individuals, offenders, blacklist.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from typing import Optional, List
import uuid

from app.database import get_db
from app.models.person import Person, PersonStatus, PersonSighting
from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/persons", tags=["persons"])


class PersonResponse(BaseModel):
    id: str
    status: str
    threat_level: int
    display_name: Optional[str]
    notes: Optional[str]
    estimated_age_range: Optional[str]
    estimated_gender: Optional[str]
    estimated_height_cm: Optional[float]
    estimated_build: Optional[str]
    hair_description: Optional[str]
    best_portrait_path: Optional[str]
    total_visits: int
    total_incidents: int
    total_confirmed_thefts: int
    first_seen: Optional[datetime]
    last_seen: Optional[datetime]
    
    class Config:
        from_attributes = True


class PersonUpdate(BaseModel):
    display_name: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


@router.get("/", response_model=List[PersonResponse])
async def list_persons(
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all tracked persons, filterable by status."""
    query = db.query(Person)
    
    if status:
        query = query.filter(Person.status == status)
    if search:
        query = query.filter(Person.display_name.ilike(f"%{search}%"))
    
    persons = query.order_by(desc(Person.last_seen)).offset(offset).limit(limit).all()
    return [_format_person(p) for p in persons]


@router.get("/offenders", response_model=List[PersonResponse])
async def list_offenders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all confirmed thieves and blacklisted persons."""
    persons = db.query(Person).filter(
        Person.status.in_([PersonStatus.CONFIRMED_THIEF, PersonStatus.BLACKLISTED])
    ).order_by(desc(Person.threat_level), desc(Person.total_confirmed_thefts)).all()
    return [_format_person(p) for p in persons]


@router.get("/blacklist", response_model=List[PersonResponse])
async def get_blacklist(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all blacklisted persons."""
    persons = db.query(Person).filter(
        Person.status == PersonStatus.BLACKLISTED
    ).order_by(desc(Person.last_seen)).all()
    return [_format_person(p) for p in persons]


@router.get("/{person_id}", response_model=PersonResponse)
async def get_person(
    person_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    person = db.query(Person).filter(Person.id == uuid.UUID(person_id)).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    return _format_person(person)


@router.patch("/{person_id}", response_model=PersonResponse)
async def update_person(
    person_id: str,
    update: PersonUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update person details — name, notes, status."""
    person = db.query(Person).filter(Person.id == uuid.UUID(person_id)).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    if update.display_name is not None:
        person.display_name = update.display_name
    if update.notes is not None:
        person.notes = update.notes
    if update.status is not None:
        try:
            person.status = PersonStatus(update.status)
            if update.status == "blacklisted":
                person.threat_level = 4
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {update.status}")
    
    person.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(person)
    return _format_person(person)


@router.post("/{person_id}/blacklist")
async def blacklist_person(
    person_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Blacklist a person — they'll be auto-detected and alerted on every visit."""
    person = db.query(Person).filter(Person.id == uuid.UUID(person_id)).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    person.status = PersonStatus.BLACKLISTED
    person.threat_level = 4
    notes = person.notes or ""
    person.notes = f"{notes}\n[{datetime.utcnow().isoformat()}] BLACKLISTED by {current_user.full_name or current_user.username}"
    db.commit()
    
    return {"message": "Person blacklisted", "person_id": person_id}


@router.get("/{person_id}/sightings")
async def get_sightings(
    person_id: str,
    limit: int = Query(default=20, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get visit history for a person."""
    sightings = db.query(PersonSighting).filter(
        PersonSighting.person_id == uuid.UUID(person_id)
    ).order_by(desc(PersonSighting.timestamp)).limit(limit).all()
    
    return [{
        "id": str(s.id),
        "timestamp": s.timestamp.isoformat(),
        "match_confidence": s.match_confidence,
        "face_score": s.face_match_score,
        "body_score": s.body_match_score,
        "snapshot_path": s.snapshot_path,
        "zones_visited": s.zones_visited,
        "entered_at": s.entered_at.isoformat() if s.entered_at else None,
        "exited_at": s.exited_at.isoformat() if s.exited_at else None,
    } for s in sightings]


def _format_person(p: Person) -> PersonResponse:
    return PersonResponse(
        id=str(p.id),
        status=p.status.value,
        threat_level=p.threat_level,
        display_name=p.display_name,
        notes=p.notes,
        estimated_age_range=p.estimated_age_range,
        estimated_gender=p.estimated_gender,
        estimated_height_cm=p.estimated_height_cm,
        estimated_build=p.estimated_build,
        hair_description=p.hair_description,
        best_portrait_path=p.best_portrait_path,
        total_visits=p.total_visits,
        total_incidents=p.total_incidents,
        total_confirmed_thefts=p.total_confirmed_thefts,
        first_seen=p.first_seen,
        last_seen=p.last_seen,
    )
