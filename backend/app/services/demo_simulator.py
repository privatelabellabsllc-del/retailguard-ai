"""
Demo Simulator — generates realistic test data for RetailGuard AI.
Used when no cameras are connected (e.g., cloud demo mode).
"""
import asyncio
import random
import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional

from app.database import SessionLocal
from app.config import settings

logger = logging.getLogger(__name__)

# Sample data for realistic demo
SAMPLE_NAMES = [
    "Unknown Male #1", "Unknown Female #1", "Male, ~30s, dark hoodie",
    "Female, ~25, large purse", "Male, ~40s, baseball cap",
    "Teenager, gray jacket", "Male, ~50s, backpack",
]

SAMPLE_DESCRIPTIONS = [
    "Subject reached toward shelf with right hand, appeared to grab an item, moved hand to right pocket area. Item no longer visible. (Confidence: 82%)",
    "Subject picked up item from display, placed into open purse while looking around. Quick motion pattern detected. (Confidence: 91%)",
    "Subject grabbed multiple items from shelf rapidly, concealed under jacket. (Confidence: 87%)",
    "Subject removed item from hook, hand moved to waistband area. Item no longer visible in hand. (Confidence: 78%)",
    "Subject placed item into shopping bag without scanning. Concealment in bag detected. (Confidence: 85%)",
]

SAMPLE_ITEMS = [
    ("Phone charger", 29.99), ("Bluetooth earbuds", 49.99), ("Energy drink", 4.99),
    ("Cosmetics kit", 34.99), ("Memory card", 24.99), ("Sunglasses", 19.99),
    ("Candy bars (x3)", 5.97), ("Battery pack", 39.99), ("USB cable", 12.99),
]


class DemoSimulator:
    """Generates realistic demo data for testing the full workflow."""
    
    def __init__(self):
        self._running = False
        self._task = None
    
    async def start(self, interval_seconds: int = 60):
        """Start generating demo incidents at the given interval."""
        self._running = True
        logger.info(f"Demo simulator started (interval: {interval_seconds}s)")
        
        while self._running:
            try:
                await self._generate_incident()
            except Exception as e:
                logger.error(f"Demo simulator error: {e}")
            await asyncio.sleep(interval_seconds)
    
    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
    
    async def generate_single_incident(self) -> dict:
        """Generate a single demo incident on demand."""
        return await self._generate_incident()
    
    async def _generate_incident(self) -> dict:
        """Generate a realistic demo incident with person + clips."""
        from app.models.person import Person, PersonStatus, PersonSighting, FaceEmbedding
        from app.models.incident import Incident, IncidentClip, IncidentType, IncidentSeverity, ReviewStatus
        from app.models.camera import Camera
        from app.api.alerts import alert_manager
        import numpy as np
        
        db = SessionLocal()
        
        try:
            # Get or create a camera for the demo
            camera = db.query(Camera).filter(Camera.is_active == True).first()
            if not camera:
                camera = Camera(
                    name="Demo Camera - Front Entrance",
                    description="Simulated camera for demo mode",
                    channel_number=1,
                    is_active=True,
                    ai_enabled=True,
                    resolution="2560x1440",
                    fps=25,
                )
                db.add(camera)
                db.commit()
                db.refresh(camera)
            
            # Decide: new person or returning person
            existing_persons = db.query(Person).filter(
                Person.status.in_([PersonStatus.UNKNOWN, PersonStatus.SUSPECTED_THIEF])
            ).all()
            
            if existing_persons and random.random() < 0.3:
                person = random.choice(existing_persons)
                person.total_visits += 1
                person.last_seen = datetime.utcnow()
            else:
                # Create new person
                name = random.choice(SAMPLE_NAMES)
                person = Person(
                    status=PersonStatus.UNKNOWN,
                    display_name=f"{name} (#{random.randint(100,999)})",
                    estimated_age_range=random.choice(["18-25", "25-35", "35-45", "45-55"]),
                    estimated_gender=random.choice(["male", "female"]),
                    estimated_height_cm=random.uniform(155, 195),
                    estimated_build=random.choice(["slim", "medium", "heavy", "athletic"]),
                    threat_level=0,
                    total_visits=1,
                    total_incidents=0,
                    total_confirmed_thefts=0,
                    first_seen=datetime.utcnow(),
                    last_seen=datetime.utcnow(),
                )
                db.add(person)
                db.commit()
                db.refresh(person)
                
                # Create a fake face embedding for the person
                fake_embedding = np.random.randn(128).astype(np.float64).tobytes()
                face_emb = FaceEmbedding(
                    person_id=person.id,
                    embedding=fake_embedding,
                    face_angle="front",
                    quality_score=random.uniform(0.7, 1.0),
                    confidence=random.uniform(0.8, 0.99),
                    source_camera_id=camera.id,
                )
                db.add(face_emb)
            
            # Create incident
            confidence = random.uniform(0.75, 0.98)
            description = random.choice(SAMPLE_DESCRIPTIONS)
            item_name, item_value = random.choice(SAMPLE_ITEMS)
            
            severity_choices = [
                (IncidentSeverity.MEDIUM, 0.5),
                (IncidentSeverity.HIGH, 0.35),
                (IncidentSeverity.CRITICAL, 0.15),
            ]
            severity = random.choices(
                [s[0] for s in severity_choices],
                [s[1] for s in severity_choices]
            )[0]
            
            incident = Incident(
                person_id=person.id,
                incident_type=IncidentType.CONCEALMENT,
                severity=severity,
                review_status=ReviewStatus.PENDING,
                camera_id=camera.id,
                detected_at=datetime.utcnow(),
                ai_confidence=confidence,
                ai_description=description,
                zone_name=random.choice(["aisle_1", "aisle_2", "aisle_3", "electronics", "cosmetics", "snacks"]),
                estimated_item=item_name,
                estimated_value=item_value,
                detection_details={
                    "concealment_type": random.choice(["right_pocket", "left_pocket", "bag_purse", "jacket_inside", "waistband"]),
                    "hand_used": random.choice(["right", "left"]),
                    "shelf_interaction": True,
                    "item_before": True,
                    "item_after": False,
                    "signals": {
                        "reach_to_shelf": True,
                        "downward_to_pocket": True,
                        "hand_state_transition": random.random() > 0.2,
                        "in_concealment_zone": True,
                        "quick_motion_pattern": random.random() > 0.3,
                    }
                },
            )
            db.add(incident)
            
            # Update person stats
            person.total_incidents += 1
            if person.status == PersonStatus.UNKNOWN:
                person.status = PersonStatus.SUSPECTED_THIEF
                person.threat_level = 1
            
            # Create sighting
            sighting = PersonSighting(
                person_id=person.id,
                camera_id=camera.id,
                match_confidence=confidence,
                face_match_score=random.uniform(0.8, 0.99),
                body_match_score=random.uniform(0.6, 0.95),
                entered_at=datetime.utcnow() - timedelta(minutes=random.randint(1, 15)),
                zones_visited=["entrance", random.choice(["aisle_1", "aisle_2", "electronics"])],
            )
            db.add(sighting)
            
            db.commit()
            db.refresh(incident)
            
            result = {
                "incident_id": str(incident.id),
                "person_id": str(person.id),
                "person_name": person.display_name,
                "confidence": confidence,
                "item": item_name,
                "value": item_value,
                "severity": severity.value,
            }
            
            # Push via WebSocket
            await alert_manager.broadcast_alert({
                "type": "new_incident",
                "incident": {
                    "id": str(incident.id),
                    "incident_type": "concealment",
                    "severity": severity.value,
                    "ai_confidence": confidence,
                    "ai_description": description,
                    "camera_id": str(camera.id),
                    "person_id": str(person.id),
                    "person_name": person.display_name,
                    "detected_at": incident.detected_at.isoformat(),
                    "estimated_item": item_name,
                    "estimated_value": item_value,
                }
            })
            
            logger.info(f"Demo incident generated: {person.display_name} — {item_name} (${item_value})")
            return result
            
        except Exception as e:
            logger.error(f"Demo incident generation error: {e}", exc_info=True)
            db.rollback()
            return {"error": str(e)}
        finally:
            db.close()


# Singleton
demo_simulator = DemoSimulator()
