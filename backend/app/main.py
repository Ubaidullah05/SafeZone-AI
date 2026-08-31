"""
SafeLink - AI backend - FastAPI application entrypoint.

SIH26191: Intelligent Identification of Hazard-Based Red Zones, Carrying
Capacity Assessment, and Immediate Relocation Needs for Vulnerable Habitations.

This is a decision-support PROTOTYPE. All data is demo/sample data for a
fictional-but-geographically-consistent pilot district unless explicitly
documented otherwise. No live government or satellite feeds are integrated.
"""

import json
import time
import asyncio
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Header, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .data_loader import load_villages, load_safe_zones
from .models import (
    RecommendationResult, ScenarioAdjustments, ScenarioResult,
    UserRegister, UserLogin, PinLogin, TokenResponse,
    SOSReportInput, SOSReportResult,
    MeshNode, MeshHealthSummary,
)
from .relocation_engine import rank_destinations
from .capacity_engine import CapacityLedger
from .scenario_engine import run_full_pipeline, run_scenario
from .auth import (
    create_token, decode_token, find_user_by_email, find_user_by_id,
    create_user, verify_password, authenticate_face_mock, authenticate_face,
    authenticate_fingerprint, authenticate_pin,
)
from .sos_engine import (
    add_sos_report, get_reports_by_village, get_reports_by_status,
    update_report_status, get_priority_queue, aggregate_by_village,
    load_sos_reports,
)
from .ground_reality_engine import (
    compute_ground_reality, get_operational_priority_list,
)
from . import mesh_engine

DATA_DIR = Path(__file__).parent / "data"

app = FastAPI(
    title="SafeLink - AI API",
    description="Decision-support prototype for SIH26191. Demo/sample data only.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------

def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """Extract and validate JWT from Authorization header. Returns user dict or None."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    payload = decode_token(token)
    if not payload:
        return None
    user = find_user_by_id(payload.get("sub", ""))
    return user


def require_auth(authorization: Optional[str] = Header(None)) -> dict:
    """Require a valid JWT token. Raises 401 if missing/invalid."""
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/api/health")
def health():
    return {"status": "ok", "service": "SafeLink - AI backend", "mode": "demo-data"}


# ---------------------------------------------------------------------------
# Authentication endpoints
# ---------------------------------------------------------------------------
@app.post("/api/auth/register", response_model=TokenResponse)
def register(data: UserRegister):
    try:
        user = create_user(data.name, data.email, data.password, data.role)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    token = create_token(user["id"], user["name"], user["email"], user["role"])
    return TokenResponse(
        access_token=token,
        user={"id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"]},
    )


@app.post("/api/auth/login", response_model=TokenResponse)
def login(data: UserLogin):
    user = find_user_by_email(data.email)
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"], user["name"], user["email"], user["role"])
    return TokenResponse(
        access_token=token,
        user={"id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"]},
    )


@app.post("/api/auth/face-login", response_model=TokenResponse)
def face_login(data: dict = None):
    """Face recognition login. On mobile, captures real camera image.
    For demo: accepts image data and returns the user account."""
    image_data = ""
    if data:
        image_data = data.get("image_data", "demo")
    user = authenticate_face(image_data if image_data else "demo")
    token = create_token(user["id"], user["name"], user["email"], user["role"])
    return TokenResponse(
        access_token=token,
        user={"id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"]},
    )


@app.post("/api/auth/fingerprint-login", response_model=TokenResponse)
def fingerprint_login(data: dict = None):
    """Fingerprint/biometric login using WebAuthn. On mobile, triggers device biometric.
    For demo: accepts credential data and returns the user account."""
    credential_id = ""
    if data:
        credential_id = data.get("credential_id", "demo")
    user = authenticate_fingerprint(credential_id if credential_id else "demo")
    token = create_token(user["id"], user["name"], user["email"], user["role"])
    return TokenResponse(
        access_token=token,
        user={"id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"]},
    )


@app.post("/api/auth/pin-login", response_model=TokenResponse)
def pin_login(data: PinLogin):
    user = authenticate_pin(data.pin)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid emergency PIN")
    token = create_token(user["id"], user["name"], user["email"], user["role"])
    return TokenResponse(
        access_token=token,
        user={"id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"]},
    )


@app.get("/api/auth/me")
def get_me(user: dict = Depends(require_auth)):
    return {"id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"]}


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
            f"No relocation is required at this time based on current risk factors.",
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
            f"on safety, capacity, accessibility, medical access, and travel distance."
        )
    else:
        summary = (
            f"{village.name} is currently classified as {village_result.risk_level} due to {reasons_text}. "
            f"An estimated {village_result.people_requiring_relocation:,} residents require relocation "
            f"assessment, but no safe zone data is currently available."
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
# Scenario simulation
# ---------------------------------------------------------------------------
@app.post("/api/scenario", response_model=ScenarioResult)
def post_scenario(adjustments: ScenarioAdjustments):
    villages = load_villages()
    safe_zones = load_safe_zones()
    return run_scenario(villages, safe_zones, adjustments)


# ---------------------------------------------------------------------------
# SAFEZONE CONNECT - SOS endpoints
# ---------------------------------------------------------------------------
@app.post("/api/sos/submit", response_model=SOSReportResult)
def submit_sos(report: SOSReportInput):
    """Citizen submits an SOS report and relays through mesh network."""
    villages = load_villages()
    village = next((v for v in villages if v.id == report.village_id), None)
    pop = village.population if village else 2000
    result = add_sos_report(report, village_population=pop)
    # Also submit through mesh network for real-time relay visualization
    try:
        # Find a mesh node in the same village
        nodes = mesh_engine.get_nodes()
        source_node = "NODE001"  # default
        for n in nodes:
            if n.get("village_id") == report.village_id and n["status"] == "ACTIVE":
                source_node = n["id"]
                break
        mesh_engine.submit_sos_message({
            "emergency_type": report.emergency_type,
            "severity": report.severity,
            "medical_emergency": report.medical_emergency,
            "description": report.description,
            "source_node": source_node,
            "village_id": report.village_id,
            "latitude": report.latitude,
            "longitude": report.longitude,
        })
    except Exception:
        pass  # Mesh relay is best-effort
    return result


@app.get("/api/sos/reports")
def get_sos_reports(
    village_id: Optional[str] = None,
    status: Optional[str] = None,
):
    """Get all SOS reports, optionally filtered."""
    reports = load_sos_reports()
    if village_id:
        reports = [r for r in reports if r["village_id"] == village_id]
    if status:
        reports = [r for r in reports if r["status"] == status]
    reports.sort(key=lambda r: r["priority_score"], reverse=True)
    return reports


@app.get("/api/sos/reports/{report_id}")
def get_sos_report(report_id: str):
    reports = load_sos_reports()
    for r in reports:
        if r["id"] == report_id:
            return r
    raise HTTPException(status_code=404, detail=f"Report '{report_id}' not found")


@app.patch("/api/sos/reports/{report_id}")
def patch_sos_report(report_id: str, body: dict):
    """Update report status."""
    new_status = body.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="'status' field required")
    result = update_report_status(report_id, new_status)
    if not result:
        raise HTTPException(status_code=404, detail=f"Report '{report_id}' not found")
    return result


@app.get("/api/sos/priority-queue")
def sos_priority_queue():
    return get_priority_queue()


@app.get("/api/sos/aggregate")
def sos_aggregate():
    """Aggregate SOS data by village."""
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


# ---------------------------------------------------------------------------
# Mesh network endpoints (simulated real-time)
# ---------------------------------------------------------------------------
@app.get("/api/mesh/nodes")
def get_mesh_nodes():
    """Get all mesh nodes with live simulated state."""
    return mesh_engine.get_nodes()


@app.get("/api/mesh/health")
def get_mesh_health():
    """Get mesh network health with live metrics."""
    return mesh_engine.get_health()


@app.get("/api/mesh/relay-paths")
def get_mesh_relay_paths():
    """Get visualizable relay paths between nodes."""
    return mesh_engine.get_relay_paths()


@app.get("/api/mesh/clusters")
def get_mesh_clusters():
    """Get dynamic cluster formations."""
    return mesh_engine.get_clusters()


@app.get("/api/mesh/messages")
def get_mesh_messages():
    """Get current message state (in-transit, delivered, relay log)."""
    return mesh_engine.get_messages()


@app.get("/api/mesh/map-data")
def get_mesh_map_data():
    """Get all data needed for real-time network visualization."""
    return mesh_engine.get_network_map_data()


@app.post("/api/mesh/sos")
def submit_mesh_sos(body: dict):
    """Submit an SOS message through the mesh network."""
    result = mesh_engine.submit_sos_message(body)
    return result


# ---------------------------------------------------------------------------
# WebSocket - Real-time mesh updates
# ---------------------------------------------------------------------------
connected_clients: set[WebSocket] = set()


@app.websocket("/ws/mesh")
async def websocket_mesh(websocket: WebSocket):
    """Real-time mesh network updates via WebSocket."""
    await websocket.accept()
    connected_clients.add(websocket)
    try:
        while True:
            # Send mesh state every 2 seconds
            data = mesh_engine.get_network_map_data()
            await websocket.send_json(data)
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        connected_clients.discard(websocket)
    except Exception:
        connected_clients.discard(websocket)


@app.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    """Real-time alert updates (new SOS, status changes)."""
    await websocket.accept()
    connected_clients.add(websocket)
    last_count = 0
    try:
        while True:
            # Check for new SOS reports
            reports = load_sos_reports()
            new_count = len([r for r in reports if r["status"] == "NEW"])
            if new_count != last_count:
                await websocket.send_json({
                    "type": "sos_update",
                    "new_reports": new_count,
                    "total_reports": len(reports),
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                })
                last_count = new_count
            await asyncio.sleep(3)
    except WebSocketDisconnect:
        connected_clients.discard(websocket)
    except Exception:
        connected_clients.discard(websocket)


# ---------------------------------------------------------------------------
# Offline manifest - serves cacheable data for Service Worker
# ---------------------------------------------------------------------------
@app.get("/api/offline-manifest")
def offline_manifest():
    """Returns data that should be cached for offline use."""
    villages = load_villages()
    safe_zones = load_safe_zones()
    results, ledger, summary = run_full_pipeline(villages, safe_zones)
    return {
        "version": "1.0",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "villages": [r.model_dump() for r in results],
        "safe_zones": [sz.model_dump() for sz in ledger.as_results()],
        "risk_summary": summary.model_dump(),
        "sos_reports": load_sos_reports(),
        "mesh_nodes": mesh_engine.get_nodes(),
        "mesh_health": mesh_engine.get_health(),
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
