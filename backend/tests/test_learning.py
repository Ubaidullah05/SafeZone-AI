"""Learning engine: adaptive weight state and adjudication-driven updates.

Weight detail now lives behind the official-only /api/learning/weights
endpoint (the public /api/learning deliberately omits weights so the driving
signals are not exposed). These tests therefore use the official endpoint.
"""

from .conftest import DEMO_OFFICIAL


def _weights_sum(weights: dict) -> float:
    return round(sum(weights.values()), 2)


def _auth(client) -> dict:
    token = client.post(
        "/api/auth/login", json={"email": DEMO_OFFICIAL[0], "password": DEMO_OFFICIAL[1]}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _weights(client) -> dict:
    """Full learning state from the official-only endpoint."""
    r = client.get("/api/learning/weights", headers=_auth(client))
    assert r.status_code == 200
    return r.json()


def test_learning_initial_state(client):
    st = _weights(client)
    assert st["n_observations"] == 0
    assert st["n_live_observations"] == 0
    assert st["confidence"] == 0.0
    assert _weights_sum(st["weights"]) == 1.0
    assert set(st["weights"].keys()) >= {
        "hazard_severity", "slope_risk", "population_exposure",
        "accessibility_risk", "facility_access_risk", "historical_event_risk",
    }
    assert st["learning_rate"] == 0.35


def test_adjudication_updates_weights(client):
    h = _auth(client)

    before = _weights(client)

    # Adjudicate the medical demo report (SOS003) with confirmed severity 5.
    r = client.post("/api/sos/adjudicate", json={
        "report_id": "SOS003",
        "actual_people_affected": 4,
        "actual_severity": 5,
        "outcome": "medical_aid",
        "note": "learning test",
    }, headers=h)
    assert r.status_code == 200

    after = _weights(client)
    assert after["n_observations"] == 1
    assert after["n_live_observations"] == 1
    assert after["confidence"] > before["confidence"]
    assert after["confidence"] <= 0.95
    assert _weights_sum(after["weights"]) == 1.0
    # One observation cannot establish a correlation, so the prior is correctly
    # retained. Re-weighting is covered by test_weights_move_with_enough_evidence.
    assert after["weights"] == before["weights"]


def test_weights_move_with_enough_evidence(client):
    """Re-weighting requires enough observations to compute a correlation."""
    h = _auth(client)

    before = _weights(client)["weights"]

    for i, (report_id, severity) in enumerate(
        (("SOS001", 5), ("SOS002", 1), ("SOS003", 5)), start=1
    ):
        r = client.post("/api/sos/adjudicate", json={
            "report_id": report_id,
            "actual_people_affected": 2,
            "actual_severity": severity,
            "outcome": "no_action",
            "note": f"evidence {i}",
        }, headers=h)
        assert r.status_code == 200

    after = _weights(client)
    assert after["n_observations"] == 3
    assert _weights_sum(after["weights"]) == 1.0
    assert after["weights"] != before, "weights must re-weight once evidence exists"


def test_confidence_grows_with_observations(client):
    h = _auth(client)

    confidences = []
    for i, report_id in enumerate(("SOS001", "SOS002", "SOS003"), start=1):
        r = client.post("/api/sos/adjudicate", json={
            "report_id": report_id,
            "actual_people_affected": 2,
            "actual_severity": 3,
            "outcome": "no_action",
            "note": f"obs {i}",
        }, headers=h)
        assert r.status_code == 200
        confidences.append(_weights(client)["confidence"])

    assert confidences[0] < confidences[1] < confidences[2]
    assert _weights(client)["n_observations"] == 3
