"""
SafeLink - AI backend - FastAPI application entrypoint.

SIH26191: Intelligent Identification of Hazard-Based Red Zones, Carrying
Capacity Assessment, and Immediate Relocation Needs for Vulnerable Habitations.

This is a decision-support PROTOTYPE. All data is demo/sample data for a
fictional-but-geographically-consistent pilot district unless explicitly
documented otherwise. No live government or satellite feeds are integrated.

Access model (RBAC):
  * PUBLIC (no account)  - villages, risk summary, scenario what-ifs, SOS
                           submission + aggregate stats, advisories, health.
  * AUTHORITY (JWT)      - SOS report detail/status updates, adjudication,
                           authority account creation (ADMIN), ingestion
                           validation, learning-engine status, real events.
  * Civilians never need an account; every mutating endpoint is protected.
"""

import asyncio
import json
import logging
import os
import time
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Header, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from . import db
from .data_loader import load_villages, load_safe_zones
from .models import (
    RecommendationResult, ScenarioAdjustments, ScenarioResult,
    UserRegister, UserLogin, PinLogin, TokenResponse,
    SOSReportInput, SOSReportResult, AdjudicateInput, EventInput,
    MeshNode, MeshPacket, MeshSyncRequest, MeshSyncResponse,
    SatelliteTransmitRequest, SatelliteTransmitResult,
    SatelliteDownlinkBroadcast,
)
from .satellite_engine import (
    encode_satellite_burst_packet,
    get_all_terminals, pair_terminal_ble,
    simulate_satellite_uplink, get_satellite_constellation_status,
    broadcast_downlink_advisory, get_downlink_messages,
)
from .relocation_engine import rank_destinations
from .scenario_engine import run_full_pipeline, run_scenario
from .auth import (
    create_token, decode_token, find_user_by_id,
    create_user, authenticate_login, authenticate_pin, public_user, list_users,
)
from .sos_engine import (
    add_sos_report,
    update_report_status, get_priority_queue, aggregate_by_village,
    load_sos_reports,
    register_mesh_node, queue_mesh_packet, get_packets_for_node, get_active_nodes,
)
from .ground_reality_engine import (
    compute_ground_reality, get_operational_priority_list,
)
from .reasoning_engine import build_advisory, district_advisory
from .learning_engine import record_observation, stats as learning_stats
from . import historical_seed
from . import village_history
from .red_zone_ingestion import (
    ingest_sample, load_backtest_events, build_backtest_villages,
)
from .risk_engine import calculate_risk


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    # Opt-out so tests can start from a clean learning slate. The corpus seed
    # is idempotent, so leaving it on in production is safe.
    if not os.environ.get("SAFEZONE_SKIP_HISTORY_SEED"):
        try:
            historical_seed.seed_if_needed()
        except Exception:  # noqa: BLE001 - corpus problems must not block startup
            logger.exception(
                "Historical seed failed; continuing with prior weights."
            )
    yield


app = FastAPI(
    title="SafeLink - AI API",
    description=(
        "Decision-support prototype for SIH26191. "
        "Machine proposes, the authority decides - outputs are advisories."
    ),
    version="0.3.0",
    lifespan=lifespan,
)

# CORS: bearer tokens travel in the Authorization header, not cookies, so
# allow_credentials stays False and "*" is never needed.
#
# Origins are an explicit allowlist. In local dev the frontend is served by the
# Vite dev server, which proxies /api and /ws server-side, so requests are
# same-origin and CORS is not even exercised. It only matters when the API is
# called directly from a different origin (e.g. the Vercel-hosted frontend
# calling the Render-hosted backend), which is why a deployment must set
# SAFEZONE_CORS_ORIGINS to its real frontend origin.
#
# DEV_ORIGINS is only the local-development fallback.
DEV_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]


def _cors_origins() -> list[str]:
    configured = os.environ.get("SAFEZONE_CORS_ORIGINS", "").strip()
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]

    logger.warning(
        "SAFEZONE_CORS_ORIGINS is not set, so only these origins may call this "
        "API: %s. That is correct for local development, where the frontend is "
        "served by the Vite dev server on the same origin. If the frontend is "
        "deployed to a different host, set SAFEZONE_CORS_ORIGINS to that exact "
        "origin (comma-separated, no trailing slash) or the browser will block "
        "every response.",
        ", ".join(DEV_ORIGINS),
    )
    return list(DEV_ORIGINS)


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------

def _user_from_header(authorization: Optional[str]) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    payload = decode_token(authorization.split(" ", 1)[1])
    if not payload:
        return None
    return find_user_by_id(payload.get("sub", ""))


def require_auth(authorization: Optional[str] = Header(None)) -> dict:
    """Require a valid authority JWT."""
    user = _user_from_header(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


def require_admin(authorization: Optional[str] = Header(None)) -> dict:
    """Require an ADMIN account (authority account creation, user listing)."""
    user = _user_from_header(authorization)
    if not user or user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def require_official(authorization: Optional[str] = Header(None)) -> dict:
    """Require an ADMIN or OFFICIAL (adjudication / field ops)."""
    user = _user_from_header(authorization)
    if not user or user["role"] not in ("ADMIN", "OFFICIAL"):
        raise HTTPException(status_code=403, detail="Official access required")
    return user


def require_volunteer(authorization: Optional[str] = Header(None)) -> dict:
    """Require an ADMIN, OFFICIAL, or VOLUNTEER (field response / mesh node)."""
    user = _user_from_header(authorization)
    if not user or user["role"] not in ("ADMIN", "OFFICIAL", "VOLUNTEER"):
        raise HTTPException(status_code=403, detail="Volunteer access required")
    return user


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/api/health")
def health():
    import os
    is_demo = os.environ.get("SAFEZONE_DEMO_MODE", "0") == "1"
    return {
        "status": "ok",
        "service": "SafeLink - AI backend",
        "mode": "demo-data" if is_demo else "real-data",
        "pipeline": "risk -> vulnerability -> relocation -> capacity -> destination",
    }


# ---------------------------------------------------------------------------
# Authentication endpoints (authority accounts only)
# ---------------------------------------------------------------------------
@app.post("/api/auth/register", response_model=TokenResponse)
def register(data: UserRegister, user: dict = Depends(require_admin)):
    """ADMIN creates an authority account. Role is validated server-side."""
    try:
        new_user = create_user(data.name, data.email, data.password, data.role.value, data.department, data.pin)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    token = create_token(new_user["id"], new_user["name"], new_user["email"], new_user["role"])
    return TokenResponse(access_token=token, user=public_user(new_user))


@app.post("/api/auth/login", response_model=TokenResponse)
def login(data: UserLogin):
    try:
        user = authenticate_login(data.email, data.password)
    except PermissionError as e:
        raise HTTPException(status_code=429, detail=str(e))
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"], user["name"], user["email"], user["role"])
    return TokenResponse(access_token=token, user=public_user(user))


@app.post("/api/auth/pin-login", response_model=TokenResponse)
def pin_login(data: PinLogin):
    """Per-user fast-access PIN for authorities."""
    try:
        user = authenticate_pin(data.email, data.pin)
    except PermissionError as e:
        raise HTTPException(status_code=429, detail=str(e))
    if not user:
        raise HTTPException(status_code=401, detail="Invalid PIN for this account")
    token = create_token(user["id"], user["name"], user["email"], user["role"])
    return TokenResponse(access_token=token, user=public_user(user))


@app.get("/api/auth/me")
def get_me(user: dict = Depends(require_auth)):
    return public_user(user)


@app.get("/api/auth/users")
def get_users(user: dict = Depends(require_admin)):
    """Authority account list (ADMIN only)."""
    return list_users()


# ---------------------------------------------------------------------------
# Villages
# ---------------------------------------------------------------------------
@app.get("/api/villages")
def get_villages():
    villages = load_villages()
    safe_zones = load_safe_zones()
    results, _, _ = run_full_pipeline(villages, safe_zones)
    return results


@app.get("/api/villages/{village_id}")
def get_village(village_id: str):
    villages = load_villages()
    safe_zones = load_safe_zones()
    results, _, _ = run_full_pipeline(villages, safe_zones)
    for r in results:
        if r.id == village_id:
            return r
    raise HTTPException(status_code=404, detail=f"Village '{village_id}' not found")


# OFFICIAL only. Returns the village's own event history, how each event is
# recency-weighted, and whether the derived history or the static inputs are
# setting the risk. Provenance is reported per event so a panel cannot
# present derived scenarios as real history.
@app.get("/api/villages/{village_id}/history")
def get_village_history(village_id: str, user: dict = Depends(require_official)):
    villages = load_villages()
    village = next((v for v in villages if v.id == village_id), None)
    if village is None:
        raise HTTPException(status_code=404, detail=f"Village '{village_id}' not found")
    return village_history.village_history(
        village_id, static_risk=village.historical_event_risk
    )


# ---------------------------------------------------------------------------
# Safe zones
# ---------------------------------------------------------------------------
@app.get("/api/safe-zones")
def get_safe_zones():
    villages = load_villages()
    safe_zones = load_safe_zones()
    _, ledger, _ = run_full_pipeline(villages, safe_zones)
    return ledger.as_results()


# ---------------------------------------------------------------------------
# Risk summary
# ---------------------------------------------------------------------------
@app.get("/api/risk-summary")
def get_risk_summary():
    villages = load_villages()
    safe_zones = load_safe_zones()
    _, _, summary = run_full_pipeline(villages, safe_zones)
    return summary


# ---------------------------------------------------------------------------
# Relocation priority table
# ---------------------------------------------------------------------------
@app.get("/api/relocation-priority")
def get_relocation_priority():
    villages = load_villages()
    safe_zones = load_safe_zones()
    results, _, _ = run_full_pipeline(villages, safe_zones)
    prioritized = [r for r in results if r.relocation_required]
    prioritized.sort(key=lambda r: r.relocation_priority_score, reverse=True)
    return prioritized


# ---------------------------------------------------------------------------
# Recommendation for a single village
# ---------------------------------------------------------------------------
@app.get("/api/recommendation/{village_id}", response_model=RecommendationResult)
def get_recommendation(village_id: str):
    villages = load_villages()
    safe_zones = load_safe_zones()

    village = next((v for v in villages if v.id == village_id), None)
    if village is None:
        raise HTTPException(status_code=404, detail=f"Village '{village_id}' not found")

    results, ledger, _ = run_full_pipeline(villages, safe_zones)
    village_result = next(r for r in results if r.id == village_id)

    if village_result.people_requiring_relocation == 0:
        return RecommendationResult(
            village_id=village.id,
            village_name=village.name,
            people_requiring_relocation=0,
            recommended=None,
            alternatives=[],
            summary=f"{village.name} is currently classified as {village_result.risk_level}. "
            "No relocation is required at this time based on current risk factors.",
        )

    ranked = rank_destinations(village, safe_zones, ledger, village_result.people_requiring_relocation)
    best = ranked[0] if ranked else None
    alternatives = ranked[1:4] if len(ranked) > 1 else []

    reasons_text = ", ".join(r.lower() for r in village_result.explanation).capitalize()
    if best:
        summary = (
            f"{village.name} is currently classified as {village_result.risk_level} due to {reasons_text}. "
            f"An estimated {village_result.people_requiring_relocation:,} residents require relocation "
            f"assessment. {best.safe_zone_name} is currently the highest-ranked feasible destination based "
            "on safety, capacity, accessibility, medical access, and travel distance."
        )
    else:
        summary = (
            f"{village.name} is currently classified as {village_result.risk_level} due to {reasons_text}. "
            f"An estimated {village_result.people_requiring_relocation:,} residents require relocation "
            "assessment, but no safe zone data is currently available."
        )

    return RecommendationResult(
        village_id=village.id,
        village_name=village.name,
        people_requiring_relocation=village_result.people_requiring_relocation,
        recommended=best,
        alternatives=alternatives,
        summary=summary,
    )


# ---------------------------------------------------------------------------
# Scenario simulation (read-only compute; no mutation)
# ---------------------------------------------------------------------------
@app.post("/api/scenario", response_model=ScenarioResult)
def post_scenario(adjustments: ScenarioAdjustments):
    villages = load_villages()
    safe_zones = load_safe_zones()
    return run_scenario(villages, safe_zones, adjustments)


# ---------------------------------------------------------------------------
# Advisory (reasoning engine) - machine proposes, authority decides
# ---------------------------------------------------------------------------
def _village_advisories() -> list[dict]:
    villages = load_villages()
    safe_zones = load_safe_zones()
    results, _, _ = run_full_pipeline(villages, safe_zones)
    ground = {g.village_id: g for g in compute_ground_reality(villages)}
    sos_agg = aggregate_by_village()

    advisories = []
    for r in results:
        g = ground.get(r.id)
        agg = sos_agg.get(r.id, {})
        active = agg.get("active_reports", 0)
        medical = agg.get("medical_emergencies", 0)
        proposed = None
        if r.recommended_safe_zone_id:
            proposed = {
                "safe_zone_id": r.recommended_safe_zone_id,
                "safe_zone_name": r.recommended_safe_zone_name,
                "people": r.people_requiring_relocation,
            }
        advisories.append(
            build_advisory(
                r,
                ground=g.model_dump() if g else None,
                active_sos=active,
                medical=medical,
                proposed_relocation=proposed,
            )
        )
    return advisories


@app.get("/api/advisory")
def get_advisories():
    """District-level advisory + per-habitation advisories."""
    villages = load_villages()
    safe_zones = load_safe_zones()
    _, _, summary = run_full_pipeline(villages, safe_zones)
    district = district_advisory(summary.model_dump(), [])
    return {
        "district": district,
        "habitations": _village_advisories(),
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


@app.get("/api/advisory/{village_id}")
def get_village_advisory(village_id: str):
    for a in _village_advisories():
        if a["village_id"] == village_id:
            return a
    raise HTTPException(status_code=404, detail=f"Village '{village_id}' not found")


# ---------------------------------------------------------------------------
# Learning engine (adaptive weights)
# ---------------------------------------------------------------------------
# PUBLIC, SAFE AGGREGATE. The public dashboard renders an "accuracy" figure
# from this, so it must stay reachable without a token. It deliberately
# exposes only counts and confidence - never the factor weights themselves,
# which would reveal exactly which signals drive the risk model and make it
# easy to game. Full detail lives on /api/learning/weights below.
@app.get("/api/learning")
def get_learning_state():
    """Public aggregate: how much evidence exists, and how confident we are."""
    s = learning_stats()
    return {
        "n_observations": s["n_observations"],
        "n_live_observations": s["n_live_observations"],
        "n_historical_observations": s["n_historical_observations"],
        "confidence": s["confidence"],
        "historical_confidence": s["historical_confidence"],
        "provenance_split": {
            "documented": s["provenance_split"]["documented"],
            "derived": s["provenance_split"]["derived"],
            "live": s["provenance_split"]["live"],
            "historical": s["provenance_split"]["historical"],
        },
        "mode": s["mode"],
        "updated_at": s["updated_at"],
        "detail_requires_auth": True,
    }


# OFFICIAL only: the actual factor weights, correlations and prior.
@app.get("/api/learning/weights")
def get_learning_weights(user: dict = Depends(require_official)):
    """Full learning state, including the factor weights themselves."""
    return learning_stats()


# OFFICIAL only: what the corpus contains, so the demo can be explained
# honestly rather than being taken on trust.
@app.get("/api/learning/corpus")
def get_corpus_info(user: dict = Depends(require_official)):
    """Corpus metadata: counts, provenance, and the honesty note."""
    return historical_seed.corpus_summary()


# OFFICIAL only: re-seed the corpus (useful after editing it).
@app.post("/api/validation/seed-history")
def seed_history(user: dict = Depends(require_official)):
    """Idempotently seed the labelled corpus; live observations are kept."""
    return historical_seed.seed_if_needed(force=True)


# OFFICIAL only: wipe learned state and re-seed, for a clean demo run.
@app.post("/api/validation/reset-learning")
def reset_learning(user: dict = Depends(require_official)):
    """Clear all observations and re-seed the corpus."""
    return historical_seed.reset_learning(keep_corpus_seed=True)


# ---------------------------------------------------------------------------
# SAFEZONE CONNECT - SOS endpoints
# ---------------------------------------------------------------------------
@app.post("/api/sos/submit", response_model=SOSReportResult)
def submit_sos(report: SOSReportInput):
    """Citizen submits an SOS report (no account required)."""
    villages = load_villages()
    village = next((v for v in villages if v.id == report.village_id), None)
    pop = village.population if village else 2000
    return add_sos_report(report, village_population=pop)


@app.get("/api/sos/reports")
def get_sos_reports(
    village_id: Optional[str] = None,
    status: Optional[str] = None,
    user: dict = Depends(require_auth),
):
    """Authority-only SOS report list (contains reporter contact details)."""
    reports = load_sos_reports()
    if village_id:
        reports = [r for r in reports if r["village_id"] == village_id]
    if status:
        reports = [r for r in reports if r["status"] == status]
    reports.sort(key=lambda r: r["priority_score"], reverse=True)
    return reports


@app.get("/api/sos/reports/{report_id}")
def get_sos_report(report_id: str, user: dict = Depends(require_auth)):
    reports = load_sos_reports()
    for r in reports:
        if r["id"] == report_id:
            return r
    raise HTTPException(status_code=404, detail=f"Report '{report_id}' not found")


@app.patch("/api/sos/reports/{report_id}")
def patch_sos_report(report_id: str, body: dict, user: dict = Depends(require_official)):
    """Authority updates a report's status."""
    new_status = (body.get("status") or "").upper()
    if not new_status:
        raise HTTPException(status_code=400, detail="'status' field required")
    result = update_report_status(report_id, new_status, adjudicated_by=user["id"])
    if not result:
        raise HTTPException(status_code=404, detail=f"Report '{report_id}' not found")
    return result


@app.post("/api/sos/adjudicate")
def adjudicate_report(data: AdjudicateInput, user: dict = Depends(require_official)):
    """
    Authority closes out a report with the CONFIRMED outcome. This is the
    'real-time data' feed that tilts the learning engine's risk weights.
    """
    reports = load_sos_reports()
    report = next((r for r in reports if r["id"] == data.report_id), None)
    if not report:
        raise HTTPException(status_code=404, detail=f"Report '{data.report_id}' not found")

    # Factor values of the village the report came from - the learning signal.
    factors = None
    villages = load_villages()
    village = next((v for v in villages if v.id == report["village_id"]), None)
    if village:
        factors = {
            "hazard_severity": village.hazard_severity,
            "slope_risk": village.slope_risk,
            "population_exposure": village.population_exposure,
            "accessibility_risk": village.accessibility_risk,
            "facility_access_risk": village.facility_access_risk,
            "historical_event_risk": village.historical_event_risk,
        }

    conn = db.get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO adjudications "
            "(report_id, authority_id, actual_people_affected, actual_severity, outcome, note, created_at) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s) "
            "ON CONFLICT (report_id) DO UPDATE SET "
            "authority_id=excluded.authority_id, "
            "actual_people_affected=excluded.actual_people_affected, "
            "actual_severity=excluded.actual_severity, "
            "outcome=excluded.outcome, "
            "note=excluded.note, "
            "created_at=excluded.created_at",
            (
                data.report_id,
                user["id"],
                data.actual_people_affected,
                data.actual_severity,
                data.outcome,
                data.note,
                time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            ),
        )
        cur.execute(
            "UPDATE sos_reports SET status='RESOLVED', adjudicated_by=%s, adjudicated_at=%s WHERE id=%s",
            (user["id"], time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), data.report_id),
        )
        conn.commit()
    finally:
        conn.close()

    learning = None
    if factors:
        learning = record_observation(
            factors,
            data.actual_severity,
            source="live",
            provenance="adjudicated_sos",
        )

    return {
        "report_id": data.report_id,
        "status": "RESOLVED",
        "recorded": True,
        "learning_update": learning,
    }


@app.get("/api/sos/priority-queue")
def sos_priority_queue():
    return get_priority_queue()


@app.get("/api/sos/aggregate")
def sos_aggregate():
    """Aggregate SOS data by village (no PII)."""
    return aggregate_by_village()


@app.get("/api/sos/stats")
def sos_stats():
    """Quick SOS statistics."""
    reports = load_sos_reports()
    total = len(reports)
    active = sum(1 for r in reports if r["status"] != "RESOLVED")
    new_count = sum(1 for r in reports if r["status"] == "NEW")
    medical = sum(1 for r in reports if r["medical_emergency"] and r["status"] != "RESOLVED")
    people = sum(r["people_affected"] for r in reports if r["status"] != "RESOLVED")
    return {
        "total_reports": total,
        "active_reports": active,
        "new_reports": new_count,
        "medical_emergencies": medical,
        "total_people_affected": people,
    }


@app.get("/api/sos/latest")
def sos_latest():
    """Latest active reports for the public SOS feed (no PII)."""
    reports = [r for r in load_sos_reports() if r["status"] != "RESOLVED"]
    latest = sorted(reports, key=lambda r: r["timestamp"], reverse=True)[:10]
    return [
        {
            "id": r["id"],
            "village_id": r["village_id"],
            "village_name": r["village_name"],
            "emergency_type": r["emergency_type"],
            "severity": r["severity"],
            "people_affected": r["people_affected"],
            "medical_emergency": r["medical_emergency"],
            "latitude": r["latitude"],
            "longitude": r["longitude"],
            "timestamp": r["timestamp"],
        }
        for r in latest
    ]


# ---------------------------------------------------------------------------
# Validation: real-data ingestion (red zones) + backtest (Kedarnath 2013)
# ---------------------------------------------------------------------------
@app.get("/api/validation/red-zones")
def validation_red_zones():
    """Run the ingestion pipeline over the bundled SAMPLE inputs and show the
    resulting hazard-severity attribution for each settlement."""
    settlements = ingest_sample()
    return {
        "source_note": "Sample inputs only - NOT live official feeds. See "
                       "backend/app/data/inputs/*.csv and *.geojson for provenance.",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "villages": [v.model_dump() for v in settlements],
    }


@app.get("/api/validation/backtest")
def validation_backtest():
    """Replay the documented Kedarnath 2013 event through the current model
    and report prediction vs. observed outcome."""
    events = load_backtest_events()
    if not events:
        return {
            "fixture": "missing",
            "note": "No backtest fixture found under backend/app/data/backtest/.",
        }
    villages = build_backtest_villages(events)
    rows = []
    bands = {"SAFE": 0, "MODERATE": 1, "HIGH": 2, "CRITICAL": 3}
    exact_hits = onep_hits = critical_recall_hits = critical_recall_total = 0
    for e, v in zip(events, villages):
        score, level, explanation, breakdown = calculate_risk(v)
        expected = (
            "CRITICAL" if e["observed_severity"] >= 5
            else "HIGH" if e["observed_severity"] >= 4
            else "MODERATE" if e["observed_severity"] >= 3
            else "SAFE"
        )
        matched = level == expected
        within_one = abs(bands[level] - bands[expected]) <= 1
        exact_hits += 1 if matched else 0
        onep_hits += 1 if within_one else 0
        if e["observed_severity"] >= 4:  # severe events must be flagged
            critical_recall_total += 1
            critical_recall_hits += 1 if level in ("HIGH", "CRITICAL") else 0
        rows.append({
            "id": e["id"],
            "location_name": e["location_name"],
            "observed_severity": e["observed_severity"],
            "observed_outcome": e.get("observed_outcome", ""),
            "predicted_risk_score": score,
            "predicted_risk_level": level,
            "expected_risk_level": expected,
            "classification_match": matched,
            "within_one_level": within_one,
            "explanation": explanation,
        })
    n = len(rows)
    return {
        "event": "Kedarnath flash flood & GLOF, June 2013 (fixture: backend/app/data/backtest/kedarnath_2013.json)",
        "note": (
            "Illustrative reconstruction for validation - see fixture provenance. "
            "A decision-support model is expected to over-flag rather than under-flag; "
            "exact-match accuracy is a strict test, within-one-level is the practical "
            "band tolerance, and critical-recall measures whether severe events get flagged."
        ),
        "rows": rows,
        "accuracy_exact": round(exact_hits / n, 2) if n else None,
        "accuracy_within_one_level": round(onep_hits / n, 2) if n else None,
        "critical_recall": round(critical_recall_hits / critical_recall_total, 2) if critical_recall_total else None,
        "learning_confidence": learning_stats()["confidence"],
    }


@app.post("/api/validation/register-event")
def register_event(data: EventInput, user: dict = Depends(require_official)):
    """Authorities register a documented historical event (validation corpus)."""
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO events "
            "(id, village_id, location_name, hazard_type, date, observed_severity, magnitude, source, note, factors_json, provenance) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
            "ON CONFLICT (id) DO UPDATE SET "
            "village_id=excluded.village_id, "
            "location_name=excluded.location_name, "
            "hazard_type=excluded.hazard_type, "
            "date=excluded.date, "
            "observed_severity=excluded.observed_severity, "
            "magnitude=excluded.magnitude, "
            "source=excluded.source, "
            "note=excluded.note, "
            "factors_json=excluded.factors_json, "
            "provenance=excluded.provenance",
            (
                data.id,
                data.village_id,
                data.location_name,
                data.hazard_type,
                data.date,
                data.observed_severity,
                data.magnitude,
                data.source,
                data.note,
                json.dumps(data.factors) if data.factors else None,
                data.provenance,
            ),
        )
        conn.commit()
    finally:
        conn.close()

    # If the event carries a factor snapshot it also trains the model. The
    # observation is stored as source='historical' with its provenance label,
    # so registered events shape the weights without inflating live confidence.
    learned = None
    if data.factors:
        learned = record_observation(
            data.factors,
            int(data.observed_severity),
            source="historical",
            provenance=data.provenance,
            village_id=data.village_id,
            event_ref=data.id,
        )

    return {
        "id": data.id,
        "registered": True,
        "provenance": data.provenance,
        "trained": learned is not None,
        "learning": learned,
    }


@app.get("/api/events")
def list_events():
    """Public list of registered validation events."""
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM events ORDER BY date")
        rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Offline manifest (for the Service Worker)
# ---------------------------------------------------------------------------
@app.get("/api/offline-manifest")
def offline_manifest():
    """Data snapshot the frontend can cache for offline use."""
    villages = load_villages()
    safe_zones = load_safe_zones()
    results, ledger, summary = run_full_pipeline(villages, safe_zones)
    return {
        "version": "1.1",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "villages": [r.model_dump() for r in results],
        "safe_zones": [sz.model_dump() for sz in ledger.as_results()],
        "risk_summary": summary.model_dump(),
        "sos_reports": load_sos_reports(),
        "ground_reality": [gr.model_dump() for gr in compute_ground_reality(villages)],
        "operational_priority": [
            op.model_dump() for op in get_operational_priority_list(villages)
        ],
    }


# ---------------------------------------------------------------------------
# Ground Reality endpoints
# ---------------------------------------------------------------------------
@app.get("/api/ground-reality")
def get_ground_reality():
    villages = load_villages()
    return compute_ground_reality(villages)


@app.get("/api/ground-reality/{village_id}")
def get_village_ground_reality(village_id: str):
    villages = load_villages()
    village = next((v for v in villages if v.id == village_id), None)
    if not village:
        raise HTTPException(status_code=404, detail=f"Village '{village_id}' not found")
    results = compute_ground_reality([village])
    if results:
        return results[0]
    raise HTTPException(status_code=404, detail="No data available")


@app.get("/api/operational-priority")
def get_operational_priority():
    villages = load_villages()
    return get_operational_priority_list(villages)


# ---------------------------------------------------------------------------
# WebSocket - real-time alert stream (new SOS, status changes)
# ---------------------------------------------------------------------------
@app.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    """Public real-time SOS alert stream (aggregate only, no PII)."""
    await websocket.accept()
    last_signature = None
    try:
        while True:
            reports = load_sos_reports()
            active = sorted(
                (r for r in reports if r["status"] != "RESOLVED"),
                key=lambda r: r["timestamp"], reverse=True,
            )
            signature = (len(active), active[0]["id"] if active else None)
            if signature != last_signature:
                last_signature = signature
                latest = active[:5] if active else []
                await websocket.send_json({
                    "type": "sos_update",
                    "active_count": len(active),
                    "total_reports": len(reports),
                    "latest": [
                        {
                            "id": r["id"],
                            "village_name": r["village_name"],
                            "emergency_type": r["emergency_type"],
                            "severity": r["severity"],
                            "timestamp": r["timestamp"],
                        }
                        for r in latest
                    ],
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                })
            await asyncio.sleep(3)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass


# ---------------------------------------------------------------------------
# LifeLink Mesh Network endpoints — authenticated volunteers+ only
# ---------------------------------------------------------------------------

@app.post("/api/mesh/node/register")
def register_node(node: MeshNode, user: dict = Depends(require_volunteer)):
    """Register or update a mesh node."""
    register_mesh_node(node.model_dump())
    return {"registered": True, "node_id": node.node_id}


@app.post("/api/mesh/packet/queue")
def queue_packet(packet: MeshPacket, user: dict = Depends(require_volunteer)):
    """Queue a mesh packet for store-carry-forward routing."""
    queue_mesh_packet(packet.model_dump())
    return {"queued": True, "packet_id": packet.packet_id}


@app.get("/api/mesh/packets")
def get_packets(node_id: str, max_packets: int = 50, user: dict = Depends(require_volunteer)):
    """Get packets destined for a node."""
    packets = get_packets_for_node(node_id, max_packets)
    return {"node_id": node_id, "packets": packets}


@app.get("/api/mesh/nodes")
def get_nodes(user: dict = Depends(require_official)):
    """Get all active mesh nodes sorted by battery and connectivity."""
    nodes = get_active_nodes()
    return {"nodes": nodes}


@app.post("/api/mesh/sync")
def mesh_sync(req: MeshSyncRequest, user: dict = Depends(require_volunteer)):
    """Sync mesh data from a gateway node."""
    packets = get_packets_for_node(req.node_id, max_packets=100)
    return MeshSyncResponse(node_id=req.node_id, packets=packets)


# ---------------------------------------------------------------------------
# Satellite Backhaul & Virtual Satcom Terminal (ISRO DAT-SG / NavIC) Endpoints
# ---------------------------------------------------------------------------

@app.post("/api/satellite/transmit", response_model=SatelliteTransmitResult)
def transmit_satellite_sos(req: SatelliteTransmitRequest):
    """
    Simulate phone -> BLE -> Satcom terminal -> Satellite uplink -> Ground Gateway -> SafeZone.
    Compresses or validates burst packet, models orbital link latency,
    decodes payload, and creates a verified SOS report with Satellite Backhaul metadata.
    """
    villages = load_villages()
    village = next((v for v in villages if v.id == req.village_id), None)
    pop = village.population if village else 2000
    v_name = village.name if village else req.village_id

    # If raw packet not provided, encode one using compact SZ1 protocol
    if not req.raw_packet:
        raw_packet = encode_satellite_burst_packet(
            village_id=req.village_id,
            latitude=req.latitude,
            longitude=req.longitude,
            severity=req.severity,
            people_affected=req.people_affected,
            medical_emergency=req.medical_emergency,
            emergency_type=req.emergency_type,
            terminal_id=req.terminal_id,
        )
    else:
        raw_packet = req.raw_packet

    # Simulate orbital link telemetry
    sim = simulate_satellite_uplink(raw_packet, terminal_id=req.terminal_id)
    telemetry = sim["telemetry"]

    # Ingest into SOS engine as SATELLITE channel
    sos_input = SOSReportInput(
        reporter_name=req.reporter_name or f"Citizen via {req.terminal_id}",
        reporter_phone=req.reporter_phone or "",
        village_id=req.village_id,
        village_name=v_name,
        emergency_type=req.emergency_type,
        severity=req.severity,
        description=f"[Satellite Backhaul — Simulated] {req.description} (Terminal: {req.terminal_id}, Latency: {telemetry['latency_ms']}ms)",
        people_affected=req.people_affected,
        medical_emergency=req.medical_emergency,
        latitude=req.latitude,
        longitude=req.longitude,
        timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        transmission_channel="SATELLITE",
        sat_terminal_id=req.terminal_id,
        sat_constellation=sim["satellite_constellation"],
        sat_latency_ms=float(telemetry["latency_ms"]),
        sat_signal_dbhz=float(telemetry["carrier_to_noise_dbhz"]),
        raw_sat_packet=raw_packet,
    )

    report_result = add_sos_report(sos_input, village_population=pop)
    ack_code = f"ACK-SAT-{int(time.time()) % 100000:05d}"

    return SatelliteTransmitResult(
        uplink_status="SUCCESS",
        satellite_constellation=sim["satellite_constellation"],
        ground_gateway=sim["ground_gateway"],
        satellite_id=sim["satellite_id"],
        terminal_id=req.terminal_id,
        raw_packet=raw_packet,
        telemetry=telemetry,
        sos_report=report_result,
        ack_code=ack_code,
        timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    )


@app.get("/api/satellite/status")
def satellite_status():
    """Get live orbital status and health metrics for the disaster satcom network."""
    return get_satellite_constellation_status()


@app.get("/api/satellite/terminals")
def satellite_terminals():
    """List deployed virtual Satcom Terminals (ISRO DAT-SG compatible)."""
    return {"terminals": get_all_terminals()}


@app.post("/api/satellite/terminal/pair")
def pair_satcom_terminal(body: dict):
    """Simulate Bluetooth BLE pairing handshake between phone and satcom terminal."""
    terminal_id = body.get("terminal_id", "DATSG-KDR01")
    device_name = body.get("device_name", "Civilian Phone")
    return pair_terminal_ble(terminal_id, device_name)


@app.post("/api/satellite/downlink/broadcast")
def satellite_downlink_broadcast(body: SatelliteDownlinkBroadcast, user: dict = Depends(require_official)):
    """Authority broadcasts an emergency advisory down to satellite terminals."""
    item = broadcast_downlink_advisory(
        title=body.title,
        content=body.content,
        message_type=body.message_type,
        target_terminal=body.target_terminal,
    )
    return item


@app.get("/api/satellite/downlink/messages")
def satellite_downlink_messages(terminal_id: Optional[str] = None):
    """Get satellite downlink broadcast messages received at field terminals."""
    messages = get_downlink_messages(terminal_id)
    return {"messages": messages}