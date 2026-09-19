"""Risk engine, capacity ledger, safe zones, and relocation priority."""

LEVELS = {"SAFE", "MODERATE", "HIGH", "CRITICAL"}


def test_villages_public_list(client):
    r = client.get("/api/villages")
    assert r.status_code == 200
    villages = r.json()
    assert len(villages) >= 5
    for v in villages:
        assert v["risk_score"] >= 0 and v["risk_score"] <= 100
        assert v["risk_level"] in LEVELS
        assert v["explanation"]
        assert v["population"] > 0


def test_village_detail_and_404(client):
    r = client.get("/api/villages")
    first_id = r.json()[0]["id"]
    detail = client.get(f"/api/villages/{first_id}")
    assert detail.status_code == 200
    assert detail.json()["id"] == first_id
    assert client.get("/api/villages/DOES-NOT-EXIST").status_code == 404


def test_risk_summary_consistent(client):
    villages = client.get("/api/villages").json()
    summary = client.get("/api/risk-summary").json()
    assert summary["total_habitations"] == len(villages)
    dist = summary["risk_distribution"]
    assert sum(dist.values()) == len(villages)
    assert set(dist.keys()) == LEVELS
    critical = sum(1 for v in villages if v["risk_level"] == "CRITICAL")
    high = sum(1 for v in villages if v["risk_level"] == "HIGH")
    assert summary["high_or_critical"] == critical + high
    assert summary["capacity_gap"] >= 0


def test_safe_zones_capacity_ledger(client):
    r = client.get("/api/safe-zones")
    assert r.status_code == 200
    zones = r.json()
    assert len(zones) >= 1
    for z in zones:
        assert z["capacity"] > 0
        assert z["remaining_capacity"] >= 0
        assert z["allocated_population"] >= 0
        assert z["effective_capacity"] >= 0


def test_relocation_priority_sorted_desc(client):
    r = client.get("/api/relocation-priority")
    assert r.status_code == 200
    items = r.json()
    scores = [i["relocation_priority_score"] for i in items]
    assert scores == sorted(scores, reverse=True)
    assert all(i["relocation_required"] for i in items)
    assert all(i["people_requiring_relocation"] > 0 for i in items)


def test_villages_include_recommended_zone_fields(client):
    r = client.get("/api/villages")
    assert r.status_code == 200
    for v in r.json():
        assert "recommended_safe_zone_id" in v
        assert "recommended_safe_zone_name" in v
        assert "relocation_required" in v