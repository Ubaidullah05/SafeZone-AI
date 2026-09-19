"""Learning engine: adaptive weight state and adjudication-driven updates."""

from .conftest import DEMO_OFFICIAL


def _weights_sum(weights: dict) -> float:
    return round(sum(weights.values()), 2)


def test_learning_initial_state(client):
    r = client.get("/api/learning")
    assert r.status_code == 200
    st = r.json()
    assert st["n_observations"] == 0
    assert st["confidence"] == 0.0
    assert _weights_sum(st["weights"]) == 1.0
    assert set(st["weights"].keys()) >= {
        "hazard_severity", "slope_risk", "population_exposure",
        "accessibility_risk", "facility_access_risk", "historical_event_risk",
    }
    assert st["learning_rate"] == 0.35


def test_adjudication_updates_weights(client):
    token = client.post(
        "/api/auth/login", json={"email": DEMO_OFFICIAL[0], "password": DEMO_OFFICIAL[1]}
    ).json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}

    before = client.get("/api/learning").json()

    # Adjudicate the medical demo report (SOS003) with confirmed severity 5.
    r = client.post("/api/sos/adjudicate", json={
        "report_id": "SOS003",
        "actual_people_affected": 4,
        "actual_severity": 5,
        "outcome": "medical_aid",
        "note": "learning test",
    }, headers=h)
    assert r.status_code == 200

    after = client.get("/api/learning").json()
    assert after["n_observations"] == 1
    assert after["confidence"] > before["confidence"]
    assert after["confidence"] <= 0.95
    assert _weights_sum(after["weights"]) == 1.0
    # The observation tilted the Dirichlet posterior -> weights must differ
    assert after["weights"] != before["weights"]


def test_confidence_grows_with_observations(client):
    token = client.post(
        "/api/auth/login", json={"email": DEMO_OFFICIAL[0], "password": DEMO_OFFICIAL[1]}
    ).json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}

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
        confidences.append(client.get("/api/learning").json()["confidence"])

    assert confidences[0] < confidences[1] < confidences[2]
    assert client.get("/api/learning").json()["n_observations"] == 3