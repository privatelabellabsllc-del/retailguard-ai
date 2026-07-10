"""
ZoneTracker — Tracks person journeys through store zones to determine theft vs. purchase.

After concealment is detected, the system needs to answer:
  1. Did they go to the register and pay?  → Not theft (or partial theft if POS mismatch)
  2. Did they skip the register and walk out? → Likely theft
  3. Did they go to the register but concealed items weren't scanned? → Partial theft

Zone types:
  - ENTRANCE: Store entry points
  - EXIT: Store exit points (can overlap with entrance for single-door stores)
  - REGISTER: Checkout/POS area
  - SHELF: Product shelving areas
  - HIGH_VALUE: High-value product zones (electronics, etc.)

Journey states:
  BROWSING → CONCEALMENT_DETECTED → WENT_TO_REGISTER / HEADING_TO_EXIT → EXITED

Each tracked person after concealment gets a "journey" that records every zone transition.
"""
import asyncio
import inspect
import time
import logging
from enum import Enum
from typing import Optional, Dict, List, Tuple
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


class ZoneType(str, Enum):
    ENTRANCE = "entrance"
    EXIT = "exit"
    REGISTER = "register"
    SHELF = "shelf"
    HIGH_VALUE = "high_value"
    GENERAL = "general"


class JourneyState(str, Enum):
    """Person's state after concealment is detected."""
    TRACKING = "tracking"                  # Concealment detected, watching them
    AT_REGISTER = "at_register"            # They went to the checkout
    PAID = "paid"                          # POS confirmed payment (if integrated)
    HEADING_TO_EXIT = "heading_to_exit"    # Moving toward exit without register visit
    EXITED_AFTER_REGISTER = "exited_after_register"   # Left after visiting register
    EXITED_WITHOUT_REGISTER = "exited_without_register"  # Left WITHOUT visiting register
    STILL_IN_STORE = "still_in_store"      # Still browsing (timeout pending)


class TheftClassification(str, Enum):
    """Final theft determination based on journey analysis."""
    LIKELY_PAID = "likely_paid"            # Went to register → probably paid
    LIKELY_THEFT = "likely_theft"          # Skipped register → walked out
    PARTIAL_THEFT = "partial_theft"        # Went to register but POS item count < concealed count
    UNDER_REVIEW = "under_review"         # Still in store or ambiguous
    CLEARED = "cleared"                   # Item was returned to shelf or clerk cleared
    GRAB_AND_RUN = "grab_and_run"         # Concealed + immediately ran to exit


@dataclass
class ZoneDefinition:
    """A defined zone in a camera's field of view."""
    zone_id: str
    zone_type: ZoneType
    camera_id: str
    polygon: List[Tuple[float, float]]  # Normalized 0-1 coords
    name: str = ""

    def contains_point(self, x: float, y: float, frame_w: int, frame_h: int) -> bool:
        """Check if a point (pixel coords) is inside this zone polygon."""
        # Convert pixel coords to normalized
        nx, ny = x / frame_w, y / frame_h
        return self._point_in_polygon(nx, ny, self.polygon)

    def contains_bbox_center(self, bbox: Tuple[int, int, int, int], frame_w: int, frame_h: int) -> bool:
        """Check if the center of a bounding box is in this zone."""
        cx = (bbox[0] + bbox[2]) / 2
        cy = (bbox[1] + bbox[3]) / 2
        return self.contains_point(cx, cy, frame_w, frame_h)

    @staticmethod
    def _point_in_polygon(x: float, y: float, polygon: List[Tuple[float, float]]) -> bool:
        """Ray casting algorithm for point-in-polygon test."""
        n = len(polygon)
        inside = False
        j = n - 1
        for i in range(n):
            xi, yi = polygon[i]
            xj, yj = polygon[j]
            if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
                inside = not inside
            j = i
        return inside


@dataclass
class ZoneEvent:
    """A person entering or exiting a zone."""
    person_track_id: str
    zone_id: str
    zone_type: ZoneType
    event_type: str  # "enter" or "exit"
    timestamp: float
    camera_id: str


@dataclass
class PersonJourney:
    """
    Tracks a person's path through the store after concealment is detected.
    This is the key data structure for determining theft vs. purchase.
    """
    track_id: str
    person_id: Optional[str]  # Matched DB person ID
    camera_id: str

    # Concealment event info
    concealment_time: float = 0.0
    concealment_count: int = 0          # How many items were concealed
    concealment_descriptions: List[str] = field(default_factory=list)

    # Journey tracking
    state: JourneyState = JourneyState.TRACKING
    zone_history: List[ZoneEvent] = field(default_factory=list)
    visited_register: bool = False
    register_enter_time: Optional[float] = None
    register_dwell_seconds: float = 0.0  # Time spent at register
    exit_time: Optional[float] = None

    # Position tracking
    last_bbox: Optional[Tuple[int, int, int, int]] = None
    last_seen: float = 0.0
    last_zone: Optional[str] = None

    # Classification
    classification: TheftClassification = TheftClassification.UNDER_REVIEW
    classification_confidence: float = 0.0
    classification_reason: str = ""

    # POS correlation (if POS integration exists)
    pos_transaction_id: Optional[str] = None
    pos_item_count: Optional[int] = None
    pos_total: Optional[float] = None

    # Item retrieval at register (reverse of concealment: pocket → counter).
    # A retrieval is the strongest "they paid for it" behavioral signal.
    retrieval_detected: bool = False
    retrieval_time: Optional[float] = None
    retrieval_confidence: float = 0.0

    # Behavioral suspicion context (from BehaviorAnalyzer). Enrichment only —
    # never triggers a classification by itself.
    behavior_score: float = 0.0
    behavior_signals: Dict = field(default_factory=dict)

    # Timing
    created_at: float = field(default_factory=time.time)
    classified_at: Optional[float] = None

    # Alerts
    alert_sent: bool = False
    incident_id: Optional[str] = None


class ZoneTracker:
    """
    Manages zone definitions and tracks person journeys through zones.
    One instance per camera (or shared across cameras for multi-cam tracking).
    """

    def __init__(
        self,
        on_theft_classified=None,    # Callback when theft is determined
        on_zone_alert=None,          # Callback for zone entry/exit
        exit_timeout_seconds: float = 120.0,  # Max time to track after concealment
        register_min_dwell: float = 15.0,     # Min seconds at register to count as "paid"
        retrieval_confidence_boost: float = 0.35,  # How strongly a retrieval pushes toward PAID
        behavior_weight: float = 0.15,        # Mild weight of behavior score in fusion
    ):
        self.zones: Dict[str, ZoneDefinition] = {}
        self.active_journeys: Dict[str, PersonJourney] = {}  # track_id -> journey
        self.on_theft_classified = on_theft_classified
        self.on_zone_alert = on_zone_alert
        self.exit_timeout_seconds = exit_timeout_seconds
        self.register_min_dwell = register_min_dwell
        self.retrieval_confidence_boost = retrieval_confidence_boost
        self.behavior_weight = behavior_weight

        # Zone lookup by type for fast access
        self._zones_by_type: Dict[ZoneType, List[ZoneDefinition]] = {
            t: [] for t in ZoneType
        }

    @staticmethod
    def _fire_callback(callback, *args):
        """
        Invoke a callback that may be sync OR async.
        Previously async callbacks (e.g. DetectionPipeline._on_journey_classified)
        were called synchronously, producing a never-awaited coroutine — the
        classification silently never propagated. This schedules coroutines
        on the running event loop.
        """
        if callback is None:
            return
        try:
            result = callback(*args)
            if inspect.isawaitable(result):
                try:
                    loop = asyncio.get_running_loop()
                    loop.create_task(result)
                except RuntimeError:
                    # No running loop (e.g. unit tests) — run to completion
                    asyncio.run(result)
        except Exception:
            logger.exception("Zone tracker callback failed")

    def add_zone(self, zone: ZoneDefinition):
        """Register a zone for tracking."""
        self.zones[zone.zone_id] = zone
        self._zones_by_type[zone.zone_type].append(zone)
        logger.info(f"Added zone: {zone.name} ({zone.zone_type}) on camera {zone.camera_id}")

    def load_zones_from_camera(self, camera_id: str, camera_zones: List[dict]):
        """Load zones from camera zone configuration (from DB)."""
        for cz in camera_zones:
            zone = ZoneDefinition(
                zone_id=str(cz.get("id", f"{camera_id}_{cz['name']}")),
                zone_type=ZoneType(cz.get("zone_type", "general")),
                camera_id=camera_id,
                polygon=cz.get("polygon", []),
                name=cz.get("name", ""),
            )
            self.add_zone(zone)

    def start_journey(
        self,
        track_id: str,
        person_id: Optional[str],
        camera_id: str,
        concealment_time: float,
        concealment_description: str = "",
    ) -> PersonJourney:
        """
        Start tracking a person's journey after concealment is detected.
        Called by DetectionPipeline when concealment event fires.
        """
        if track_id in self.active_journeys:
            # Additional concealment by same person — increment count
            journey = self.active_journeys[track_id]
            journey.concealment_count += 1
            if concealment_description:
                journey.concealment_descriptions.append(concealment_description)
            logger.info(
                f"Person {track_id} concealed again "
                f"(total: {journey.concealment_count})"
            )
            return journey

        journey = PersonJourney(
            track_id=track_id,
            person_id=person_id,
            camera_id=camera_id,
            concealment_time=concealment_time,
            concealment_count=1,
            concealment_descriptions=[concealment_description] if concealment_description else [],
            last_seen=concealment_time,
        )
        self.active_journeys[track_id] = journey
        logger.warning(
            f"🔍 Journey started for {track_id} — concealment detected, "
            f"now tracking register/exit zones"
        )
        return journey

    def update_position(
        self,
        track_id: str,
        bbox: Tuple[int, int, int, int],
        frame_w: int,
        frame_h: int,
        timestamp: float,
        camera_id: str,
    ):
        """
        Update a tracked person's position and check zone transitions.
        Called every frame for persons with active journeys.
        """
        if track_id not in self.active_journeys:
            return

        journey = self.active_journeys[track_id]
        journey.last_bbox = bbox
        journey.last_seen = timestamp

        # Check which zones this person is in
        current_zones = []
        for zone_id, zone in self.zones.items():
            if zone.camera_id != camera_id:
                continue
            if zone.contains_bbox_center(bbox, frame_w, frame_h):
                current_zones.append(zone)

        # Process zone transitions
        for zone in current_zones:
            zone_key = f"{zone.zone_id}"

            # Check if this is a new zone entry
            if journey.last_zone != zone_key:
                event = ZoneEvent(
                    person_track_id=track_id,
                    zone_id=zone.zone_id,
                    zone_type=zone.zone_type,
                    event_type="enter",
                    timestamp=timestamp,
                    camera_id=camera_id,
                )
                journey.zone_history.append(event)
                journey.last_zone = zone_key

                # Handle specific zone types
                if zone.zone_type == ZoneType.REGISTER:
                    self._handle_register_entry(journey, timestamp)
                elif zone.zone_type == ZoneType.EXIT:
                    self._handle_exit_zone(journey, timestamp)

                self._fire_callback(self.on_zone_alert, event)

                # Journey ends once classified at an exit — stop tracking it
                if journey.classified_at is not None:
                    self.active_journeys.pop(track_id, None)
                    return

        # Person is not inside any zone — reset last_zone so a later re-entry
        # into the same zone is registered as a new "enter" event
        if not current_zones:
            journey.last_zone = None

        # Update register dwell time
        if journey.state == JourneyState.AT_REGISTER and journey.register_enter_time:
            journey.register_dwell_seconds = timestamp - journey.register_enter_time

    def zone_at(
        self,
        bbox: Tuple[int, int, int, int],
        frame_w: int,
        frame_h: int,
        camera_id: str,
        zone_type: Optional[ZoneType] = None,
    ) -> Optional[ZoneDefinition]:
        """
        Return the first zone (optionally of a specific type) containing the
        bbox center on this camera, or None. Used by the pipeline for behavior
        observation and register-area retrieval checks.
        """
        candidates = self._zones_by_type[zone_type] if zone_type else self.zones.values()
        for zone in candidates:
            if zone.camera_id != camera_id:
                continue
            if zone.contains_bbox_center(bbox, frame_w, frame_h):
                return zone
        return None

    def record_retrieval(self, track_id: str, timestamp: float, confidence: float = 1.0):
        """
        Record an item-retrieval gesture at the register (pocket/bag → counter).
        This is the reverse of concealment and strongly indicates the person
        pulled the concealed item back out to pay for it.
        """
        journey = self.active_journeys.get(track_id)
        if journey is None:
            return
        if not journey.retrieval_detected:
            journey.retrieval_detected = True
            journey.retrieval_time = timestamp
            journey.retrieval_confidence = confidence
            logger.info(
                f"🧾 RETRIEVAL at register: {track_id} pulled concealed item back "
                f"out (confidence {confidence:.0%}) — leaning PAID"
            )
            event = ZoneEvent(
                person_track_id=track_id,
                zone_id="register",
                zone_type=ZoneType.REGISTER,
                event_type="retrieval",
                timestamp=timestamp,
                camera_id=journey.camera_id,
            )
            journey.zone_history.append(event)
            self._fire_callback(self.on_zone_alert, event)

    def set_behavior(self, track_id: str, score: float, signals: Optional[Dict] = None):
        """Attach the latest behavioral suspicion score/signals to a journey."""
        journey = self.active_journeys.get(track_id)
        if journey is None:
            return
        journey.behavior_score = max(0.0, min(1.0, float(score)))
        if signals:
            journey.behavior_signals = signals

    # Classifications that lean toward theft vs. paid, for confidence fusion
    _THEFT_SIDE = (
        TheftClassification.LIKELY_THEFT,
        TheftClassification.PARTIAL_THEFT,
        TheftClassification.GRAB_AND_RUN,
    )
    _PAID_SIDE = (
        TheftClassification.LIKELY_PAID,
        TheftClassification.CLEARED,
    )

    def _fuse_confidence(self, journey: PersonJourney):
        """
        Fuse the base journey classification confidence with behavioral
        context. Behavior is a MILD adjustment only (never flips a class):
          - theft-side classes: confidence rises with suspicion score
          - paid-side classes: high suspicion mildly tempers certainty
        Retrieval boosting is applied where the classification is decided
        (register/exit handling), since it can flip the class itself.
        """
        score = journey.behavior_score
        if score <= 0:
            return
        adj = 0.0
        if journey.classification in self._THEFT_SIDE:
            adj = self.behavior_weight * score
        elif journey.classification in self._PAID_SIDE:
            adj = -0.5 * self.behavior_weight * score
        if adj:
            journey.classification_confidence = max(
                0.05, min(0.98, journey.classification_confidence + adj)
            )
            journey.classification_reason += (
                f" Behavior score {score:.2f} "
                f"({'raised' if adj > 0 else 'tempered'} confidence)."
            )

    def _handle_register_entry(self, journey: PersonJourney, timestamp: float):
        """Person with concealment entered the register/checkout zone."""
        journey.visited_register = True
        journey.register_enter_time = timestamp
        journey.state = JourneyState.AT_REGISTER
        logger.info(
            f"✅ Person {journey.track_id} entered REGISTER zone "
            f"(concealment count: {journey.concealment_count})"
        )

    def _handle_exit_zone(self, journey: PersonJourney, timestamp: float):
        """Person with concealment entered an exit zone."""
        journey.exit_time = timestamp

        if journey.visited_register:
            # They went to register first → likely paid
            journey.state = JourneyState.EXITED_AFTER_REGISTER

            if journey.retrieval_detected:
                # They pulled the concealed item back OUT at the register —
                # the reverse gesture of concealment. Strongest paid signal
                # short of POS confirmation: conceal → retrieve → pay ≠ theft.
                journey.classification = TheftClassification.LIKELY_PAID
                journey.classification_confidence = min(
                    0.95, 0.55 + self.retrieval_confidence_boost
                )
                journey.classification_reason = (
                    f"Retrieved concealed item at register "
                    f"(dwell {journey.register_dwell_seconds:.0f}s) before exiting. "
                    f"Concealed-then-paid pattern — not theft."
                )
            # Check dwell time at register
            elif journey.register_dwell_seconds >= self.register_min_dwell:
                journey.classification = TheftClassification.LIKELY_PAID
                journey.classification_confidence = 0.75
                journey.classification_reason = (
                    f"Visited register for {journey.register_dwell_seconds:.0f}s "
                    f"before exiting. Likely completed purchase."
                )
            else:
                # Brief register visit — suspicious
                journey.classification = TheftClassification.PARTIAL_THEFT
                journey.classification_confidence = 0.60
                journey.classification_reason = (
                    f"Visited register briefly ({journey.register_dwell_seconds:.0f}s) "
                    f"with no retrieval of the concealed item "
                    f"— may not have scanned all items. "
                    f"{journey.concealment_count} concealment(s) detected."
                )
        else:
            # Skipped register entirely → likely theft
            journey.state = JourneyState.EXITED_WITHOUT_REGISTER

            # How fast did they exit after concealment?
            time_to_exit = timestamp - journey.concealment_time

            if time_to_exit < 30:
                # Very fast exit = grab and run
                journey.classification = TheftClassification.GRAB_AND_RUN
                journey.classification_confidence = 0.90
                journey.classification_reason = (
                    f"Concealed {journey.concealment_count} item(s) and exited "
                    f"within {time_to_exit:.0f}s without visiting register. "
                    f"High confidence theft."
                )
            else:
                journey.classification = TheftClassification.LIKELY_THEFT
                journey.classification_confidence = 0.80
                journey.classification_reason = (
                    f"Concealed {journey.concealment_count} item(s), "
                    f"never visited register, exited store after {time_to_exit:.0f}s."
                )

        # Fuse behavioral suspicion context into the final confidence
        self._fuse_confidence(journey)

        journey.classified_at = timestamp
        logger.warning(
            f"🏷️ CLASSIFIED: {journey.track_id} → {journey.classification.value} "
            f"({journey.classification_confidence:.0%}) — {journey.classification_reason}"
        )

        # Fire callback (handles async callbacks correctly)
        self._fire_callback(self.on_theft_classified, journey)

    def check_timeouts(self, current_time: float):
        """
        Check for journeys that have timed out (person lost from cameras).
        Called periodically by the pipeline.
        """
        timed_out = []
        for track_id, journey in list(self.active_journeys.items()):
            # Journey already classified (e.g. at an exit zone) — just drop it,
            # never re-fire the callback with a stale/overwritten classification.
            if journey.classified_at is not None:
                timed_out.append(track_id)
                continue

            elapsed = current_time - journey.last_seen

            if elapsed > self.exit_timeout_seconds:
                # Person disappeared — classify based on what we know
                if journey.state == JourneyState.AT_REGISTER:
                    # Was at register but disappeared
                    if journey.retrieval_detected:
                        journey.classification = TheftClassification.LIKELY_PAID
                        journey.classification_confidence = min(
                            0.95, 0.55 + self.retrieval_confidence_boost
                        )
                        journey.classification_reason = (
                            f"Retrieved concealed item at register "
                            f"(dwell {journey.register_dwell_seconds:.0f}s) before "
                            f"losing track. Concealed-then-paid pattern."
                        )
                    elif journey.register_dwell_seconds >= self.register_min_dwell:
                        journey.classification = TheftClassification.LIKELY_PAID
                        journey.classification_confidence = 0.65
                        journey.classification_reason = (
                            f"Was at register for {journey.register_dwell_seconds:.0f}s "
                            f"before losing track. Likely completed purchase."
                        )
                    else:
                        journey.classification = TheftClassification.PARTIAL_THEFT
                        journey.classification_confidence = 0.55
                        journey.classification_reason = (
                            f"Brief register visit ({journey.register_dwell_seconds:.0f}s) "
                            f"before losing track — concealed item(s) may not have been scanned."
                        )
                else:
                    # Never saw them at register or exit (covers TRACKING and
                    # any other non-register state)
                    journey.classification = TheftClassification.LIKELY_THEFT
                    journey.classification_confidence = 0.55
                    journey.classification_reason = (
                        f"Lost tracking after {elapsed:.0f}s. "
                        f"Concealed {journey.concealment_count} item(s), "
                        f"never visited register or known exit."
                    )

                # Fuse behavioral suspicion context into the final confidence
                self._fuse_confidence(journey)

                journey.classified_at = current_time
                timed_out.append(track_id)

                self._fire_callback(self.on_theft_classified, journey)

        for track_id in timed_out:
            self.active_journeys.pop(track_id, None)

    def correlate_pos_transaction(
        self,
        track_id: str,
        transaction_id: str,
        item_count: int,
        total: float,
    ):
        """
        Correlate a POS transaction with a tracked journey.
        Called when POS integration reports a transaction near the register.
        """
        if track_id not in self.active_journeys:
            return

        journey = self.active_journeys[track_id]
        journey.pos_transaction_id = transaction_id
        journey.pos_item_count = item_count
        journey.pos_total = total

        # Compare concealed count vs purchased count
        if item_count >= journey.concealment_count:
            journey.classification = TheftClassification.LIKELY_PAID
            journey.classification_confidence = 0.90
            journey.classification_reason = (
                f"POS transaction #{transaction_id}: {item_count} items, "
                f"${total:.2f}. Matches or exceeds {journey.concealment_count} "
                f"concealed item(s). Purchase confirmed."
            )
        else:
            journey.classification = TheftClassification.PARTIAL_THEFT
            journey.classification_confidence = 0.85
            journey.classification_reason = (
                f"POS transaction #{transaction_id}: only {item_count} items paid, "
                f"but {journey.concealment_count} concealment(s) detected. "
                f"Possible partial theft — {journey.concealment_count - item_count} "
                f"item(s) may be unpaid."
            )

        journey.classified_at = time.time()
        logger.info(
            f"POS correlation for {track_id}: {journey.classification.value} "
            f"({journey.classification_confidence:.0%})"
        )

    def get_active_journeys(self) -> List[PersonJourney]:
        """Get all currently tracked journeys."""
        return list(self.active_journeys.values())

    def get_journey(self, track_id: str) -> Optional[PersonJourney]:
        """Get a specific journey."""
        return self.active_journeys.get(track_id)

    def get_stats(self) -> Dict:
        """Get zone tracker statistics."""
        journeys = list(self.active_journeys.values())
        return {
            "active_journeys": len(journeys),
            "zones_configured": len(self.zones),
            "register_zones": len(self._zones_by_type[ZoneType.REGISTER]),
            "exit_zones": len(self._zones_by_type[ZoneType.EXIT]),
            "classifications": {
                c.value: sum(1 for j in journeys if j.classification == c)
                for c in TheftClassification
            },
        }
