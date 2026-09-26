"""Historical learning: correlation weighting, seeding, provenance, and auth split."""

import json

import pytest

from .conftest import DEMO_OFFICIAL


# ---------------------------------------------------------------------------
# Correlation weighting (the core fix)
# ---------------------------------------------------------------------------

def test_pearson_requires_spread():
    from app.learning_engine import _pearson
    assert _pearson([1.0], [5.0]) == 0.0
    # A constant factor carries no information about the outcome.
    assert _pearson([3.0, 3.0, 3.0], [1.0, 2.0, 3.0]) == 0.0


def test_pearson_detects_perfect_and_inverse_relations():
    from app.learning_engine import _pearson
    assert _pearson([1, 2, 3, 4], [10, 20, 30, 40]) == pytest.approx(1.0)
    assert _pearson([1, 2, 3, 4], [40, 30, 20, 10]) == pytest.approx(-1.0)


def test_red_herring_factor_is_not_reinforced():
    """
    The bug being fixed: an additive update only ever ADDS weight.

    slope_risk is high on every event but does not track severity, so it must
    not end up with more weight than a factor that genuinely predicts outcome.
    """
    from app.learning_engine import _correlation_weights, FACTORS

    obs = []
    for i in range(6):
        # accessibility genuinely tracks severity; slope is a constant red herring.
        obs.append({
            "factors": {
                "hazard_severity": 20.0 + i * 10,
                "slope_risk": 90.0,  # always high, never predictive
                "population_exposure": 20.0 + i * 10,
                "accessibility_risk": 20.0 + i * 10,
                "facility_access_risk": 20.0 + i * 10,
                "historical_event_risk": 20.0 + i * 10,
            },
            "severity": float(1 + i),
        })

    weights, r = _correlation_weights(obs)
    assert r["slope_risk"] == 0.0
    assert weights["slope_risk"] < weights["accessibility_risk"]
    assert sum(weights.values()) == pytest.approx(1.0)
    assert set(weights.keys()) == set(FACTORS)


def test_uniform_when_nothing_discriminates():
    from app.learning_engine import _correlation_weights

    obs = [
        {"factors": {f: 50.0 for f in _correlation_weights.__globals__["FACTORS"]},
         "severity": float(i % 5)}
        for i in range(8)
    ]
    weights, r = _correlation_weights(obs)
    assert all(v == 0.0 for v in r.values())
    for v in weights.values():
        assert v == pytest.approx(1 / len(weights))


def test_prior_retained_below_minimum_evidence():
    from app.learning_engine import _correlation_weights, DEFAULT_WEIGHTS

    obs = [
        {"factors": {"hazard_severity": 10.0 * i, "slope_risk": 5.0},
         "severity": float(i + 1)}
        for i in range(2)  # n=2 < MIN_OBSERVATIONS_FOR_CORRELATION
    ]
    weights, _ = _correlation_weights(obs)
    assert weights == DEFAULT_WEIGHTS


# ---------------------------------------------------------------------------
# Blending and normalisation
# ---------------------------------------------------------------------------

def test_blend_clamps_to_unit_interval():
    from app.learning_engine import _blend, DEFAULT_WEIGHTS

    learned = {f: 1.0 / 6 for f in DEFAULT_WEIGHTS}
    assert _blend(DEFAULT_WEIGHTS, learned, 0) == pytest.approx(DEFAULT_WEIGHTS)
    full = _blend(DEFAULT_WEIGHTS, learned, 999)
    for v in full.values():
        assert v == pytest.approx(1 / 6, abs=1e-9)
    mid = _blend(DEFAULT_WEIGHTS, learned, 4)
    assert sum(mid.values()) == pytest.approx(1.0)


def test_weights_always_sum_to_one(client):
    r = client.get("/api/learning/weights", headers=_auth(client))
    assert r.status_code == 200
    assert round(sum(r.json()["weights"].values()), 4) == 1.0


# ---------------------------------------------------------------------------
# Seeding, idempotency, and confidence isolation
# ---------------------------------------------------------------------------

def test_seed_is_idempotent(client):
    from app import historical_seed
    from app.learning_engine import observation_count

    first = historical_seed.seed_if_needed(force=True)
    n = observation_count("historical")
    assert n == first["n_historical_observations"]

    second = historical_seed.seed_if_needed()
    assert second["seeded"] is False
    assert second["reason"] == "already_seeded"
    assert observation_count("historical") == n, "re-seeding must not duplicate"


def test_historical_evidence_does_not_inflate_live_confidence(client):
    """The most important honesty guarantee in this feature."""
    from app import historical_seed

    s = historical_seed.seed_if_needed(force=True)
    assert s["n_historical_observations"] > 0
    assert s["n_live_observations"] == 0
    assert s["confidence"] == 0.0, "corpus replay must not create live confidence"
    assert s["historical_confidence"] > 0.0, "but historical evidence is reported"

    pub = client.get("/api/learning").json()
    assert pub["confidence"] == 0.0
    assert pub["historical_confidence"] > 0.0
    assert pub["n_historical_observations"] > 0


def test_corpus_provenance_is_preserved(client):
    from app import historical_seed

    s = historical_seed.seed_if_needed(force=True)
    split = s["weights"] and client.get("/api/learning").json()["provenance_split"]
    assert split["documented"] > 0, "Kedarnath locations must be labelled documented"
    assert split["derived"] > 0, "constructed scenarios must be labelled derived"
    assert split["documented"] + split["derived"] == split["historical"]


def test_corpus_contains_no_fabricated_claims():
    """Derived events must be self-describing so they cannot pass as records."""
    from app.historical_seed import load_corpus

    corpus = load_corpus()
    assert "honesty_note" in corpus
    for e in corpus["events"]:
        if e["provenance"] == "derived":
            assert "NOT" in e["source"] or "not an observed" in e["source"].lower()
            assert e["derivation"], "every derived event must say what it came from"
        if e["provenance"] == "documented":
            assert e["source"], "documented events must carry their source caveat"


def test_corpus_has_varied_outcomes():
    """A corpus where every factor is high teaches nothing."""
    from app.historical_seed import load_corpus

    sev = [e["observed_severity"] for e in load_corpus()["events"]]
    assert len(set(sev)) >= 4, "severity must vary for correlation to mean anything"


# ---------------------------------------------------------------------------
# Crossed-design recovery: the pipeline self-test
# ---------------------------------------------------------------------------

def test_corpus_is_crossed_not_collinear():
    """
    The whole point of v2.0. v1.0 inherited the village data, whose factors
    are near-perfectly correlated (hazard<->slope r=+0.99), making the
    factors mathematically impossible to separate.
    """
    from app.historical_seed import load_corpus

    derived = [e for e in load_corpus()["events"] if e["provenance"] == "derived"]
    assert len(derived) >= 60, "need enough derived events to separate factors"

    for f in ("hazard_severity", "slope_risk", "population_exposure",
              "accessibility_risk", "facility_access_risk", "historical_event_risk"):
        vals = [e["factors"][f] for e in derived]
        spread = max(vals) - min(vals)
        assert spread > 50, f"{f} range is too narrow to be informative ({spread})"


def test_engine_recovers_planted_causal_ranking():
    """
    The headline self-test: the three planted drivers must outrank the three
    controls. This is evidence the LEARNING PIPELINE works - it is NOT
    evidence that road access causes disasters in reality.
    """
    from app.historical_seed import load_corpus
    from app.learning_engine import _pearson, FACTORS

    corpus = load_corpus()
    derived = [e for e in corpus["events"] if e["provenance"] == "derived"]
    ys = [float(e["observed_severity"]) for e in derived]
    r = {f: _pearson([e["factors"][f] for e in derived], ys) for f in FACTORS}

    drivers = corpus["causal_weights"]
    controls = corpus["control_factors"]

    for f in drivers:
        assert r[f] > 0.30, f"planted driver {f} was not recovered (r={r[f]:.2f})"
    for f in controls:
        assert abs(r[f]) < 0.25, f"control {f} showed spurious signal (r={r[f]:.2f})"

    # Clean separation: weakest driver still beats the strongest control.
    assert min(r[f] for f in drivers) > max(r[f] for f in controls)


def test_learned_order_overturns_the_prior():
    """
    If the learned ranking merely echoed the hand-set prior, the corpus would
    prove nothing. It must not.
    """
    from app.learning_engine import derive_weights, DEFAULT_WEIGHTS
    from app.historical_seed import load_corpus

    corpus = load_corpus()
    observations = [
        {"factors": e["factors"], "severity": float(e["observed_severity"])}
        for e in corpus["events"] if e["provenance"] == "derived"
    ]
    learned, _ = derive_weights(observations, mode="correlation")
    prior_order = sorted(DEFAULT_WEIGHTS, key=lambda f: -DEFAULT_WEIGHTS[f])
    learned_order = sorted(learned, key=lambda f: -learned[f])

    assert learned_order != prior_order, "learned ranking is just the prior again"
    # The planted driver that the prior underrated most must now lead.
    assert learned_order[0] == "accessibility_risk"
    # And the prior's top factor must have been demoted.
    assert learned["accessibility_risk"] > learned["hazard_severity"]
    assert learned["hazard_severity"] < DEFAULT_WEIGHTS["hazard_severity"]


def test_engine_follows_whichever_truth_it_is_given():
    """
    Non-circularity. The engine has no built-in preference for any factor, so
    it must recover a ranking that CONTRADICTS our shipped assumption just as
    readily as it recovers ours. Without this, "it recovered our truth" could
    mean nothing more than "it echoed us".
    """
    import random

    from app.learning_engine import _pearson, FACTORS
    from scripts.build_event_corpus import SEVERITY_EDGES

    def recover(causal, n=90, seed=20240613):
        rng = random.Random(seed)
        rows = []
        for _ in range(n):
            f = {k: round(rng.uniform(10, 95), 1) for k in FACTORS}
            s = sum(causal.get(k, 0.0) * f[k] for k in FACTORS)
            sev = 1
            for edge in SEVERITY_EDGES:
                if s >= edge:
                    sev += 1
            rows.append((f, float(max(1, min(5, sev)))))
        ys = [s for _, s in rows]
        return {k: _pearson([f[k] for f, _ in rows], ys) for k in FACTORS}

    cases = {
        # Contradicts our shipped assumption on purpose.
        "slope_risk": {"slope_risk": 0.50, "hazard_severity": 0.30, "accessibility_risk": 0.20},
        "hazard_severity": {"hazard_severity": 0.55, "slope_risk": 0.25, "population_exposure": 0.20},
        "population_exposure": {"population_exposure": 0.50, "hazard_severity": 0.30, "slope_risk": 0.20},
    }
    for expected, causal in cases.items():
        r = recover(causal)
        best = max(r, key=lambda f: r[f])
        assert best == expected, (
            f"planted {expected} but engine chose {best} - it has a bias"
        )


def test_corpus_declares_its_ground_truth_as_an_assumption():
    """
    The corpus must not be able to pass itself off as real evidence.
    """
    from app.historical_seed import load_corpus

    corpus = load_corpus()
    assert corpus["causal_weights"], "the assumed truth must be stated, not hidden"
    assert corpus["control_factors"], "controls must be declared"
    note = corpus["honesty_note"]
    assert "ASSUMPTION" in note, "must admit the causal weights are an assumption"
    assert "NOT a measured fact" in note
    assert "does not prove" in note, "must state what this corpus cannot show"
    for e in corpus["events"]:
        if e["provenance"] == "derived":
            assert "NOT an observed event" in e["source"]
            assert "independently" in e["derivation"].lower()


def test_corpus_is_deterministic():
    """A rebuild must be byte-identical, so recovery tests stay stable."""
    from scripts.build_event_corpus import build

    a = build()
    b = build()
    assert json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)



# ---------------------------------------------------------------------------
# API auth split
# ---------------------------------------------------------------------------

def _auth(client):
    token = client.post(
        "/api/auth/login",
        json={"email": DEMO_OFFICIAL[0], "password": DEMO_OFFICIAL[1]},
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_outcome_narratives_never_blame_a_declared_control():
    """
    Regression: the narrative text was chosen by the largest factor overall, so
    44 of 90 events blamed slope, population or past events for the outcome
    even though the corpus explicitly declares those NON-causal. The corpus
    contradicted itself, and a reviewer reading the outcome text would see a
    causal claim the design denies.
    """
    import json
    from pathlib import Path

    corpus = json.loads(
        (Path(__file__).resolve().parents[1]
         / "app" / "data" / "backtest" / "event_corpus.json").read_text(encoding="utf-8")
    )
    causal = set(corpus["causal_weights"])
    controls = set(corpus.get("control_factors") or [])

    derived = [e for e in corpus["events"] if e.get("provenance") == "derived"]
    assert derived, "expected derived events in the corpus"

    for e in derived:
        assert e["dominant_factor"] in causal, (
            f"{e['id']} blames {e['dominant_factor']!r} for its outcome, "
            f"but the declared causal set is {sorted(causal)}"
        )
        assert e["dominant_factor"] not in controls
        # The control is still reported, just never credited with the outcome.
        assert e.get("strongest_control") in controls, (
            f"{e['id']} should still report which control was highest"
        )


def test_re_registering_one_event_is_not_counted_many_times(client):
    """
    Regression: the `events` table upserts by id, but every registration also
    appended a new learning observation. Re-registering or correcting a single
    incident therefore counted it several times over and distorted every weight
    derived from it. A re-registration must update in place, not accumulate.
    """
    from app.learning_engine import observation_count

    factors = {
        "accessibility_risk": 80, "facility_access_risk": 20,
        "hazard_severity": 30, "slope_risk": 10,
        "population_exposure": 10, "historical_event_risk": 5,
    }
    base = observation_count()

    def register(severity):
        return client.post(
            "/api/validation/register-event",
            headers=_auth(client),
            json={
                "id": "DUP-1", "village_id": "V007", "hazard_type": "FLOOD",
                "date": "2025-07-01", "observed_severity": severity,
                "provenance": "documented", "factors": factors,
            },
        )

    assert register(4).status_code == 200, register(4).text
    after_first = observation_count()
    assert after_first == base + 1

    # Same incident, same id, three more times.
    for _ in range(3):
        assert register(4).status_code == 200
    assert observation_count() == after_first, (
        "re-registering one event must not add more learning observations"
    )

    # A correction is still one incident: the row is updated, not duplicated.
    assert register(1).status_code == 200
    assert observation_count() == after_first

    # And the corrected severity is what the model actually sees.
    from app.learning_engine import _iter_observations
    matching = [
        o for o in _iter_observations(source="historical")
        if o["severity"] == 1.0
    ]
    assert matching, "the corrected severity should have replaced the old value"


def test_weights_cache_never_serves_another_database(monkeypatch, tmp_path):
    """
    Regression: the 15s weights cache was keyed on time only, so a value
    computed against one database could be served while reading a different
    one. A reset or a fresh test database would then show stale weights.
    """
    from app import db
    from app import historical_seed
    from app.learning_engine import get_adaptive_weights

    # Database A: empty. Weights must be the prior.
    db_a = tmp_path / "a.db"
    monkeypatch.setenv("SAFEZONE_DB_PATH", str(db_a))
    db.init_db()
    prior = get_adaptive_weights()
    assert prior == pytest.approx(
        {
            "hazard_severity": 0.30, "slope_risk": 0.20,
            "population_exposure": 0.15, "accessibility_risk": 0.15,
            "facility_access_risk": 0.10, "historical_event_risk": 0.10,
        }
    )

    # Database B: corpus seeded. Weights must differ from the prior.
    db_b = tmp_path / "b.db"
    monkeypatch.setenv("SAFEZONE_DB_PATH", str(db_b))
    db.init_db()
    historical_seed.seed_if_needed(force=True)
    seeded = get_adaptive_weights()
    assert seeded != prior, "seeding should have re-weighted the model"

    # Back to A within the cache TTL: the cached B values must not be served.
    monkeypatch.setenv("SAFEZONE_DB_PATH", str(db_a))
    assert get_adaptive_weights() == pytest.approx(prior), (
        "cache leaked weights from a different database"
    )


def test_public_learning_hides_weights(client):
    pub = client.get("/api/learning")
    assert pub.status_code == 200
    body = pub.json()
    assert "weights" not in body, "public endpoint must not expose factor weights"
    assert "prior" not in body
    assert "factor_correlations" not in body
    assert body["detail_requires_auth"] is True


def test_detail_endpoints_require_official(client):
    # require_official responds 403 for a missing/invalid token, matching the
    # rest of the official surface (401 is reserved for expired sessions).
    for path in (
        "/api/learning/weights",
        "/api/learning/corpus",
        "/api/villages/V001/history",
    ):
        assert client.get(path).status_code == 403, path


def test_detail_endpoints_allow_official(client):
    h = _auth(client)
    assert client.get("/api/learning/weights", headers=h).status_code == 200
    assert client.get("/api/learning/corpus", headers=h).status_code == 200
    assert client.get("/api/villages/V001/history", headers=h).status_code == 200


# ---------------------------------------------------------------------------
# Village history
# ---------------------------------------------------------------------------

def test_village_history_never_penalises_missing_records(client):
    h = _auth(client)
    body = client.get("/api/villages/V001/history", headers=h).json()
    assert body["n_events"] == 0
    assert body["derived_historical_risk"] == 0.0
    assert body["effective_historical_risk"] == body["static_historical_risk"]
    assert body["source_of_truth"] == "static_inputs"


def test_village_history_applies_10_year_half_life(client):
    h = _auth(client)
    # V005 has a low static historical_event_risk (10), so recorded events can
    # legitimately overtake it. V001 (static 70) is covered by the
    # never-penalise test and must stay static until the record is strong.
    vid = "V005"
    now_year = 2026

    def seed(event_id, year, severity):
        r = client.post("/api/validation/register-event", headers=h, json={
            "id": event_id, "hazard_type": "FLOOD", "village_id": vid,
            "date": f"{year}-06-01", "observed_severity": severity,
            "provenance": "documented",
        })
        assert r.status_code == 200, r.text

    seed("HIST-OLD", 2016, 5)          # 10 years before now
    body = client.get(f"/api/villages/{vid}/history", headers=h).json()
    old_w = next(e["decay_weight"] for e in body["events"] if e["id"] == "HIST-OLD")
    assert old_w == pytest.approx(0.5, abs=0.05), "10 years should halve the weight"

    # A recent event of the same severity must outweigh a 10-year-old one.
    seed("HIST-NEW", now_year - 1, 5)
    body2 = client.get(f"/api/villages/{vid}/history", headers=h).json()
    new_w = next(e["decay_weight"] for e in body2["events"] if e["id"] == "HIST-NEW")
    assert new_w > old_w

    # Two severe events must beat a static value of 10.
    assert body2["derived_historical_risk"] > 10
    assert body2["derived_historical_risk"] > body["derived_historical_risk"]
    assert body2["effective_historical_risk"] == body2["derived_historical_risk"]
    assert body2["source_of_truth"] == "recorded_events"
    assert body2["provenance_breakdown"]["documented"] == 2
    assert body2["static_historical_risk"] == 10


def test_unlabelled_event_is_not_silently_called_documented(client):
    """
    Regression: an event with no provenance was labelled "documented" while the
    breakdown counted it as "unlabelled". The per-event label depended on row
    order, and the two views contradicted each other. Silently promoting an
    unlabelled record to "documented" would overstate the evidence.
    """
    h = _auth(client)
    vid = "V007"
    # Inserted directly to force a NULL, so the model default cannot apply.
    from app import db

    c = db.get_conn()
    cur = c.cursor()
    cur.execute(
        "INSERT INTO events (id, village_id, hazard_type, date, observed_severity, "
        "provenance) VALUES (%s,%s,%s,%s,%s,%s)",
        ("UNLABELLED-1", vid, "FLOOD", "2025-06-01", 3, None),
    )
    c.commit()
    c.close()

    body = client.get(f"/api/villages/{vid}/history", headers=h).json()
    ev = next(e for e in body["events"] if e["id"] == "UNLABELLED-1")
    assert ev["provenance"] == "unlabelled"
    assert ev["provenance_raw"] is None
    assert body["provenance_breakdown"]["unlabelled"] == 1
    assert body["provenance_breakdown"]["documented"] == 0
    # The per-event label must agree with the breakdown.
    counted = {e["provenance"] for e in body["events"]}
    for label in counted:
        assert body["provenance_breakdown"][label] >= 1


def test_village_history_does_not_override_strong_static_value(client):
    """A couple of mild events must not displace a well-attested static risk."""
    h = _auth(client)
    vid = "V001"  # static historical_event_risk = 70
    client.post("/api/validation/register-event", headers=h, json={
        "id": "MILD-1", "hazard_type": "FLOOD", "village_id": vid,
        "date": "2025-06-01", "observed_severity": 2, "provenance": "documented",
    })
    body = client.get(f"/api/villages/{vid}/history", headers=h).json()
    assert body["derived_historical_risk"] < 70
    assert body["effective_historical_risk"] == 70
    assert body["source_of_truth"] == "static_inputs"


def test_register_event_with_factors_trains_model(client):
    h = _auth(client)
    from app.learning_engine import observation_count

    before = observation_count("historical")
    r = client.post("/api/validation/register-event", headers=h, json={
        "id": "FACTOR-EVENT-1", "hazard_type": "LANDSLIDE", "village_id": "V002",
        "date": "2025-06-01", "observed_severity": 4, "provenance": "derived",
        "factors": {
            "hazard_severity": 88.0, "slope_risk": 91.0,
            "population_exposure": 40.0, "accessibility_risk": 35.0,
            "facility_access_risk": 30.0, "historical_event_risk": 25.0,
        },
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["trained"] is True
    assert body["provenance"] == "derived"
    assert observation_count("historical") == before + 1


def test_register_event_without_factors_does_not_train(client):
    h = _auth(client)
    from app.learning_engine import observation_count

    before = observation_count("historical")
    r = client.post("/api/validation/register-event", headers=h, json={
        "id": "FACTOR-EVENT-2", "hazard_type": "FLOOD", "village_id": "V002",
        "date": "2025-06-01", "observed_severity": 3,
    })
    assert r.status_code == 200
    assert r.json()["trained"] is False
    assert observation_count("historical") == before


# ---------------------------------------------------------------------------
# Mode switch
# ---------------------------------------------------------------------------

def test_dirichlet_mode_still_works(client, monkeypatch):
    """Legacy behaviour must remain available for rollback."""
    from app.learning_engine import derive_weights, _invalidate_cache

    monkeypatch.setenv("SAFEZONE_LEARNING_MODE", "dirichlet")
    _invalidate_cache()
    st = client.get("/api/learning/weights", headers=_auth(client)).json()
    assert st["mode"] == "dirichlet"
    assert round(sum(st["weights"].values()), 4) == 1.0

    monkeypatch.setenv("SAFEZONE_LEARNING_MODE", "correlation")
    _invalidate_cache()
    st2 = client.get("/api/learning/weights", headers=_auth(client)).json()
    assert st2["mode"] == "correlation"


def test_reset_learning_re_seeds(client):
    h = _auth(client)
    r = client.post("/api/validation/reset-learning", headers=h)
    assert r.status_code == 200
    body = r.json()
    assert body["reset"] is True
    assert body["reseeded"] is True
    assert body["seed"]["n_historical_observations"] > 0
    assert body["seed"]["confidence"] == 0.0
