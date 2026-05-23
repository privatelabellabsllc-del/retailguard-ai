from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.database import get_db
from app.models.permissions import FeaturePermission, RoleTemplate, AVAILABLE_FEATURES, DEFAULT_ROLES
from app.models.user import User

router = APIRouter(prefix="/api/permissions", tags=["Permissions"])


class FeatureToggle(BaseModel):
    user_id: int
    feature_key: str
    enabled: bool


class BulkPermissions(BaseModel):
    user_id: int
    features: dict  # {feature_key: bool}


class ApplyTemplate(BaseModel):
    user_id: int
    template_name: str


@router.get("/features")
def list_features():
    """List all available features that can be toggled"""
    return {"features": [{"key": k, "name": v} for k, v in AVAILABLE_FEATURES.items()]}


@router.get("/user/{user_id}")
def get_user_permissions(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    perms = db.query(FeaturePermission).filter(
        FeaturePermission.user_id == user_id
    ).all()
    
    perm_map = {p.feature_key: p.is_enabled for p in perms}
    
    # If no permissions set, use role defaults
    if not perms and user.role in DEFAULT_ROLES:
        default_features = DEFAULT_ROLES[user.role]["features"]
        features = {k: k in default_features for k in AVAILABLE_FEATURES}
    else:
        features = {k: perm_map.get(k, False) for k in AVAILABLE_FEATURES}
    
    return {
        "user_id": user_id,
        "role": user.role,
        "features": features,
    }


@router.post("/toggle")
def toggle_feature(data: FeatureToggle, db: Session = Depends(get_db)):
    if data.feature_key not in AVAILABLE_FEATURES:
        raise HTTPException(status_code=400, detail=f"Unknown feature: {data.feature_key}")
    
    perm = db.query(FeaturePermission).filter(
        FeaturePermission.user_id == data.user_id,
        FeaturePermission.feature_key == data.feature_key
    ).first()
    
    if perm:
        perm.is_enabled = data.enabled
    else:
        perm = FeaturePermission(
            user_id=data.user_id,
            feature_key=data.feature_key,
            is_enabled=data.enabled,
        )
        db.add(perm)
    
    db.commit()
    return {"user_id": data.user_id, "feature": data.feature_key, "enabled": data.enabled}


@router.post("/bulk")
def set_bulk_permissions(data: BulkPermissions, db: Session = Depends(get_db)):
    for feature_key, enabled in data.features.items():
        if feature_key not in AVAILABLE_FEATURES:
            continue
        perm = db.query(FeaturePermission).filter(
            FeaturePermission.user_id == data.user_id,
            FeaturePermission.feature_key == feature_key
        ).first()
        if perm:
            perm.is_enabled = enabled
        else:
            perm = FeaturePermission(
                user_id=data.user_id,
                feature_key=feature_key,
                is_enabled=enabled,
            )
            db.add(perm)
    
    db.commit()
    return {"user_id": data.user_id, "updated": len(data.features)}


@router.post("/apply-template")
def apply_template(data: ApplyTemplate, db: Session = Depends(get_db)):
    if data.template_name not in DEFAULT_ROLES:
        # Check custom templates
        template = db.query(RoleTemplate).filter(
            RoleTemplate.name == data.template_name
        ).first()
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        enabled_features = template.features
    else:
        enabled_features = DEFAULT_ROLES[data.template_name]["features"]
    
    # Clear existing permissions
    db.query(FeaturePermission).filter(
        FeaturePermission.user_id == data.user_id
    ).delete()
    
    # Apply template
    for key in AVAILABLE_FEATURES:
        perm = FeaturePermission(
            user_id=data.user_id,
            feature_key=key,
            is_enabled=key in enabled_features,
        )
        db.add(perm)
    
    # Update user role
    user = db.query(User).filter(User.id == data.user_id).first()
    if user:
        user.role = data.template_name
    
    db.commit()
    return {"user_id": data.user_id, "template": data.template_name, "features_enabled": len(enabled_features)}


@router.get("/templates")
def get_templates(db: Session = Depends(get_db)):
    system_templates = [
        {"name": k, "display_name": v["display_name"], "description": v["description"],
         "features": v["features"], "is_system": True}
        for k, v in DEFAULT_ROLES.items()
    ]
    custom = db.query(RoleTemplate).filter(RoleTemplate.is_system == False).all()
    custom_templates = [
        {"name": t.name, "display_name": t.display_name, "description": t.description,
         "features": t.features, "is_system": False}
        for t in custom
    ]
    return {"templates": system_templates + custom_templates}
