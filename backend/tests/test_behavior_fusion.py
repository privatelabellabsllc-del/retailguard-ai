"""
Simulated-journey tests for the behavioral theft-intelligence brain.

Runs WITHOUT cameras, cv2, or mediapipe — exercises ZoneTracker fusion,
BehaviorAnalyzer scoring, and the retrieval-gesture detector on synthetic
pose data.

Run:  cd backend && python3 -m pytest tests/ -v
  or: cd backend && python3 tests/test_behavior_fusion.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.ai.zone_tracker import (
    ZoneTracker, ZoneDefinition, ZoneType, TheftClassification,
)
from app.ai.behavior_analyzer import BehaviorAnalyzer

FRAME_W, FRAME_H = 1000, 1000

# Zone layout (normalized): shelf on the left, register mid, exit on the right
SHELF_POLY = [(0.0, 0.0), (0.3, 0.0), (0.3, 1.0), (0.0, 1.0)]
REGISTER_POLY = [(0.4, 0.0), (0.6, 0.0), (0.6, 1.0), (0.4, 1.0)]
EXIT_POLY = [(0.8, 0.0), (1.0, 0.0), (1.0, 1.0), (0.8, 1.0)]

SHELF_BBOX = (100, 400, 200, 600)      # center (150, 500) -> shelf
REGISTER_BBOX = (450, 400, 550, 600)   # center (500, 500) -> register
EXIT_BBOX = (850, 400, 950, 600)       # center (900, 500) -> exit


def make_tracker(captured):
    tracker = ZoneTracker(
        on_theft_classified=lambda j: captured.append(j),
        register_min_dwell=15.0,
        retrieval_confidence_boost=0.35,
        behavior_weight=0.15,
    )
    tracker.add_zone(ZoneDefinition("shelf1", ZoneType.SHELF, "cam1", SHELF_POLY, "Shelf"))
    tracker.add_zone(ZoneDefinition("reg1", ZoneType.REGISTER, "cam1", REGISTER_POLY, "Register"))
    tracker.add_zone(ZoneDefinition("exit1", ZoneType.EXIT, "cam1", EXIT_POLY, "Exit"))
    return tracker


def walk(tracker, track_id, bbox, t_from, t_to, step=1.0):
    t = t_from
    while t <= t_to:
        tracker.update_position(track_id, bbox, FRAME_W, FRAME_H, t, "cam1")
        t += step


# --------------------------------------------------------------------------- #
# Scenario 1: conceal → register → RETRIEVAL → pay → exit  ==> LIKELY_PAID
# --------------------------------------------------------------------------- #
def test_paid_with_retrieval():
    captured = []
    tracker = make_tracker(captured)
    tracker.start_journey("p1", None, "cam1", concealment_time=0.0,
                          concealment_description="item to jacket pocket")
    walk(tracker, "p1", SHELF_BBOX, 1, 9)
    walk(tracker, "p1", REGISTER_BBOX, 10, 50)          # 40s at register
    tracker.record_retrieval("p1", 30.0, confidence=0.85)  # pulls item back out
    walk(tracker, "p1", EXIT_BBOX, 55, 55)

    assert len(captured) == 1
    j = captured[0]
    assert j.classification == TheftClassification.LIKELY_PAID
    assert j.retrieval_detected is True
    assert abs(j.classification_confidence - 0.90) < 1e-6, j.classification_confidence
    print(f"  paid-with-retrieval  -> {j.classification.value} @ {j.classification_confidence:.2f}")


# --------------------------------------------------------------------------- #
# Scenario 2: conceal → skip register → exit  ==> LIKELY_THEFT
# --------------------------------------------------------------------------- #
def test_theft_walkout():
    captured = []
    tracker = make_tracker(captured)
    tracker.start_journey("p2", None, "cam1", concealment_time=0.0)
    walk(tracker, "p2", SHELF_BBOX, 1, 55)
    walk(tracker, "p2", EXIT_BBOX, 60, 60)

    j = captured[0]
    assert j.classification == TheftClassification.LIKELY_THEFT
    assert j.classification_confidence >= 0.80
    print(f"  theft-walkout        -> {j.classification.value} @ {j.classification_confidence:.2f}")


# --------------------------------------------------------------------------- #
# Scenario 3: conceal → brief register, NO retrieval → exit ==> PARTIAL_THEFT
# --------------------------------------------------------------------------- #
def test_partial_theft():
    captured = []
    tracker = make_tracker(captured)
    tracker.start_journey("p3", None, "cam1", concealment_time=0.0)
    walk(tracker, "p3", SHELF_BBOX, 1, 9)
    walk(tracker, "p3", REGISTER_BBOX, 10, 15)          # only 5s at register
    walk(tracker, "p3", EXIT_BBOX, 20, 20)

    j = captured[0]
    assert j.classification == TheftClassification.PARTIAL_THEFT
    assert "no retrieval" in j.classification_reason
    print(f"  partial-theft        -> {j.classification.value} @ {j.classification_confidence:.2f}")


# --------------------------------------------------------------------------- #
# Scenario 4: conceal → sprint to exit  ==> GRAB_AND_RUN (behavior boosts it)
# --------------------------------------------------------------------------- #
def test_grab_and_run():
    captured = []
    tracker = make_tracker(captured)
    analyzer = BehaviorAnalyzer(loiter_seconds=120, repeat_zone_threshold=3)

    tracker.start_journey("p4", None, "cam1", concealment_time=0.0)
    analyzer.note_concealment("p4", 0.0)
    for t in range(1, 15):
        analyzer.observe_zone("p4", "shelf1", "shelf", float(t))
        tracker.update_position("p4", SHELF_BBOX, FRAME_W, FRAME_H, float(t), "cam1")
    analyzer.note_exit("p4", 15.0)
    score, signals = analyzer.compute("p4", now=15.0)
    tracker.set_behavior("p4", score, signals)
    walk(tracker, "p4", EXIT_BBOX, 15, 15)

    j = captured[0]
    assert j.classification == TheftClassification.GRAB_AND_RUN
    assert signals["grab_and_run"] is True
    # base 0.90 + 0.15 * score(0.35) ≈ 0.9525
    assert j.classification_confidence > 0.90
    assert j.behavior_score == score > 0
    print(f"  grab-and-run         -> {j.classification.value} @ {j.classification_confidence:.2f} "
          f"(behavior {score:.2f})")


# --------------------------------------------------------------------------- #
# Scenario 5: LOITER 150s → conceal → register + retrieval → exit ==> LIKELY_PAID
# (behavior only mildly tempers paid confidence, never flips it)
# --------------------------------------------------------------------------- #
def test_loiter_then_pay():
    captured = []
    tracker = make_tracker(captured)
    analyzer = BehaviorAnalyzer(loiter_seconds=120, repeat_zone_threshold=3)

    # Loiter in the shelf zone for 150s before concealing
    for t in range(0, 151, 5):
        analyzer.observe_zone("p5", "shelf1", "shelf", float(t))
    tracker.start_journey("p5", None, "cam1", concealment_time=150.0)
    analyzer.note_concealment("p5", 150.0)
    walk(tracker, "p5", REGISTER_BBOX, 155, 195)        # 40s at register
    tracker.record_retrieval("p5", 170.0, confidence=0.8)
    score, signals = analyzer.compute("p5", now=195.0)
    tracker.set_behavior("p5", score, signals)
    walk(tracker, "p5", EXIT_BBOX, 200, 200)

    j = captured[0]
    assert signals["loitering"] is True and score > 0
    assert j.classification == TheftClassification.LIKELY_PAID
    # 0.90 tempered mildly: 0.90 - 0.5*0.15*0.30 = 0.8775
    assert j.classification_confidence >= 0.85
    print(f"  loiter-then-pay      -> {j.classification.value} @ {j.classification_confidence:.2f} "
          f"(behavior {score:.2f}, loitering={signals['loitering']})")


# --------------------------------------------------------------------------- #
# Scenario 6: timeout at register WITH retrieval ==> LIKELY_PAID
# --------------------------------------------------------------------------- #
def test_timeout_at_register_with_retrieval():
    captured = []
    tracker = make_tracker(captured)
    tracker.start_journey("p6", None, "cam1", concealment_time=0.0)
    walk(tracker, "p6", REGISTER_BBOX, 5, 45)
    tracker.record_retrieval("p6", 20.0, confidence=0.9)
    tracker.check_timeouts(300.0)  # lost track — timed out

    j = captured[0]
    assert j.classification == TheftClassification.LIKELY_PAID
    assert abs(j.classification_confidence - 0.90) < 1e-6
    print(f"  timeout+retrieval    -> {j.classification.value} @ {j.classification_confidence:.2f}")


# --------------------------------------------------------------------------- #
# BehaviorAnalyzer signal unit checks
# --------------------------------------------------------------------------- #
def test_repeated_aisle_passes():
    analyzer = BehaviorAnalyzer(repeat_zone_threshold=3)
    t = 0.0
    for _ in range(3):  # enter aisle3, leave, re-enter... 3 entries total
        analyzer.observe_zone("r1", "aisle3", "shelf", t); t += 5
        analyzer.observe_zone("r1", None, None, t); t += 5
    score, signals = analyzer.compute("r1", now=t)
    assert signals["repeated_passes"] is True
    assert signals["max_zone_revisits"] == 3
    assert score > 0
    print(f"  repeated-passes      -> score {score:.2f}, revisits {signals['max_zone_revisits']}")


def test_head_scanning_and_graceful_degradation():
    analyzer = BehaviorAnalyzer()
    # Graceful: no/garbage keypoints must not raise or count
    analyzer.observe_pose("h1", None, 0.0)
    analyzer.observe_pose("h1", {"nose": (10, 10, 0.9)}, 0.1)  # missing ears
    score, signals = analyzer.compute("h1", now=1.0)
    assert signals.get("head_scanning", False) is False

    # Rapid left/right head swings -> scanning signal
    t = 0.0
    for i in range(12):
        nose_x = 40 if i % 2 == 0 else 60   # swings across the ear midpoint
        kp = {
            "nose": (nose_x, 20, 0.9),
            "left_ear": (30, 22, 0.9),
            "right_ear": (70, 22, 0.9),
        }
        analyzer.observe_pose("h2", kp, t)
        t += 1.0
    score, signals = analyzer.compute("h2", now=t)
    assert signals["head_scanning"] is True
    assert score > 0
    print(f"  head-scanning        -> score {score:.2f}, events {signals['head_scan_events']}")


def test_behavior_never_classifies_alone():
    """A high behavior score with NO concealment journey must produce nothing."""
    captured = []
    tracker = make_tracker(captured)
    analyzer = BehaviorAnalyzer(loiter_seconds=10)
    for t in range(0, 100, 2):
        analyzer.observe_zone("b1", "shelf1", "shelf", float(t))
    score, _ = analyzer.compute("b1", now=100.0)
    assert score > 0
    # No journey exists — set_behavior and updates are no-ops, nothing fires
    tracker.set_behavior("b1", score, {})
    walk(tracker, "b1", EXIT_BBOX, 101, 101)
    assert captured == []
    print(f"  score-alone-no-fire  -> score {score:.2f}, incidents fired: 0")


# --------------------------------------------------------------------------- #
# Retrieval gesture detector on synthetic pose data (no mediapipe needed)
# --------------------------------------------------------------------------- #
def test_retrieval_gesture_detector():
    from app.ai.concealment_detector import (
        ConcealmentDetector, PoseFrame, HandState,
    )
    from collections import deque

    det = ConcealmentDetector()
    frames = deque(maxlen=150)

    hip = (100.0, 300.0, 0.9)
    shoulder = (100.0, 100.0, 0.9)

    def pf(i, t, wrist_y, state):
        return PoseFrame(
            timestamp=t, frame_number=i,
            keypoints={
                "right_wrist": (100.0, wrist_y, 0.9),
                "right_hip": hip,
                "right_shoulder": shoulder,
            },
            right_hand_state=state,
        )

    t = 1000.0  # realistic epoch-style timestamps (cooldown baseline is 0.0)
    i = 0
    # Hand at counter level, empty
    for _ in range(6):
        frames.append(pf(i, t, 180.0, HandState.EMPTY)); i += 1; t += 0.2
    # Hand dips to pocket (near hip y=300)
    for _ in range(4):
        frames.append(pf(i, t, 295.0, HandState.UNCERTAIN)); i += 1; t += 0.2
    # Hand rises back to counter level HOLDING the item
    for _ in range(6):
        frames.append(pf(i, t, 170.0, HandState.HOLDING_ITEM)); i += 1; t += 0.2

    det._active_tracks["reg_person"] = frames
    event = det.detect_retrieval("reg_person", timestamp=t)
    assert event is not None
    assert event.confidence >= 0.6
    assert event.details["holding_transition"] is True
    print(f"  retrieval-detector   -> confidence {event.confidence:.2f} ({event.hand_used} hand)")

    # Cooldown: immediate second call must not re-fire
    assert det.detect_retrieval("reg_person", timestamp=t + 1.0) is None


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    print(f"Running {len(tests)} simulated-journey tests...")
    for fn in tests:
        fn()
    print("ALL TESTS PASSED")
