from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
