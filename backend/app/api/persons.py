"""
Persons API — manage tracked individuals, offenders, blacklist.
Supports manual entry of personal info and ID photo upload.
"""
import os
import uuid
import shutil
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from typing import Optional, List

from app.database import get_db
from app.models.person import Person, PersonStatus, PersonSighting
from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/persons", tags=["persons"])

UPLOAD_DIR = "/app/uploads/id_photos"
os.makedirs(UPLOAD_DIR, exist_ok=True)


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
    # Manual info fields
    full_name: Optional[str]
    date_of_birth: Optional[str]
    address: Optional[str]
    phone_number: Optional[str]
    drivers_license: Optional[str]
    id_photo_path: Optional[str]
    id_type: Optional[str]
    
    class Config:
        from_attributes = True


class PersonUpdate(BaseModel):
    display_name: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    full_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    address: Optional[str] = None
    phone_number: Optional[str] = None
    drivers_license: Optional[str] = None
    id_type: Optional[str] = None
    estimated_age_range: Optional[str] = None
    estimated_gender: Optional[str] = None
    estimated_height_cm: Optional[float] = None
    estimated_build: Optional[str] = None
    hair_description: Optional[str] = None


class PersonCreate(BaseModel):
    display_name: Optional[str] = None
    full_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    address: Optional[str] = None
    phone_number: Optional[str] = None
    drivers_license: Optional[str] = None
    id_type: Optional[str] = None
    status: Optional[str] = "known"
    threat_level: Optional[int] = 0
    notes: Optional[str] = None
    estimated_age_range: Optional[str] = None
    estimated_gender: Optional[str] = None
    estimated_height_cm: Optional[float] = None
    estimated_build: Optional[str] = None
    hair_description: Optional[str] = None


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
        query = query.filter(
            (Person.display_name.ilike(f"%{search}%")) |
            (Person.full_name.ilike(f"%{search}%")) |
            (Person.drivers_license.ilike(f"%{search}%"))
        )
    
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


@router.post("/", response_model=PersonResponse)
async def create_person(
    person_data: PersonCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually create a person record — for when clerk enters info from an ID."""
    person = Person(
        display_name=person_data.display_name or person_data.full_name or "Unknown",
        full_name=person_data.full_name,
        date_of_birth=person_data.date_of_birth,
        address=person_data.address,
        phone_number=person_data.phone_number,
        drivers_license=person_data.drivers_license,
        id_type=person_data.id_type,
        status=PersonStatus(person_data.status) if person_data.status else PersonStatus.KNOWN,
        threat_level=person_data.threat_level or 0,
        notes=person_data.notes,
        estimated_age_range=person_data.estimated_age_range,
        estimated_gender=person_data.estimated_gender,
        estimated_height_cm=person_data.estimated_height_cm,
        estimated_build=person_data.estimated_build,
        hair_description=person_data.hair_description,
    )
    db.add(person)
    db.commit()
    db.refresh(person)
    return _format_person(person)


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
    """Update person details — name, notes, status, personal info."""
    person = db.query(Person).filter(Person.id == uuid.UUID(person_id)).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "status":
            try:
                person.status = PersonStatus(value)
                if value == "blacklisted":
                    person.threat_level = 4
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid status: {value}")
        else:
            setattr(person, field, value)
    
    person.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(person)
    return _format_person(person)


@router.post("/{person_id}/id-photo")
async def upload_id_photo(
    person_id: str,
    file: UploadFile = File(...),
    id_type: str = Form(default="drivers_license"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a photo of the person's ID (driver's license, state ID, etc.)."""
    person = db.query(Person).filter(Person.id == uuid.UUID(person_id)).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    # Save file
    ext = file.filename.split(".")[-1] if file.filename else "jpg"
    filename = f"{person_id}_id.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)
    
    person.id_photo_path = f"/uploads/id_photos/{filename}"
    person.id_type = id_type
    person.updated_at = datetime.utcnow()
    db.commit()
    
    return {
        "message": "ID photo uploaded",
        "id_photo_path": person.id_photo_path,
        "id_type": id_type,
    }


@router.post("/{person_id}/portrait")
async def upload_portrait(
    person_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a portrait photo for a person."""
    person = db.query(Person).filter(Person.id == uuid.UUID(person_id)).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    portrait_dir = "/app/uploads/portraits"
    os.makedirs(portrait_dir, exist_ok=True)
    
    ext = file.filename.split(".")[-1] if file.filename else "jpg"
    filename = f"{person_id}_portrait.{ext}"
    filepath = os.path.join(portrait_dir, filename)
    
    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)
    
    person.best_portrait_path = f"/uploads/portraits/{filename}"
    person.updated_at = datetime.utcnow()
    db.commit()
    
    return {
        "message": "Portrait uploaded",
        "portrait_path": person.best_portrait_path,
    }


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


@router.delete("/{person_id}")
async def delete_person(
    person_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a person record."""
    person = db.query(Person).filter(Person.id == uuid.UUID(person_id)).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    db.delete(person)
    db.commit()
    return {"message": "Person deleted", "person_id": person_id}


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
        full_name=p.full_name,
        date_of_birth=p.date_of_birth,
        address=p.address,
        phone_number=p.phone_number,
        drivers_license=p.drivers_license,
        id_photo_path=p.id_photo_path,
        id_type=p.id_type,
    )
