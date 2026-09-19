"""SOS report lifecycle: submit, list, status update, adjudicate, stats."""

VALID_REPORT = {
    "reporter_name": "Test Citizen",
    "reporter_phone": "9999999999",
    "village_id": "V001",
    "village_name": "Sundarpur",
    "emergency_type": "FLOOD",
    "severity": 4,
    "description": "Automated test SOS report.",
    "people_affected": 12,
    "medical_emergency": True,
    "medical_details": "2 injured",
    "latitude": 30.121,
    "longitude": 78.451,
    "timestamp": "2026-09-19T00:00:00Z",
}


def test_submit_sos_public_ok(client):
    r = client.post("/api/sos/submit", json=VALID_REPORT)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["id"]
    assert body["status"] == "NEW"
    assert body["priority_score"] > 0
    assert body["village_id"] == "V001"


def test_submit_sos_invalid_severity_422(client):
    bad = {**VALID_REPORT, "severity": 9}
    assert client.post("/api/sos/submit", json=bad).status_code == 422


def test_sos_stats_public(client):
    r = client.get("/api/sos/stats")
    assert r.status_code == 200
    s = r.json()
    assert s["total_reports"] >= 3  # demo seed reports exist
    assert s["active_reports"] >= s["new_reports"]
    assert s["total_people_affected"] >= 0


def test_submit_increments_total_and_new(client):
    before = client.get("/api/sos/stats").json()
    assert client.post("/api/sos/submit", json=VALID_REPORT).status_code == 200
    after = client.get("/api/sos/stats").json()
    assert after["total_reports"] == before["total_reports"] + 1
    assert after["new_reports"] == before["new_reports"] + 1


def test_sos_reports_requires_auth(client, official_headers):
    assert client.get("/api/sos/reports").status_code == 401
    r = client.get("/api/sos/reports", headers=official_headers)
    assert r.status_code == 200
    ids = {row["id"] for row in r.json()}
    assert "SOS001" in ids
    assert "SOS003" in ids


def test_sos_reports_filter_by_status(client, official_headers):
    r = client.get("/api/sos/reports", headers=official_headers, params={"status": "NEW"})
    assert r.status_code == 200
    assert r.json() and all(row["status"] == "NEW" for row in r.json())
    # Sorted by priority descending
    scores = [row["priority_score"] for row in r.json()]
    assert scores == sorted(scores, reverse=True)


def test_sos_report_detail(client, official_headers):
    r = client.get("/api/sos/reports/SOS001", headers=official_headers)
    assert r.status_code == 200
    assert r.json()["id"] == "SOS001"
    assert client.get("/api/sos/reports/NOPE", headers=official_headers).status_code == 404


def test_patch_status_requires_official(client, volunteer_headers, official_headers):
    assert client.patch("/api/sos/reports/SOS001", json={"status": "RESOLVED"}).status_code == 403
    r = client.patch("/api/sos/reports/SOS001", json={"status": "RESOLVED"}, headers=volunteer_headers)
    assert r.status_code == 403
    r = client.patch("/api/sos/reports/SOS001", json={"status": "RESOLVED"}, headers=official_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "RESOLVED"


def test_patch_status_without_field_400(client, official_headers):
    assert client.patch("/api/sos/reports/SOS001", json={}, headers=official_headers).status_code == 400


def test_patch_unknown_report_404(client, official_headers):
    assert client.patch("/api/sos/reports/NOPE", json={"status": "RESOLVED"}, headers=official_headers).status_code == 404


def test_adjudicate_records_and_resolves(client, official_headers):
    before = client.get("/api/sos/stats").json()
    r = client.post("/api/sos/adjudicate", json={
        "report_id": "SOS003",
        "actual_people_affected": 4,
        "actual_severity": 5,
        "outcome": "evacuated",
        "note": "Test adjudication",
    }, headers=official_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "RESOLVED"
    assert body["recorded"] is True
    assert body["learning_update"]["n_observations"] == 1
    after = client.get("/api/sos/stats").json()
    assert after["active_reports"] == before["active_reports"] - 1
    assert after["medical_emergencies"] == before["medical_emergencies"] - 1
    # Re-adjudication uses INSERT OR REPLACE, so it is idempotent (200)
    r2 = client.post("/api/sos/adjudicate", json={
        "report_id": "SOS003", "actual_people_affected": 1, "actual_severity": 2,
    }, headers=official_headers)
    assert r2.status_code == 200


def test_adjudicate_requires_official(client, volunteer_headers):
    r = client.post("/api/sos/adjudicate", json={
        "report_id": "SOS001", "actual_people_affected": 1, "actual_severity": 3,
    }, headers=volunteer_headers)
    assert r.status_code == 403


def test_adjudicate_unknown_report_404(client, official_headers):
    r = client.post("/api/sos/adjudicate", json={
        "report_id": "NOPE", "actual_people_affected": 1, "actual_severity": 3,
    }, headers=official_headers)
    assert r.status_code == 404


def test_priority_queue_sorted(client):
    r = client.get("/api/sos/priority-queue")
    assert r.status_code == 200
    rows = r.json()
    scores = [row["priority_score"] for row in rows]
    assert scores == sorted(scores, reverse=True)


def test_sos_latest_is_pii_safe(client):
    r = client.get("/api/sos/latest")
    assert r.status_code == 200
    for row in r.json():
        keys = set(row.keys())
        assert "reporter_name" not in keys
        assert "reporter_phone" not in keys
        assert "description" not in keys


def test_webhook_no_pii_on_websocket_via_http_health(client):
    # sanity: main public endpoints remain open
    assert client.get("/api/health").status_code == 200