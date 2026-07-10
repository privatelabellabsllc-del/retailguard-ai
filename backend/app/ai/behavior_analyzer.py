"""
BehaviorAnalyzer — per-track rolling behavioral suspicion scoring.

Watches every tracked person (before AND after concealment) and produces a
0–1 `suspicion_score` from soft behavioral signals:

  - loitering:        dwell in one non-register zone longer than a threshold
  - repeated_passes:  re-entering the same zone >= N times
  - head_scanning:    frequent large head-yaw changes (looking around for
                      staff/cameras) — uses pose landmarks when available and
                      degrades gracefully when they are not
  - grab_and_run:     concealment followed by exit in under a short window

IMPORTANT: this score never triggers incidents on its own. It only enriches
theft-classification confidence and is surfaced to clerks as context on the
incident (behavior_score / behavior_signals).

Pure Python — no cv2/mediapipe/numpy required, so it imports and runs in
API-only mode.
"""
import logging
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

# Signal weights — sum can exceed 1.0; the final score is clamped.
SIGNAL_WEIGHTS = {
    "loitering": 0.30,
    "repeated_passes": 0.25,
    "head_scanning": 0.25,
    "grab_and_run": 0.35,
}


@dataclass
class TrackBehavior:
    """Rolling behavioral state for a single tracked person."""
    track_id: str
    first_seen: float = 0.0
    last_seen: float = 0.0

    # Zone dwell / revisit tracking
    current_zone: Optional[str] = None
    zone_enter_time: float = 0.0
    zone_entry_counts: Dict[str, int] = field(default_factory=dict)
    max_nonregister_dwell: float = 0.0
    max_dwell_zone: Optional[str] = None

    # Head-scanning (yaw proxy from pose landmarks)
    yaw_samples: Deque[Tuple[float, float]] = field(default_factory=lambda: deque(maxlen=60))
    head_scan_events: Deque[float] = field(default_factory=lambda: deque(maxlen=30))
    pose_available: bool = False

    # Concealment / exit timing (grab-and-run)
    concealment_time: Optional[float] = None
    exit_time: Optional[float] = None


class BehaviorAnalyzer:
    """
    Aggregates soft behavioral signals per track into a 0–1 suspicion score.

    Feed it observations from the pipeline:
      observe_zone(track_id, zone_id, zone_type, ts)  — current zone each frame
      observe_pose(track_id, keypoints, ts)           — pose landmarks (optional)
      note_concealment(track_id, ts)                  — concealment event fired
      note_exit(track_id, ts)                         — person hit an exit zone
    Then read:
      compute(track_id) -> (score, signals_dict)
    """

    def __init__(
        self,
        loiter_seconds: float = 120.0,
        repeat_zone_threshold: int = 3,
        grab_and_run_seconds: float = 60.0,
        head_scan_yaw_delta: float = 0.35,   # normalized yaw change counted as a "scan"
        head_scan_window: float = 20.0,      # seconds
        head_scan_min_events: int = 4,       # scans within window to flag signal
    ):
        self.loiter_seconds = loiter_seconds
        self.repeat_zone_threshold = max(2, int(repeat_zone_threshold))
        self.grab_and_run_seconds = grab_and_run_seconds
        self.head_scan_yaw_delta = head_scan_yaw_delta
        self.head_scan_window = head_scan_window
        self.head_scan_min_events = head_scan_min_events
        self._tracks: Dict[str, TrackBehavior] = {}

    # ------------------------------------------------------------------ #
    # Observations
    # ------------------------------------------------------------------ #

    def _track(self, track_id: str, timestamp: float) -> TrackBehavior:
        tb = self._tracks.get(track_id)
        if tb is None:
            tb = TrackBehavior(track_id=track_id, first_seen=timestamp, last_seen=timestamp)
            self._tracks[track_id] = tb
        tb.last_seen = timestamp
        return tb

    def observe_zone(
        self,
        track_id: str,
        zone_id: Optional[str],
        zone_type: Optional[str],
        timestamp: float,
    ):
        """
        Report which zone the person currently occupies (None if outside all
        zones). Call once per analyzed frame. Tracks dwell time per zone and
        counts distinct re-entries into the same zone.
        """
        tb = self._track(track_id, timestamp)
        zone_type = str(zone_type) if zone_type is not None else None

        if zone_id != tb.current_zone:
            # Zone transition — close out dwell for the previous zone
            tb.current_zone = zone_id
            tb.zone_enter_time = timestamp
            if zone_id is not None:
                tb.zone_entry_counts[zone_id] = tb.zone_entry_counts.get(zone_id, 0) + 1
        elif zone_id is not None:
            # Continued dwell in the same zone
            dwell = timestamp - tb.zone_enter_time
            if zone_type not in ("register", "exit", "entrance"):
                if dwell > tb.max_nonregister_dwell:
                    tb.max_nonregister_dwell = dwell
                    tb.max_dwell_zone = zone_id

    def observe_pose(self, track_id: str, keypoints: Optional[Dict], timestamp: float):
        """
        Report pose landmarks for head-yaw scanning analysis.
        `keypoints`: dict of name -> (x, y, visibility). Degrades gracefully —
        missing/None keypoints are simply ignored.
        """
        if not keypoints:
            return
        tb = self._track(track_id, timestamp)
        yaw = self._estimate_yaw(keypoints)
        if yaw is None:
            return
        tb.pose_available = True
        if tb.yaw_samples:
            _, prev_yaw = tb.yaw_samples[-1]
            if abs(yaw - prev_yaw) >= self.head_scan_yaw_delta:
                tb.head_scan_events.append(timestamp)
        tb.yaw_samples.append((timestamp, yaw))

    @staticmethod
    def _estimate_yaw(keypoints: Dict) -> Optional[float]:
        """
        Yaw proxy: horizontal offset of the nose from the midpoint between the
        ears (or shoulders as a fallback), normalized by the ear/shoulder span.
        Roughly -1 (hard left) .. +1 (hard right), 0 = facing camera.
        """
        try:
            nose = keypoints.get("nose")
            left = keypoints.get("left_ear") or keypoints.get("left_shoulder")
            right = keypoints.get("right_ear") or keypoints.get("right_shoulder")
            if not nose or not left or not right:
                return None
            # Respect visibility when provided as third element
            for pt in (nose, left, right):
                if len(pt) >= 3 and pt[2] is not None and pt[2] < 0.4:
                    return None
            span = abs(right[0] - left[0])
            if span < 1e-6:
                return None
            mid_x = (left[0] + right[0]) / 2.0
            return max(-1.5, min(1.5, (nose[0] - mid_x) / span))
        except Exception:
            return None

    def note_concealment(self, track_id: str, timestamp: float):
        """A concealment event fired for this track."""
        tb = self._track(track_id, timestamp)
        if tb.concealment_time is None:
            tb.concealment_time = timestamp

    def note_exit(self, track_id: str, timestamp: float):
        """Person entered an exit zone."""
        tb = self._track(track_id, timestamp)
        tb.exit_time = timestamp

    # ------------------------------------------------------------------ #
    # Scoring
    # ------------------------------------------------------------------ #

    def compute(self, track_id: str, now: Optional[float] = None) -> Tuple[float, Dict]:
        """
        Compute the current 0–1 suspicion score and the contributing signals.
        Returns (score, signals) — signals is JSON-serializable.
        """
        tb = self._tracks.get(track_id)
        if tb is None:
            return 0.0, {}
        now = now if now is not None else (tb.last_seen or time.time())

        # Include dwell in the zone they are currently standing in
        max_dwell = tb.max_nonregister_dwell
        if tb.current_zone is not None:
            # current_zone dwell only counts if it was being tracked as
            # non-register (max_nonregister_dwell already handles that via
            # observe_zone); still fold in live dwell for responsiveness
            live_dwell = now - tb.zone_enter_time
            if live_dwell > max_dwell and tb.current_zone == tb.max_dwell_zone:
                max_dwell = live_dwell

        loitering = max_dwell >= self.loiter_seconds

        max_revisits = max(tb.zone_entry_counts.values()) if tb.zone_entry_counts else 0
        repeated_passes = max_revisits >= self.repeat_zone_threshold

        recent_scans = [t for t in tb.head_scan_events if now - t <= self.head_scan_window]
        head_scanning = tb.pose_available and len(recent_scans) >= self.head_scan_min_events

        grab_and_run = (
            tb.concealment_time is not None
            and tb.exit_time is not None
            and (tb.exit_time - tb.concealment_time) <= self.grab_and_run_seconds
        )

        signals = {
            "loitering": loitering,
            "loiter_seconds": round(max_dwell, 1),
            "loiter_zone": tb.max_dwell_zone,
            "repeated_passes": repeated_passes,
            "max_zone_revisits": max_revisits,
            "head_scanning": head_scanning,
            "head_scan_events": len(recent_scans),
            "pose_available": tb.pose_available,
            "grab_and_run": grab_and_run,
        }

        score = 0.0
        if loitering:
            score += SIGNAL_WEIGHTS["loitering"]
        if repeated_passes:
            score += SIGNAL_WEIGHTS["repeated_passes"]
        if head_scanning:
            score += SIGNAL_WEIGHTS["head_scanning"]
        if grab_and_run:
            score += SIGNAL_WEIGHTS["grab_and_run"]

        score = max(0.0, min(1.0, score))
        signals["suspicion_score"] = round(score, 3)
        return score, signals

    # ------------------------------------------------------------------ #
    # Housekeeping
    # ------------------------------------------------------------------ #

    def clear_track(self, track_id: str):
        self._tracks.pop(track_id, None)

    def prune(self, now: float, max_age: float = 900.0):
        """Drop tracks not seen for `max_age` seconds."""
        stale = [tid for tid, tb in self._tracks.items() if now - tb.last_seen > max_age]
        for tid in stale:
            self._tracks.pop(tid, None)

    def get_active_track_count(self) -> int:
        return len(self._tracks)
