from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    # App
    APP_NAME: str = "RetailGuard AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    
    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/retailguard"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Storage (S3-compatible for video clips)
    STORAGE_BACKEND: str = "local"  # "local" or "s3"
    LOCAL_CLIP_DIR: str = "static/clips"
    S3_BUCKET: Optional[str] = None
    S3_REGION: Optional[str] = None
    S3_ACCESS_KEY: Optional[str] = None
    S3_SECRET_KEY: Optional[str] = None
    S3_ENDPOINT_URL: Optional[str] = None
    
    # AI Settings
    FACE_RECOGNITION_MODEL: str = "large"  # "small" or "large" (large = 128-dim, more accurate)
    FACE_MATCH_TOLERANCE: float = 0.45  # Lower = stricter (default 0.6, we use 0.45 for high accuracy)
    BODY_MATCH_WEIGHT: float = 0.20
    FACE_MATCH_WEIGHT: float = 0.45
    GAIT_MATCH_WEIGHT: float = 0.15
    HEIGHT_MATCH_WEIGHT: float = 0.10
    MARKS_MATCH_WEIGHT: float = 0.10
    COMPOSITE_MATCH_THRESHOLD: float = 0.72  # Minimum composite score to confirm identity
    
    # Detection Settings
    CONCEALMENT_CONFIDENCE_THRESHOLD: float = 0.75  # Min confidence to flag concealment
    CLIP_PRE_SECONDS: int = 10  # Seconds before event to include in clip
    CLIP_POST_SECONDS: int = 20  # Seconds after event to include in clip
    CLIP_MAX_SECONDS: int = 30  # Max clip duration
    
    # Camera
    NVR_IP: Optional[str] = None
    NVR_PORT: int = 554
    NVR_USERNAME: Optional[str] = None
    NVR_PASSWORD: Optional[str] = None
    
    # JWT
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours for shift workers
    
    # Alerts
    ALERT_WEBSOCKET_ENABLED: bool = True
    ALERT_SOUND_ENABLED: bool = True
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
