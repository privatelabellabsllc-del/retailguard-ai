from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.permissions import AVAILABLE_FEATURES, DEFAULT_ROLES, FeaturePermission

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: str = "clerk"
    location_id: Optional[int] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
    except JWTError:
        return None
    user = db.query(User).filter(User.username == username).first()
    return user


def get_user_features(user: User, db: Session) -> dict:
    perms = db.query(FeaturePermission).filter(
        FeaturePermission.user_id == user.id
    ).all()
    
    if perms:
        return {p.feature_key: p.is_enabled for p in perms}
    
    # Fall back to role defaults
    if user.role in DEFAULT_ROLES:
        default = DEFAULT_ROLES[user.role]["features"]
        return {k: k in default for k in AVAILABLE_FEATURES}
    
    return {k: True for k in AVAILABLE_FEATURES}


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    
    if not user:
        # Auto-create admin on first login
        if form_data.username == "admin" and form_data.password == "admin123":
            user = User(
                username="admin",
                full_name="Store Owner",
                email="admin@retailguard.ai",
                hashed_password=pwd_context.hash("admin123"),
                role="owner",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not pwd_context.verify(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account deactivated")
    
    user.last_login = datetime.utcnow()
    db.commit()
    
    features = get_user_features(user, db)
    token = create_access_token(data={"sub": user.username, "role": user.role})
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name or user.username,
            "email": user.email,
            "role": user.role,
            "avatar_url": user.avatar_url,
            "has_pin": user.pin_code is not None,
            "features": features,
        }
    }


@router.post("/register")
def register(data: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user = User(
        username=data.username,
        full_name=data.full_name or data.username,
        email=data.email,
        hashed_password=pwd_context.hash(data.password),
        role=data.role,
        location_id=data.location_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
    }


@router.get("/me")
def get_me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    features = get_user_features(user, db)
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "avatar_url": user.avatar_url,
        "has_pin": user.pin_code is not None,
        "features": features,
    }


@router.get("/users")
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).filter(User.is_active == True).all()
    return {
        "users": [{
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "avatar_url": u.avatar_url,
            "is_active": u.is_active,
            "last_login": str(u.last_login) if u.last_login else None,
        } for u in users]
    }


@router.put("/users/{user_id}")
def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.email is not None:
        user.email = data.email
    if data.phone is not None:
        user.phone = data.phone
    if data.role is not None:
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active
    
    db.commit()
    return {"id": user.id, "updated": True}
