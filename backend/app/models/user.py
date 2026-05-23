from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(200), unique=True, nullable=True)
    full_name = Column(String(200), nullable=True)
    hashed_password = Column(String(200), nullable=False)
    role = Column(String(20), default="clerk")  # owner, manager, clerk, viewer
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=True)
    pin_code = Column(String(200), nullable=True)  # hashed PIN for cash management
    avatar_url = Column(Text, nullable=True)
    phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True)
    face_embedding = Column(Text, nullable=True)  # for clock-in face recognition
    last_login = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
