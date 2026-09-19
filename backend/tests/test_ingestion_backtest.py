"""Validation pipeline: ingestion (red zones), historical events, backtest."""


def test_red_zones_ingestion_public(client):
    r = client.get("/api/validation/red-zones")
    assert r.status_code == 200
    body = r.json()
    villages = body["villages"]
    assert villages
    for v in villages:
        assert 0 <= v["hazard_severity"] <= 100
        assert v["name"]


def test_register_event_requires_official(client, volunteer_headers, official_headers):
    event = {
        "id": "EVT-TEST-01",
        "location_name": "Test Valley",
        "hazard_type": "LANDSLIDE",
        "date": "2021-07-20",
        "observed_severity": 4.5,
        "source": "pytest",
    }
    assert client.post("/api/validation/register-event", json=event).status_code == 403
    assert client.post(
        "/api/validation/register-event", json=event, headers=volunteer_headers
    ).status_code == 403
    r = client.post("/api/validation/register-event", json=event, headers=official_headers)
    assert r.status_code == 200
    assert r.json()["registered"] is True


def test_events_list_contains_registered(client, official_headers):
    event = {
        "id": "EVT-PUBLIC-01",
        "location_name": "Riverside",
        "hazard_type": "FLOOD",
        "date": "2022-08-11",
        "observed_severity": 4,
    }
    client.post("/api/validation/register-event", json=event, headers=official_headers)
    r = client.get("/api/events")
    assert r.status_code == 200
    ids = {row["id"] for row in r.json()}
    assert "EVT-PUBLIC-01" in ids


def test_backtest_kedarnath_2013(client):
    r = client.get("/api/validation/backtest")
    assert r.status_code == 200
    body = r.json()
    rows = body["rows"]
    assert rows, "backtest fixture should produce prediction rows"
    assert len(rows) >= 5

    for row in rows:
        assert 0 <= row["predicted_risk_score"] <= 100
        assert row["predicted_risk_level"] in {"SAFE", "MODERATE", "HIGH", "CRITICAL"}
        assert row["observed_severity"] >= 0

    # Metrics sanity: practical band tolerance >= strict exact match
    assert 0 <= body["accuracy_exact"] <= body["accuracy_within_one_level"] <= 1
    # A decision-support model must flag severe events (severity >= 4)
    assert body["critical_recall"] == 1.0
    assert 0 <= body["learning_confidence"] <= 0.95


def test_offline_manifest_shape(client):
    r = client.get("/api/offline-manifest")
    assert r.status_code == 200
    body = r.json()
    assert body["villages"]
    assert body["safe_zones"]
    assert body["risk_summary"]
    assert "sos_reports" in body
    assert "operational_priority" in body


def test_ground_reality_and_operational_priority(client):
    gr = client.get("/api/ground-reality")
    assert gr.status_code == 200
    assert gr.json()
    first = gr.json()[0]
    detail = client.get(f"/api/ground-reality/{first['village_id']}")
    assert detail.status_code == 200
    assert detail.json()["village_id"] == first["village_id"]
    assert client.get("/api/ground-reality/V999").status_code == 404

    op = client.get("/api/operational-priority")
    assert op.status_code == 200
    rows = op.json()
    assert rows
    for row in rows:
        assert row["population"] > 0
        assert row["operational_priority"] in {"IMMEDIATE", "URGENT", "HIGH", "MODERATE", "LOW"}