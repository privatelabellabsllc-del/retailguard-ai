from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    # App
    APP_NAME: str = "RetailGuard AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    CORS_ORIGINS: str = "*"
    
    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/retailguard"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Storage (S3-compatible for video clips)
    STORAGE_BACKEND: str = "local"  # "local" or "s3"
    LOCAL_CLIP_DIR: str = "/app/uploads/clips"  # Persistent; served via /api/clips and /uploads/clips
    S3_BUCKET: Optional[str] = None
    S3_REGION: Optional[str] = None
    S3_ACCESS_KEY: Optional[str] = None
    S3_SECRET_KEY: Optional[str] = None
    S3_ENDPOINT_URL: Optional[str] = None
    
    # AI Settings
    FACE_RECOGNITION_MODEL: str = "large"  # "small" or "large" (large = 128-dim, more accurate)
    FACE_MATCH_TOLERANCE: float = 0.5  # Lower = stricter (dlib default 0.6; 0.5 = high accuracy)
    FACE_MIN_SIZE_PX: int = 80          # Minimum face height/width in pixels to enroll/match
    FACE_BLUR_THRESHOLD: float = 60.0   # Laplacian variance below this = too blurry, skip
    FACE_MATCH_CONSECUTIVE: int = 3     # Require same person matched N consecutive samples before alerting
    MAX_EMBEDDINGS_PER_PERSON: int = 10 # Cap of best-quality embeddings kept per person
    ALERT_COOLDOWN_SECONDS: int = 600   # Don't re-alert for the same person within this window
    BODY_MATCH_WEIGHT: float = 0.20
    FACE_MATCH_WEIGHT: float = 0.45
    GAIT_MATCH_WEIGHT: float = 0.15
    HEIGHT_MATCH_WEIGHT: float = 0.10
    MARKS_MATCH_WEIGHT: float = 0.10
    COMPOSITE_MATCH_THRESHOLD: float = 0.72  # Minimum composite score to confirm identity
    
    # Detection Settings
    CONCEALMENT_CONFIDENCE_THRESHOLD: float = 0.75  # Min confidence to flag concealment
    CONCEALMENT_SUSTAIN_COUNT: int = 2   # Require detection over N consecutive analyses before firing
    CONCEALMENT_EVENT_COOLDOWN: float = 30.0  # Seconds before same track can fire another event
    CLIP_PRE_SECONDS: int = 10  # Seconds before event to include in clip
    CLIP_POST_SECONDS: int = 20  # Seconds after event to include in clip
    CLIP_MAX_SECONDS: int = 30  # Max clip duration

    # Stream processing (source cameras are 4K — downscale + subsample before AI)
    ANALYZE_FPS: float = 5.0    # Target analysis rate (frames/sec fed to AI)
    ANALYZE_WIDTH: int = 960    # Downscale frames to this width before AI processing
    RTSP_RECONNECT_MAX_BACKOFF: float = 60.0  # Max seconds between reconnect attempts
    
    # Camera
    NVR_IP: Optional[str] = None
    NVR_PORT: int = 554
    NVR_USERNAME: Optional[str] = None
    NVR_PASSWORD: Optional[str] = None
    
    # JWT
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours for shift workers
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    
    # Alerts
    ALERT_WEBSOCKET_ENABLED: bool = True
    ALERT_SOUND_ENABLED: bool = True
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
