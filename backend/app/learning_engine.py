"""
Learning Engine (adaptive risk model)
=====================================

The platform is an analytical decision-support tool, not a verdict machine.
This module gives the risk model an online-learning loop driven by
adjudicated field outcomes:

  * every SOS report an authority resolves (confirmed severity, people
    affected) is a fresh observation,
  * registered historical events contribute observations too, tagged by
    provenance so historical and live evidence are never conflated,
  * the six risk-factor importances are re-derived from how well each factor
    actually co-varied with observed severity,
  * confidence grows with the number of observations, so the system stays
    appropriately humble early on instead of over-trusting itself.

How weights are derived
-----------------------
The original implementation used an additive Dirichlet update:

    alpha_i += eta * factor_i * (severity / 5)

That update is monotonic: a factor's mass can only ever grow. A factor that
is consistently high but has no relationship to outcome (a red herring) is
therefore *reinforced*, never discounted. Seeding it with a corpus where
every factor is high pushed all six weights toward uniform, which made the
model less informative, not more.

The default mode here is `correlation`. A factor earns mass when it
co-varies with observed severity across events:

    r_i    = Pearson(factor_i, observed_severity)
    mass_i = (1 + r_i)^2 + CORRELATION_FLOOR
    w_i    = mass_i / sum(mass)

so a factor that is high but outcome-flat earns nothing, while a factor that
tracks outcomes earns a lot. When no factor discriminates at all, every r is
zero and the result is uniform - the model declines to claim a signal it
cannot see. The `CORRELATION_FLOOR` keeps any genuinely useful factor from
being zeroed out by a small sample.

With few observations the posterior is unreliable, so the result is blended
back toward the published prior using `min(1, n / BLEND_FULL_EVIDENCE)`:
the prior dominates at n=0 and learning takes over only once enough
evidence has accumulated.

Set `SAFEZONE_LEARNING_MODE=dirichlet` to restore the previous additive
behaviour while callers migrate. Either mode persists to model_state.
"""

import json
import os
import time
import uuid

from . import db

FACTORS = [
    "hazard_severity",
    "slope_risk",
    "population_exposure",
    "accessibility_risk",
    "facility_access_risk",
    "historical_event_risk",
]

DEFAULT_WEIGHTS = {
    "hazard_severity": 0.30,
    "slope_risk": 0.20,
    "population_exposure": 0.15,
    "accessibility_risk": 0.15,
    "facility_access_risk": 0.10,
    "historical_event_risk": 0.10,
}

LEARNING_RATE = 0.35
MAX_ALPHA_SUM = 120.0

# --- correlation mode tuning -------------------------------------------------
# Evidence needed before the learned posterior fully replaces the prior.
BLEND_FULL_EVIDENCE = 8.0
# Keeps a predictive factor from being driven to ~0 on a tiny sample.
CORRELATION_FLOOR = 0.5
# Below this many observations a factor has no usable variance.
MIN_OBSERVATIONS_FOR_CORRELATION = 3

SOURCES = ("live", "historical")

_weights_cache = {"value": None, "at": 0.0, "db": None}


def _invalidate_cache() -> None:
    _weights_cache["value"] = None
    _weights_cache["at"] = 0.0
    _weights_cache["db"] = None


def learning_mode() -> str:
    """`correlation` (default) or `dirichlet` (legacy additive behaviour)."""
    return (os.environ.get("SAFEZONE_LEARNING_MODE") or "correlation").strip().lower()


# ---------------------------------------------------------------------------
# Statistics helpers
# ---------------------------------------------------------------------------

def _pearson(xs: list[float], ys: list[float]) -> float:
    """Pearson correlation, clamped to [-1, 1]. Returns 0.0 without spread."""
    n = len(xs)
    if n < 2:
        return 0.0
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = sum((x - mx) ** 2 for x in xs) ** 0.5
    dy = sum((y - my) ** 2 for y in ys) ** 0.5
    if dx == 0 or dy == 0:
        return 0.0
    return max(-1.0, min(1.0, num / (dx * dy)))


def _clamp_factor(value) -> float:
    try:
        return max(0.0, min(100.0, float(value)))
    except (TypeError, ValueError):
        return 0.0


# ---------------------------------------------------------------------------
# Observation store
# ---------------------------------------------------------------------------

def _iter_observations(source: str | None = None) -> list[dict]:
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        if source:
            cur.execute(
                "SELECT factors_json, observed_severity FROM learning_observations "
                "WHERE source=%s ORDER BY created_at",
                (source,),
            )
        else:
            cur.execute(
                "SELECT factors_json, observed_severity FROM learning_observations "
                "ORDER BY created_at"
            )
        rows = cur.fetchall()
    finally:
        conn.close()

    out = []
    for r in rows:
        try:
            factors = json.loads(r["factors_json"])
        except (TypeError, ValueError):
            continue
        out.append({"factors": factors, "severity": float(r["observed_severity"])})
    return out


def _store_observation(
    factors: dict,
    severity: int,
    source: str,
    provenance: str | None = None,
    village_id: str | None = None,
    event_ref: str | None = None,
) -> str:
    """
    Store one learning observation and return its id.

    Re-registering the same event is an UPDATE, not new evidence. The
    `events` table upserts by id, so without this guard a re-registration
    would append a second observation and silently count one incident
    several times over, distorting every weight derived from it.
    """
    clamped = {f: _clamp_factor(factors.get(f, 0.0)) for f in FACTORS}
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        if event_ref:
            cur.execute(
                "SELECT id FROM learning_observations "
                "WHERE event_ref=%s AND source=%s",
                (event_ref, source),
            )
            row = cur.fetchone()
            if row:
                obs_id = row["id"]
                cur.execute(
                    "UPDATE learning_observations SET provenance=%s, village_id=%s, "
                    "factors_json=%s, observed_severity=%s, created_at=%s WHERE id=%s",
                    (
                        provenance,
                        village_id,
                        json.dumps(clamped),
                        float(severity),
                        now,
                        obs_id,
                    ),
                )
                conn.commit()
                _invalidate_cache()
                return obs_id

        obs_id = f"OBS-{uuid.uuid4().hex[:12]}"
        cur.execute(
            "INSERT INTO learning_observations "
            "(id, source, provenance, village_id, factors_json, observed_severity, "
            " event_ref, created_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
            (
                obs_id,
                source,
                provenance,
                village_id,
                json.dumps(clamped),
                float(severity),
                event_ref,
                now,
            ),
        )
        conn.commit()
    finally:
        conn.close()
    _invalidate_cache()
    return obs_id


def clear_observations(source: str | None = None) -> int:
    """Delete stored observations. Used by reset-learning and re-seeding."""
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        if source:
            cur.execute("DELETE FROM learning_observations WHERE source=%s", (source,))
        else:
            cur.execute("DELETE FROM learning_observations")
        removed = cur.rowcount
        conn.commit()
    finally:
        conn.close()
    _invalidate_cache()
    return removed


# ---------------------------------------------------------------------------
# Weight derivation
# ---------------------------------------------------------------------------

def _correlation_weights(observations: list[dict]) -> tuple[dict, dict]:
    """Return (weights, per_factor_r). Uniform when nothing discriminates."""
    n = len(observations)
    if n < MIN_OBSERVATIONS_FOR_CORRELATION:
        return dict(DEFAULT_WEIGHTS), {f: 0.0 for f in FACTORS}

    severities = [o["severity"] for o in observations]
    r = {
        f: _pearson([o["factors"].get(f, 0.0) for o in observations], severities)
        for f in FACTORS
    }
    mass = {f: (1.0 + r[f]) ** 2 + CORRELATION_FLOOR for f in FACTORS}
    total = sum(mass.values())
    return {f: mass[f] / total for f in FACTORS}, r


def _dirichlet_weights(observations: list[dict]) -> tuple[dict, dict]:
    """Legacy additive behaviour, retained behind SAFEZONE_LEARNING_MODE."""
    alphas = dict(DEFAULT_WEIGHTS)
    for o in observations:
        for f in FACTORS:
            alphas[f] += LEARNING_RATE * (o["factors"].get(f, 0.0) / 100.0) * (
                o["severity"] / 5.0
            )
        total = sum(alphas.values())
        if total > MAX_ALPHA_SUM:
            scale = MAX_ALPHA_SUM / total
            alphas = {f: a * scale for f, a in alphas.items()}
    total = sum(alphas.values())
    return ({f: alphas[f] / total for f in FACTORS}, {f: 0.0 for f in FACTORS})


def _blend(prior: dict, learned: dict, n: int) -> dict:
    """Ramp from the prior toward the learned signal as evidence accumulates."""
    t = min(1.0, max(0.0, n / BLEND_FULL_EVIDENCE))
    blended = {f: prior[f] * (1.0 - t) + learned[f] * t for f in FACTORS}
    total = sum(blended.values())
    if not total:
        return dict(prior)
    return {f: blended[f] / total for f in FACTORS}


def derive_weights(observations: list[dict] | None = None, mode: str | None = None):
    """Compute (weights, per_factor_r) from the stored observations."""
    obs = _iter_observations() if observations is None else observations
    active = (mode or learning_mode()).lower()

    if active == "dirichlet":
        learned, r = _dirichlet_weights(obs)
    else:
        learned, r = _correlation_weights(obs)

    if not obs:
        return dict(DEFAULT_WEIGHTS), r
    return _blend(DEFAULT_WEIGHTS, learned, len(obs)), r


# ---------------------------------------------------------------------------
# Public accessors
# ---------------------------------------------------------------------------

def get_adaptive_weights() -> dict:
    """Active factor weights, cached briefly to keep scoring cheap."""
    now = time.time()
    current_db = db.db_identity()
    if (
        _weights_cache["value"]
        and _weights_cache["db"] == current_db
        and (now - _weights_cache["at"]) < 15.0
    ):
        return _weights_cache["value"]

    weights, _ = derive_weights()
    weights = {f: round(w, 4) for f, w in weights.items()}

    total = sum(weights.values())
    if total:
        weights = {f: round(w / total, 4) for f, w in weights.items()}

    _weights_cache["value"] = weights
    _weights_cache["at"] = now
    _weights_cache["db"] = current_db
    return weights


def current_prior() -> dict:
    """Seed prior the model starts from (not the live posterior)."""
    return dict(DEFAULT_WEIGHTS)


def observation_count(source: str | None = None) -> int:
    if source is None:
        return len(_iter_observations())
    return len(_iter_observations(source))


def factor_correlations() -> dict:
    """Per-factor Pearson r against observed severity."""
    _, r = derive_weights()
    return {f: round(v, 4) for f, v in r.items()}


# ---------------------------------------------------------------------------
# Learning step
# ---------------------------------------------------------------------------

def record_observation(
    factors: dict,
    observed_severity: int,
    source: str = "live",
    provenance: str | None = None,
    village_id: str | None = None,
    event_ref: str | None = None,
) -> dict:
    """
    Record one labelled outcome and re-derive the factor weights.

    source="live"       an SOS report an authority just adjudicated
    source="historical" a registered or seeded past event, provenance-tagged

    Historical evidence is tracked separately so a seeded corpus never
    inflates the live-evidence confidence figure.
    """
    severity = max(1, min(5, int(observed_severity)))
    if source not in SOURCES:
        raise ValueError(f"source must be one of {SOURCES}, got {source!r}")

    _store_observation(
        factors,
        severity,
        source=source,
        provenance=provenance,
        village_id=village_id,
        event_ref=event_ref,
    )
    db.set_state("updated_at", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
    _invalidate_cache()

    return {
        "weights": get_adaptive_weights(),
        "n_observations": observation_count(),
        "n_live_observations": observation_count("live"),
        "n_historical_observations": observation_count("historical"),
        "confidence": model_confidence(),
        "mode": learning_mode(),
    }


# ---------------------------------------------------------------------------
# Confidence & stats
# ---------------------------------------------------------------------------

def model_confidence(n: int = None) -> float:
    """
    0-1, from live observations only. Grows with evidence but is capped so the
    tool never presents itself as infallible.

    Historical/seeded observations are deliberately excluded: a corpus replayed
    at startup must not make the model look confident about live operations.
    """
    if n is None:
        n = observation_count("live")
    conf = 1.0 - 1.0 / (1.0 + n / 8.0)
    return round(min(conf, 0.95), 3)


def historical_confidence() -> float:
    """Confidence attributable to historical evidence, reported separately."""
    n = observation_count("historical")
    return round(1.0 - 1.0 / (1.0 + n / 8.0), 3)


def provenance_split() -> dict:
    counts = {"live": 0, "historical": 0}
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT source, provenance, COUNT(*) AS n FROM learning_observations "
            "GROUP BY source, provenance"
        )
        for row in cur.fetchall():
            counts[row["source"]] = counts.get(row["source"], 0) + row["n"]
    finally:
        conn.close()

    documented = 0
    derived = 0
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT provenance, COUNT(*) AS n FROM learning_observations "
            "WHERE source='historical' GROUP BY provenance"
        )
        for row in cur.fetchall():
            label = (row["provenance"] or "").strip().lower()
            if label.startswith("documented"):
                documented += row["n"]
            elif label.startswith("derived"):
                derived += row["n"]
    finally:
        conn.close()

    return {
        "live": counts.get("live", 0),
        "historical": counts.get("historical", 0),
        "documented": documented,
        "derived": derived,
        "historical_seeded": counts.get("historical", 0) > 0,
    }


def stats() -> dict:
    n_all = observation_count()
    n_live = observation_count("live")
    n_hist = observation_count("historical")
    return {
        "n_observations": n_all,
        "n_live_observations": n_live,
        "n_historical_observations": n_hist,
        "confidence": model_confidence(n_live),
        "historical_confidence": historical_confidence(),
        "provenance_split": provenance_split(),
        "weights": get_adaptive_weights(),
        "prior": current_prior(),
        "factor_correlations": factor_correlations(),
        "learning_rate": LEARNING_RATE,
        "mode": learning_mode(),
        "updated_at": db.get_state("updated_at", "never"),
    }
