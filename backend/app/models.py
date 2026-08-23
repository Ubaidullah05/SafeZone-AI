"""
Pydantic data models shared across the SAFEZONE-AI backend.

These models define the shape of raw input data (villages / safe zones)
and the shape of calculated results returned by the various engines.
"""

from typing import Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Raw input models (demo/sample data)
# ---------------------------------------------------------------------------

class VillageInput(BaseModel):
    """Raw habitation record as stored in villages.json (demo/sample data)."""
    id: str
    name: str
    latitude: float
    longitude: float
    population: int
    hazard_severity: float = Field(ge=0, le=100)
    slope_risk: float = Field(ge=0, le=100)
    population_exposure: float = Field(ge=0, le=100)
    accessibility_risk: float = Field(ge=0, le=100)
    facility_access_risk: float = Field(ge=0, le=100)
    historical_event_risk: float = Field(ge=0, le=100)


class SafeZoneInput(BaseModel):
    """Raw safe zone / shelter record as stored in safe_zones.json (demo/sample data)."""
    id: str
    name: str
    latitude: float
    longitude: float
    capacity: int
    medical_access: float = Field(ge=0, le=100)
    safety_score: float = Field(ge=0, le=100)
    road_access_score: float = Field(ge=0, le=100)


# ---------------------------------------------------------------------------
# Calculated result models
# ---------------------------------------------------------------------------

class RiskBreakdown(BaseModel):
    hazard_severity: float
    slope_risk: float
    population_exposure: float
    accessibility_risk: float
    facility_access_risk: float
    historical_event_risk: float


class VillageResult(BaseModel):
    """A village enriched with all calculated (not raw) results. This is the
    canonical shape returned by most village-related API endpoints."""
    id: str
    name: str
    latitude: float
    longitude: float
    population: int

    risk_score: float
    risk_level: str  # SAFE | MODERATE | HIGH | CRITICAL

    vulnerability_score: float

    relocation_required: bool
    people_requiring_relocation: int
    relocation_priority_score: float
    relocation_priority_rank: Optional[int] = None

    risk_breakdown: RiskBreakdown
    explanation: list[str]

    recommended_safe_zone_id: Optional[str] = None
    recommended_safe_zone_name: Optional[str] = None


class SafeZoneResult(BaseModel):
    """A safe zone enriched with live occupancy/capacity information."""
    id: str
    name: str
    latitude: float
    longitude: float
    capacity: int
    medical_access: float
    safety_score: float
    road_access_score: float
    allocated_population: int
    remaining_capacity: int


class DestinationScore(BaseModel):
    safe_zone_id: str
    safe_zone_name: str
    distance_km: float
    estimated_travel_time_minutes: float
    available_capacity: int
    safety_score: float
    medical_access: float
    road_accessibility: float
    destination_score: float
    reasons: list[str]


class RecommendationResult(BaseModel):
    village_id: str
    village_name: str
    people_requiring_relocation: int
    recommended: Optional[DestinationScore] = None
    alternatives: list[DestinationScore] = []
    summary: str


class RiskSummary(BaseModel):
    total_habitations: int
    high_or_critical: int
    population_at_risk: int
    relocation_required_population: int
    available_safe_capacity: int
    capacity_gap: int
    risk_distribution: dict[str, int]


class ScenarioAdjustments(BaseModel):
    """Multipliers/deltas applied on top of the base dataset for a what-if run."""
    hazard_severity_delta_pct: float = 0.0
    rainfall_intensity_delta_pct: float = 0.0
    population_exposure_delta_pct: float = 0.0
    road_accessibility_delta_pct: float = 0.0  # positive = improves accessibility
    road_closure: bool = False


class ScenarioComparison(BaseModel):
    before_high_risk: int
    before_critical: int
    before_population_at_risk: int
    after_high_risk: int
    after_critical: int
    after_population_at_risk: int
    additional_population_at_risk: int


class ScenarioResult(BaseModel):
    villages: list[VillageResult]
    safe_zones: list[SafeZoneResult]
    risk_summary: RiskSummary
    comparison: ScenarioComparison
