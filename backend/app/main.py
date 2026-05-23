from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text, inspect
from app.config import settings
from app.database import engine, Base
from app.api import auth, incidents, alerts, persons, cameras
from app.api import traffic, team, cash, shelves, analytics, permissions

# Import all models so they register with Base.metadata
from app.models import *  # noqa

app = FastAPI(
    title="RetailGuard AI",
    description="AI-Powered Retail Intelligence & Security Platform",
    version="2.0.0"
)

# CORS
origins = settings.CORS_ORIGINS.split(",") if settings.CORS_ORIGINS else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core security routes
app.include_router(auth.router)
app.include_router(incidents.router)
app.include_router(alerts.router)
app.include_router(persons.router)
app.include_router(cameras.router)

# V2 — Retail Intelligence routes
app.include_router(traffic.router)
app.include_router(team.router)
app.include_router(cash.router)
app.include_router(shelves.router)
app.include_router(analytics.router)
app.include_router(permissions.router)


@app.on_event("startup")
def startup():
    """Initialize database tables on startup."""
    try:
        inspector = inspect(engine)
        existing = inspector.get_table_names()
        v2_tables = ["traffic_counts", "shifts", "cash_sessions", "shelves", "heatmap_data"]
        has_v2 = any(t in existing for t in v2_tables)
        if existing and not has_v2:
            print("V2 upgrade: dropping old tables...")
            Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        print(f"DB ready — {len(Base.metadata.tables)} tables")
    except Exception as e:
        print(f"DB init error: {e}")
        try:
            Base.metadata.drop_all(bind=engine)
            Base.metadata.create_all(bind=engine)
            print("DB recreated from scratch")
        except Exception as e2:
            print(f"DB fatal: {e2}")


@app.get("/")
def root():
    return {
        "name": "RetailGuard AI",
        "version": "2.0.0",
        "status": "operational",
        "modules": {
            "security": "active",
            "traffic": "active",
            "team": "active",
            "cash_management": "active",
            "shelf_monitoring": "active",
            "analytics": "active",
            "permissions": "active",
        }
    }


@app.get("/api/health")
def health():
    return {"status": "healthy", "version": "2.0.0"}
