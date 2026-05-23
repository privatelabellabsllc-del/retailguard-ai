from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON, Text
from sqlalchemy.sql import func
from app.database import Base


# Master list of all features that can be toggled per clerk
AVAILABLE_FEATURES = {
    "dashboard": "Dashboard Overview",
    "live_cameras": "Live Camera Feeds",
    "review_queue": "Incident Review Queue",
    "alerts": "Security Alerts",
    "offenders": "Offender Database",
    "blacklist": "Blacklist Management",
    "traffic": "Traffic Analytics",
    "heatmap": "Heatmap & Zones",
    "calendar": "Store Calendar",
    "shelves": "Shelf Monitoring",
    "products": "Product Management",
    "store_scanner": "Store Scanner",
    "cash_management": "Cash In/Cash Out",
    "team": "Team & Shifts",
    "performance": "Performance Reviews",
    "fridge_analytics": "Fridge Door Analytics",
    "revenue": "Revenue & Projections",
    "reports": "Reports & Export",
    "settings": "System Settings",
    "call_police": "Call 911 Action",
    "blacklist_action": "Blacklist Action",
}


class FeaturePermission(Base):
    __tablename__ = "feature_permissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    feature_key = Column(String(50), nullable=False)
    is_enabled = Column(Boolean, default=True)
    granted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class RoleTemplate(Base):
    __tablename__ = "role_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False, unique=True)
    display_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    features = Column(JSON, nullable=False)  # list of feature_keys enabled
    is_system = Column(Boolean, default=False)  # system roles can't be deleted
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# Default role templates
DEFAULT_ROLES = {
    "owner": {
        "display_name": "Owner",
        "description": "Full access to everything",
        "features": list(AVAILABLE_FEATURES.keys()),
        "is_system": True,
    },
    "manager": {
        "display_name": "Manager",
        "description": "Full access except system settings",
        "features": [k for k in AVAILABLE_FEATURES.keys() if k != "settings"],
        "is_system": True,
    },
    "clerk": {
        "display_name": "Clerk",
        "description": "Basic operational access",
        "features": [
            "dashboard", "live_cameras", "alerts", "review_queue",
            "shelves", "cash_management", "team",
        ],
        "is_system": True,
    },
    "viewer": {
        "display_name": "Viewer",
        "description": "Read-only access to analytics",
        "features": ["dashboard", "traffic", "calendar", "heatmap"],
        "is_system": True,
    },
}
