"""
SAFEZONE-AI backend - FastAPI application entrypoint.

SIH26191: Intelligent Identification of Hazard-Based Red Zones, Carrying
Capacity Assessment, and Immediate Relocation Needs for Vulnerable Habitations.

This is a decision-support PROTOTYPE. All data is demo/sample data for a
fictional-but-geographically-consistent pilot district unless explicitly
documented otherwise. No live government or satellite feeds are integrated.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .data_loader import load_villages, load_safe_zones
from .models import RecommendationResult, ScenarioAdjustments, ScenarioResult
from .relocation_engine import rank_destinations
from .capacity_engine import CapacityLedger
from .scenario_engine import run_full_pipeline, run_scenario

app = FastAPI(
    title="SAFEZONE-AI API",
    description="Decision-support prototype for SIH26191. Demo/sample data only.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # relaxed for hackathon demo purposes
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/api/health")
def health():
    return {"status": "ok", "service": "SAFEZONE-AI backend", "mode": "demo-data"}


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
