"""
RetailGuard AI — Main Application Entry Point
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import logging
import os

from app.config import settings
from app.database import engine, Base
from app.api import auth, incidents, alerts, persons, cameras

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Create database tables
    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created")
    
    # Create clip storage directory
    os.makedirs(settings.LOCAL_CLIP_DIR, exist_ok=True)
    
    # Create default admin user if none exists
    from app.database import SessionLocal
    from app.models.user import User, UserRole
    from passlib.context import CryptContext
    
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
        if not admin:
            pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
            admin = User(
                email="admin@retailguard.ai",
                username="admin",
                hashed_password=pwd_context.hash("admin123"),
                full_name="System Admin",
                role=UserRole.ADMIN,
            )
            db.add(admin)
            db.commit()
            logger.info("Default admin user created (username: admin, password: admin123)")
    finally:
        db.close()
    
    logger.info(f"🛡️ RetailGuard AI v{settings.APP_VERSION} started")
    
    yield
    
    logger.info("RetailGuard AI shutting down...")


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-powered retail security platform with facial recognition and theft detection",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for video clips
app.mount("/clips", StaticFiles(directory=settings.LOCAL_CLIP_DIR), name="clips")

# Include routers
app.include_router(auth.router)
app.include_router(incidents.router)
app.include_router(alerts.router)
app.include_router(persons.router)
app.include_router(cameras.router)


@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "operational",
    }


@app.get("/api/health")
async def health():
    return {"status": "healthy", "version": settings.APP_VERSION}
