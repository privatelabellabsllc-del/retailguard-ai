"""
Alerts API — real-time alert management and clerk action panel.
Handles the critical workflow: offender detected → alert clerk → clerk action.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from pydantic import BaseModel
from typing import Optional, List
import uuid
import json
import asyncio

from app.database import get_db
from app.models.alert import Alert, AlertAction, AlertType, AlertPriority, AlertStatus, ClerkAction
from app.models.person import Person, PersonStatus
from app.models.incident import Incident
from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


# === WebSocket manager for real-time alerts ===
class AlertManager:
    """Manages WebSocket connections for real-time alert push."""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
    
    async def broadcast_alert(self, alert_data: dict):
        """Push alert to all connected clerk screens."""
        for connection in self.active_connections:
            try:
                await connection.send_json(alert_data)
            except Exception:
                pass

alert_manager = AlertManager()


# === Schemas ===

class AlertResponse(BaseModel):
    id: str
    created_at: datetime
    person_id: str
    person_display_name: Optional[str]
    person_status: str
    person_threat_level: int
    person_total_thefts: int
    alert_type: str
    priority: str
    status: str
    title: str
    message: Optional[str]
    tracking_active: bool
    current_camera_id: Optional[str]
    reference_clip_url: Optional[str]
    current_snapshot_path: Optional[str]
    match_confidence: Optional[float]
    match_details: Optional[dict]
    best_portrait_path: Optional[str]
    
    class Config:
        from_attributes = True


class ClerkActionRequest(BaseModel):
    action: str  # "call_police", "let_go", "blacklist", "monitor", "confront"
    notes: Optional[str] = None
    police_report_number: Optional[str] = None


class AlertCreate(BaseModel):
    person_id: str
    alert_type: str
    camera_id: Optional[str] = None
    match_confidence: Optional[float] = None
    match_details: Optional[dict] = None


# === Routes ===

@router.websocket("/ws")
async def alert_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for real-time alerts.
    Clerk dashboard connects here to receive instant notifications.
    """
    await alert_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, receive any clerk messages
            data = await websocket.receive_text()
            # Handle ping/pong or acknowledgments
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        alert_manager.disconnect(websocket)


@router.get("/active", response_model=List[AlertResponse])
async def get_active_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all active (unresolved) alerts — shown on clerk dashboard."""
    alerts = db.query(Alert).options(
        joinedload(Alert.person),
    ).filter(
        Alert.status.in_([AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED])
    ).order_by(desc(Alert.priority), desc(Alert.created_at)).all()
    
    return [_format_alert(a) for a in alerts]


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(
    alert_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get detailed alert info including person history and reference video."""
    alert = db.query(Alert).options(
        joinedload(Alert.person),
    ).filter(Alert.id == uuid.UUID(alert_id)).first()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return _format_alert(alert)


@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Clerk acknowledges they've seen the alert."""
    alert = db.query(Alert).filter(Alert.id == uuid.UUID(alert_id)).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.status = AlertStatus.ACKNOWLEDGED
    alert.acknowledged_by = current_user.id
    alert.acknowledged_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Alert acknowledged", "alert_id": alert_id}


@router.post("/{alert_id}/action")
async def take_action(
    alert_id: str,
    action_req: ClerkActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Clerk takes action on an alert. This is the critical decision point:
    
    🚔 call_police — Mark for police response, generate evidence package
    🤚 let_go — Release the person, log the decision
    ⛔ blacklist — Permanently ban, auto-detect on all future visits
    👁️ monitor — Keep watching but don't confront
    📺 confront — Show the customer their theft video on screen
    """
    alert = db.query(Alert).options(
        joinedload(Alert.person),
    ).filter(Alert.id == uuid.UUID(alert_id)).first()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    # Validate action
    try:
        clerk_action = ClerkAction(action_req.action)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid action: {action_req.action}")
    
    # Record action
    alert_action = AlertAction(
        alert_id=alert.id,
        user_id=current_user.id,
        action=clerk_action,
        notes=action_req.notes,
    )
    
    response_data = {
        "message": f"Action '{action_req.action}' recorded",
        "alert_id": alert_id,
    }
    
    # === Handle specific actions ===
    
    if clerk_action == ClerkAction.CALL_POLICE:
        alert_action.police_called_at = datetime.utcnow()
        if action_req.police_report_number:
            alert_action.police_report_number = action_req.police_report_number
        
        # Auto-generate evidence package
        evidence_path = f"/clips/evidence/{alert_id}_evidence_package.pdf"
        alert_action.evidence_package_path = evidence_path
        response_data["evidence_package"] = evidence_path
        response_data["show_911_prompt"] = True
    
    elif clerk_action == ClerkAction.PAID:
        # Customer agreed to pay for stolen items
        if alert.person:
            notes = alert.person.notes or ""
            alert.person.notes = f"{notes}\n[{datetime.utcnow().isoformat()}] PAID for stolen items — resolved by {current_user.full_name or current_user.username}"
            # Reduce threat level but keep record
            if alert.person.threat_level > 1:
                alert.person.threat_level -= 1
            response_data["paid"] = True
    
    elif clerk_action == ClerkAction.BLACKLIST:
        # Update person status to blacklisted
        if alert.person:
            alert.person.status = PersonStatus.BLACKLISTED
            alert.person.threat_level = 4  # Critical
            notes = alert.person.notes or ""
            alert.person.notes = f"{notes}\n[{datetime.utcnow().isoformat()}] BLACKLISTED by {current_user.full_name or current_user.username}"
            response_data["person_blacklisted"] = True
    
    elif clerk_action == ClerkAction.LET_GO:
        response_data["released"] = True
    
    elif clerk_action == ClerkAction.CONFRONT:
        # Trigger customer-facing display to show theft video
        response_data["show_on_display"] = True
        response_data["display_clip_url"] = alert.reference_clip_url
        response_data["show_call_911_badge"] = True
    
    elif clerk_action == ClerkAction.MONITOR:
        response_data["tracking_continued"] = True
    
    # Resolve alert
    alert.status = AlertStatus.RESOLVED
    alert.resolved_at = datetime.utcnow()
    
    db.add(alert_action)
    db.commit()
    
    # Broadcast update to other connected screens
    await alert_manager.broadcast_alert({
        "type": "alert_resolved",
        "alert_id": alert_id,
        "action": action_req.action,
    })
    
    return response_data


@router.post("/create")
async def create_alert(
    alert_data: AlertCreate,
    db: Session = Depends(get_db),
):
    """
    Internal endpoint — called by AI pipeline when a known offender/blacklisted person is detected.
    """
    person = db.query(Person).filter(Person.id == uuid.UUID(alert_data.person_id)).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    # Determine alert type and priority
    if person.status == PersonStatus.BLACKLISTED:
        alert_type = AlertType.BLACKLISTED_ENTERED
        priority = AlertPriority.CRITICAL
        title = f"⛔ BLACKLISTED PERSON DETECTED"
        message = (
            f"{person.display_name or 'Unknown individual'} has entered the store. "
            f"This person is BLACKLISTED. {person.total_confirmed_thefts} prior confirmed thefts."
        )
    elif person.status == PersonStatus.CONFIRMED_THIEF:
        alert_type = AlertType.KNOWN_THIEF_ENTERED
        priority = AlertPriority.HIGH
        title = f"⚠️ KNOWN THIEF DETECTED"
        message = (
            f"{person.display_name or 'Unknown individual'} has entered the store. "
            f"Last theft: {person.last_seen}. {person.total_confirmed_thefts} confirmed thefts."
        )
    else:
        alert_type = AlertType.SUSPICIOUS_BEHAVIOR
        priority = AlertPriority.MEDIUM
        title = f"👁️ Person of Interest Detected"
        message = f"{person.display_name or 'Unknown individual'} detected. Previously flagged."
    
    # Find the latest theft incident for reference video
    latest_theft = db.query(Incident).filter(
        Incident.person_id == person.id,
        Incident.review_status == "theft",
    ).order_by(Incident.detected_at.desc()).first()
    
    reference_clip_url = None
    reference_incident_id = None
    if latest_theft and latest_theft.clips:
        reference_clip_url = latest_theft.clips[0].clip_url
        reference_incident_id = latest_theft.id
    
    # Create alert
    alert = Alert(
        person_id=person.id,
        alert_type=alert_type,
        priority=priority,
        title=title,
        message=message,
        camera_id=uuid.UUID(alert_data.camera_id) if alert_data.camera_id else None,
        current_camera_id=uuid.UUID(alert_data.camera_id) if alert_data.camera_id else None,
        tracking_active=True,
        reference_incident_id=reference_incident_id,
        reference_clip_url=reference_clip_url,
        match_confidence=alert_data.match_confidence,
        match_details=alert_data.match_details,
        current_snapshot_path=person.best_portrait_path,
    )
    
    db.add(alert)
    db.commit()
    db.refresh(alert)
    
    # Push to connected clerk screens via WebSocket
    alert_push = {
        "type": "new_alert",
        "alert": {
            "id": str(alert.id),
            "alert_type": alert_type.value,
            "priority": priority.value,
            "title": title,
            "message": message,
            "person_id": str(person.id),
            "person_name": person.display_name,
            "person_status": person.status.value,
            "threat_level": person.threat_level,
            "total_thefts": person.total_confirmed_thefts,
            "portrait_path": person.best_portrait_path,
            "reference_clip_url": reference_clip_url,
            "match_confidence": alert_data.match_confidence,
            "match_details": alert_data.match_details,
            "tracking_active": True,
        }
    }
    await alert_manager.broadcast_alert(alert_push)
    
    return {"alert_id": str(alert.id), "pushed_to_screens": len(alert_manager.active_connections)}


def _format_alert(alert: Alert) -> AlertResponse:
    """Format alert for API response."""
    person = alert.person
    return AlertResponse(
        id=str(alert.id),
        created_at=alert.created_at,
        person_id=str(alert.person_id) if alert.person_id else "",
        person_display_name=person.display_name if person else None,
        person_status=person.status.value if person else "unknown",
        person_threat_level=person.threat_level if person else 0,
        person_total_thefts=person.total_confirmed_thefts if person else 0,
        alert_type=alert.alert_type.value,
        priority=alert.priority.value,
        status=alert.status.value,
        title=alert.title,
        message=alert.message,
        tracking_active=alert.tracking_active,
        current_camera_id=str(alert.current_camera_id) if alert.current_camera_id else None,
        reference_clip_url=alert.reference_clip_url,
        current_snapshot_path=alert.current_snapshot_path,
        match_confidence=alert.match_confidence,
        match_details=alert.match_details,
        best_portrait_path=person.best_portrait_path if person else None,
    )
