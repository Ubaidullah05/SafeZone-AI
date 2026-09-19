"""Relocation recommendations and the scenario (what-if) engine."""


def _villages(client):
    r = client.get("/api/villages")
    assert r.status_code == 200
    return r.json()


def test_recommendation_for_high_risk_village(client):
    villages = _villages(client)
    need = [v for v in villages if v["relocation_required"]]
    assert need, "expected at least one habitation requiring relocation in demo data"
    v = need[0]
    r = client.get(f"/api/recommendation/{v['id']}")
    assert r.status_code == 200
    rec = r.json()
    assert rec["village_id"] == v["id"]
    assert rec["people_requiring_relocation"] > 0
    assert rec["recommended"] is not None
    assert rec["recommended"]["safe_zone_name"]
    assert rec["recommended"]["destination_score"] >= 0
    assert rec["alternatives"]  # at least one fallback destination


def test_recommendation_no_relocation(client):
    villages = _villages(client)
    safe_some = [v for v in villages if not v["relocation_required"]]
    if not safe_some:
        return  # dataset may flag every village; not a failure
    v = safe_some[0]
    r = client.get(f"/api/recommendation/{v['id']}")
    assert r.status_code == 200
    assert r.json()["people_requiring_relocation"] == 0
    assert r.json()["recommended"] is None


def test_recommendation_unknown_404(client):
    assert client.get("/api/recommendation/V999").status_code == 404


def test_scenario_baseline_comparison_zeros(client):
    r = client.post("/api/scenario", json={})
    assert r.status_code == 200
    sr = r.json()
    assert sr["comparison"]["additional_population_at_risk"] == 0
    assert sr["comparison"]["after_population_at_risk"] == sr["comparison"]["before_population_at_risk"]
    assert len(sr["villages"]) == len(_villages(client))
    assert len(sr["safe_zones"]) >= 1


def test_scenario_hazard_increase_raises_risk(client):
    base = client.post("/api/scenario", json={}).json()["comparison"]
    worse = client.post("/api/scenario", json={"hazard_severity_delta_pct": 45}).json()["comparison"]
    assert worse["additional_population_at_risk"] >= 0
    assert worse["after_population_at_risk"] >= base["before_population_at_risk"]


def test_scenario_road_closure_impact(client):
    r = client.post("/api/scenario", json={"road_closure": True})
    assert r.status_code == 200
    sr = r.json()
    assert sr["comparison"]["additional_population_at_risk"] >= 0
    for v in sr["villages"]:
        assert v["risk_level"] in {"SAFE", "MODERATE", "HIGH", "CRITICAL"}


def test_advisory_public(client):
    r = client.get("/api/advisory")
    assert r.status_code == 200
    body = r.json()
    assert body["district"]["recommended_action"]
    assert len(body["habitations"]) == len(_villages(client))


def test_village_advisory_and_404(client):
    v = _villages(client)[0]
    r = client.get(f"/api/advisory/{v['id']}")
    assert r.status_code == 200
    assert r.json()["village_id"] == v["id"]
    assert client.get("/api/advisory/V999").status_code == 404