import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text, inspect
from app.config import settings
from app.database import engine, Base

# Import all models so they register with Base.metadata
# Must be before API imports to avoid circular deps, but use explicit imports
# to avoid name shadowing
from app.models.user import User  # noqa
from app.models.person import Person  # noqa
from app.models.incident import Incident  # noqa
from app.models.alert import Alert  # noqa
from app.models.camera import Camera  # noqa
from app.models.location import Location  # noqa
from app.models.traffic import TrafficCount, TrafficVisitor  # noqa
from app.models.team import Shift, PerformanceMetric, PerformanceReview, ReviewTemplate  # noqa
from app.models.shelf import Shelf, ShelfProduct, Product, OutOfStockAlert, StoreScan  # noqa
from app.models.cash import CashSession, CashTransaction, CashAlert  # noqa
from app.models.analytics import HeatmapData, FridgeDoorEvent, RevenueRecord, DailyAnalytics  # noqa
from app.models.permissions import FeaturePermission, RoleTemplate  # noqa

# Now import API routers (no name shadowing)
from app.api import auth, incidents, alerts, persons, cameras
from app.api import traffic, team, cash, shelves, analytics, permissions
from app.api import stream, clips

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

# AI Pipeline & Clips routes
app.include_router(stream.router)
app.include_router(clips.router)

# Serve uploaded files (ID photos, portraits, etc.)
os.makedirs("/app/uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="/app/uploads"), name="uploads")


def _run_migrations(engine, inspector):
    """Add missing columns to existing tables (lightweight migration)."""
    from sqlalchemy import text as sa_text
    migrations = [
        # Person manual entry fields
        ("persons", "full_name", "VARCHAR(255)"),
        ("persons", "date_of_birth", "VARCHAR(50)"),
        ("persons", "address", "TEXT"),
        ("persons", "phone_number", "VARCHAR(50)"),
        ("persons", "drivers_license", "VARCHAR(100)"),
        ("persons", "id_photo_path", "VARCHAR(500)"),
        ("persons", "id_type", "VARCHAR(50)"),
        # Incident classification fields
        ("incidents", "theft_classification", "VARCHAR(50)"),
        ("incidents", "classification_confidence", "FLOAT"),
        ("incidents", "classification_reason", "TEXT"),
        ("incidents", "visited_register", "BOOLEAN DEFAULT FALSE"),
        ("incidents", "register_dwell_seconds", "FLOAT"),
        ("incidents", "concealment_count", "INTEGER DEFAULT 1"),
    ]
    with engine.connect() as conn:
        for table, column, col_type in migrations:
            try:
                existing_cols = [c["name"] for c in inspector.get_columns(table)]
                if column not in existing_cols:
                    conn.execute(sa_text(f'ALTER TABLE {table} ADD COLUMN {column} {col_type}'))
                    conn.commit()
                    print(f"  Migration: added {table}.{column}")
            except Exception as e:
                print(f"  Migration skip {table}.{column}: {e}")


@app.on_event("startup")
def startup():
    """Initialize database tables and seed admin on startup."""
    from passlib.context import CryptContext
    from app.database import SessionLocal

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

        # Migrate: add new columns if they don't exist
        _run_migrations(engine, inspector)
    except Exception as e:
        print(f"DB init error: {e}")
        try:
            Base.metadata.drop_all(bind=engine)
            Base.metadata.create_all(bind=engine)
            print("DB recreated from scratch")
        except Exception as e2:
            print(f"DB fatal: {e2}")

    # Seed default admin user
    try:
        db = SessionLocal()
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
            admin = User(
                username="admin",
                hashed_password=pwd.hash("admin123"),
                email="admin@retailguard.ai",
                full_name="System Admin",
                role="owner",
                is_active=True,
            )
            db.add(admin)
            db.commit()
            print("Default admin user created (admin / admin123)")
        db.close()
    except Exception as e:
        print(f"Admin seed error: {e}")

    # Update camera RTSP URLs with correct Uniview paths via ngrok tunnel
    try:
        db = SessionLocal()
        from sqlalchemy import text as sql_text
        cameras = db.query(Camera).filter(Camera.is_active == True).order_by(Camera.name).all()
        for i, cam in enumerate(cameras):
            ch = i + 1
            new_url = f"rtsp://admin:Sectec1227%40@6.tcp.ngrok.io:17137/unicast/c{ch}/s0/live"
            cam.rtsp_url = new_url
            cam.resolution = "3072x1728" if ch == 1 else "3840x2160"
        db.commit()
        print(f"Updated {len(cameras)} cameras with RTSP URLs via ngrok tunnel")
        db.close()
    except Exception as e:
        print(f"Camera RTSP update error (non-fatal): {e}")

    # Initialize AI Stream Manager
    import asyncio
    try:
        from app.services.stream_manager import StreamManager
        manager = StreamManager.get_instance()
        # Schedule initialization (can't await in sync startup)
        loop = asyncio.get_event_loop()
        loop.create_task(manager.initialize())
        print("AI StreamManager initialization scheduled")
    except Exception as e:
        print(f"StreamManager init error (non-fatal): {e}")


@app.post("/api/admin/reset")
def reset_and_seed():
    """Wipe all data and seed one demo item per feature."""
    from passlib.context import CryptContext
    from app.database import SessionLocal
    from datetime import datetime, timedelta
    import uuid

    db = SessionLocal()
    try:
        # Wipe all data using TRUNCATE CASCADE to handle all FK constraints
        from sqlalchemy import text as sql_text
        table_names = [t.name for t in Base.metadata.sorted_tables]
        for tname in table_names:
            db.execute(sql_text(f'TRUNCATE TABLE "{tname}" CASCADE'))
        db.commit()

        # --- Seed admin user ---
        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        admin = User(
            username="admin",
            hashed_password=pwd.hash("admin123"),
            email="admin@retailguard.ai",
            full_name="System Admin",
            role="owner",
            is_active=True,
        )
        db.add(admin)
        db.flush()

        # --- Seed one location ---
        loc = Location(id=uuid.uuid4(), name="Main Store", address="123 Retail Ave")
        db.add(loc)
        db.flush()

        # --- Seed one camera ---
        cam = Camera(
            id=uuid.uuid4(),
            name="Front Entrance",
            rtsp_url="rtsp://192.168.1.100:554/stream1",
            location_id=loc.id,
            is_active=False,
            description="Dome camera — main entrance",
        )
        db.add(cam)
        db.flush()

        # --- Seed one person (known visitor) ---
        from app.models.person import PersonStatus
        from app.models.incident import IncidentType, IncidentSeverity, ReviewStatus, TheftClassification
        from app.models.alert import AlertType, AlertPriority, AlertStatus

        person = Person(
            id=uuid.uuid4(),
            display_name="Male, ~6ft, dark jacket",
            status=PersonStatus.SUSPECTED_THIEF,
            threat_level=2,
            first_seen=datetime.utcnow() - timedelta(days=3),
            last_seen=datetime.utcnow() - timedelta(hours=2),
            total_visits=2,
            total_incidents=1,
            notes="Observed concealing merchandise on previous visit",
            estimated_age_range="25-35",
            estimated_gender="Male",
            estimated_height_cm=183.0,
            estimated_build="medium",
            location_id=loc.id,
        )
        db.add(person)
        db.flush()

        # --- Seed one incident (pending review) ---
        incident = Incident(
            id=uuid.uuid4(),
            camera_id=cam.id,
            person_id=person.id,
            location_id=loc.id,
            incident_type=IncidentType.CONCEALMENT,
            severity=IncidentSeverity.MEDIUM,
            review_status=ReviewStatus.PENDING,
            ai_confidence=0.87,
            ai_description="Subject placed wireless earbuds into jacket pocket near electronics aisle",
            detected_at=datetime.utcnow() - timedelta(hours=1),
            estimated_item="Wireless Earbuds",
            estimated_value=49.99,
            theft_classification="likely_theft",
            classification_confidence=0.82,
            classification_reason="Concealed 1 item, bypassed register, exited store within 45 seconds.",
            visited_register=False,
            concealment_count=1,
        )
        db.add(incident)
        db.flush()

        # --- Seed one alert ---
        alert = Alert(
            id=uuid.uuid4(),
            alert_type=AlertType.KNOWN_THIEF_ENTERED,
            priority=AlertPriority.HIGH,
            status=AlertStatus.ACTIVE,
            title="Known suspect detected at Front Entrance",
            message="Previously flagged for concealment — entered via Front Entrance camera",
            person_id=person.id,
            camera_id=cam.id,
            match_confidence=0.91,
            created_at=datetime.utcnow() - timedelta(minutes=30),
        )
        db.add(alert)
        db.flush()

        db.commit()
        return {
            "status": "ok",
            "message": "Database wiped and seeded with demo data",
            "seeded": {
                "users": 1,
                "locations": 1,
                "cameras": 1,
                "persons": 1,
                "incidents": 1,
                "alerts": 1,
            }
        }
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        db.close()


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
