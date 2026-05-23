from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from passlib.context import CryptContext
from app.database import get_db
from app.models.cash import CashSession, CashTransaction, CashAlert
from app.models.user import User

router = APIRouter(prefix="/api/cash", tags=["Cash Management"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class PinVerify(BaseModel):
    user_id: int
    pin: str


class SessionOpen(BaseModel):
    user_id: int
    pin: str
    register_id: str
    opening_amount: float
    location_id: int = 1


class SessionClose(BaseModel):
    user_id: int
    pin: str
    closing_amount: float
    notes: Optional[str] = None


class TransactionCreate(BaseModel):
    session_id: int
    transaction_type: str
    amount: float
    payment_method: str = "cash"
    receipt_number: Optional[str] = None


class PinSet(BaseModel):
    user_id: int
    new_pin: str
    current_password: str


def verify_pin(user: User, pin: str) -> bool:
    if not user.pin_code:
        return False
    return pwd_context.verify(pin, user.pin_code)


@router.post("/verify-pin")
def pin_verify(data: PinVerify, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.pin_code:
        raise HTTPException(status_code=400, detail="PIN not set")
    if not verify_pin(user, data.pin):
        raise HTTPException(status_code=401, detail="Invalid PIN")
    return {"verified": True}


@router.post("/set-pin")
def set_pin(data: PinSet, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not pwd_context.verify(data.current_password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid password")
    if len(data.new_pin) < 4 or len(data.new_pin) > 8:
        raise HTTPException(status_code=400, detail="PIN must be 4-8 digits")
    
    user.pin_code = pwd_context.hash(data.new_pin)
    db.commit()
    return {"success": True}


@router.post("/sessions/open")
def open_session(data: SessionOpen, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user or not verify_pin(user, data.pin):
        raise HTTPException(status_code=401, detail="Invalid PIN")
    
    # Check for existing open session
    existing = db.query(CashSession).filter(
        CashSession.clerk_id == data.user_id,
        CashSession.status == "open"
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You already have an open session")
    
    session = CashSession(
        location_id=data.location_id,
        register_id=data.register_id,
        clerk_id=data.user_id,
        opening_amount=data.opening_amount,
        status="open"
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"session_id": session.id, "status": "open", "opening_amount": session.opening_amount}


@router.post("/sessions/{session_id}/close")
def close_session(session_id: int, data: SessionClose, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user or not verify_pin(user, data.pin):
        raise HTTPException(status_code=401, detail="Invalid PIN")
    
    session = db.query(CashSession).filter(CashSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "open":
        raise HTTPException(status_code=400, detail="Session already closed")
    
    # Calculate expected amount
    transactions = db.query(CashTransaction).filter(
        CashTransaction.session_id == session_id
    ).all()
    
    cash_in = sum(t.amount for t in transactions if t.transaction_type in ("sale",) and t.payment_method == "cash")
    cash_out = sum(t.amount for t in transactions if t.transaction_type in ("refund", "payout"))
    
    session.expected_amount = round(session.opening_amount + cash_in - cash_out, 2)
    session.closing_amount = data.closing_amount
    session.variance = round(data.closing_amount - session.expected_amount, 2)
    session.status = "closed" if abs(session.variance) < 5 else "flagged"
    session.closed_at = datetime.utcnow()
    session.notes = data.notes
    
    # Auto-flag large variances
    if abs(session.variance) >= 5:
        alert = CashAlert(
            session_id=session.id,
            clerk_id=data.user_id,
            location_id=session.location_id,
            alert_type="variance",
            severity="high" if abs(session.variance) >= 20 else "medium",
            description=f"Cash variance of ${session.variance:.2f} detected at close"
        )
        db.add(alert)
    
    db.commit()
    return {
        "session_id": session.id,
        "status": session.status,
        "expected": session.expected_amount,
        "actual": session.closing_amount,
        "variance": session.variance,
    }


@router.post("/transactions")
def create_transaction(data: TransactionCreate, db: Session = Depends(get_db)):
    session = db.query(CashSession).filter(
        CashSession.id == data.session_id,
        CashSession.status == "open"
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="No open session found")
    
    txn = CashTransaction(
        session_id=data.session_id,
        clerk_id=session.clerk_id,
        location_id=session.location_id,
        transaction_type=data.transaction_type,
        amount=data.amount,
        payment_method=data.payment_method,
        receipt_number=data.receipt_number,
    )
    
    # Auto-flag suspicious transactions
    if data.transaction_type == "no_sale":
        txn.is_flagged = True
        txn.flag_reason = "No-sale drawer open"
        alert = CashAlert(
            session_id=data.session_id,
            clerk_id=session.clerk_id,
            location_id=session.location_id,
            alert_type="no_sale",
            severity="medium",
            description="No-sale drawer open detected"
        )
        db.add(alert)
    
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return {"transaction_id": txn.id, "flagged": txn.is_flagged}


@router.get("/sessions")
def get_sessions(
    clerk_id: Optional[int] = None,
    status: Optional[str] = None,
    location_id: int = 1,
    db: Session = Depends(get_db)
):
    q = db.query(CashSession).filter(CashSession.location_id == location_id)
    if clerk_id:
        q = q.filter(CashSession.clerk_id == clerk_id)
    if status:
        q = q.filter(CashSession.status == status)
    
    sessions = q.order_by(CashSession.opened_at.desc()).limit(50).all()
    return {
        "sessions": [{
            "id": s.id,
            "register_id": s.register_id,
            "clerk_id": s.clerk_id,
            "opening_amount": s.opening_amount,
            "closing_amount": s.closing_amount,
            "expected_amount": s.expected_amount,
            "variance": s.variance,
            "status": s.status,
            "opened_at": str(s.opened_at),
            "closed_at": str(s.closed_at) if s.closed_at else None,
        } for s in sessions]
    }


@router.get("/alerts")
def get_cash_alerts(
    is_reviewed: Optional[bool] = None,
    location_id: int = 1,
    db: Session = Depends(get_db)
):
    q = db.query(CashAlert).filter(CashAlert.location_id == location_id)
    if is_reviewed is not None:
        q = q.filter(CashAlert.is_reviewed == is_reviewed)
    
    alerts = q.order_by(CashAlert.created_at.desc()).limit(50).all()
    return {
        "alerts": [{
            "id": a.id,
            "alert_type": a.alert_type,
            "severity": a.severity,
            "description": a.description,
            "clerk_id": a.clerk_id,
            "session_id": a.session_id,
            "is_reviewed": a.is_reviewed,
            "resolution": a.resolution,
            "created_at": str(a.created_at),
        } for a in alerts]
    }
