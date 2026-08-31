"""
Pydantic data models shared across the SafeLink - AI backend.

These models define the shape of raw input data (villages / safe zones)
and the shape of calculated results returned by the various engines.
"""

from typing import Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Auth models
# ---------------------------------------------------------------------------

class UserRegister(BaseModel):
    name: str
    email: str
    password: str
    role: str = "citizen"


class UserLogin(BaseModel):
    email: str
    password: str


class PinLogin(BaseModel):
    pin: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserProfile(BaseModel):
    id: str
    name: str
    email: str
    role: str


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
# SOS models
# ---------------------------------------------------------------------------

class SOSReportInput(BaseModel):
    """A citizen-submitted SOS report."""
    reporter_name: str
    reporter_phone: str = ""
    village_id: str
    village_name: str
    emergency_type: str
    severity: int = Field(ge=1, le=5)
    description: str
    people_affected: int = 1
    medical_emergency: bool = False
    medical_details: str = ""
    latitude: float
    longitude: float
    timestamp: str = ""


class SOSReportResult(BaseModel):
    """An SOS report enriched with calculated results."""
    id: str
    reporter_name: str
    reporter_phone: str = ""
    village_id: str
    village_name: str
    emergency_type: str
    severity: int
    description: str
    people_affected: int
    medical_emergency: bool
    medical_details: str = ""
    latitude: float
    longitude: float
    timestamp: str
    status: str = "NEW"
    priority_score: float = 0
    relay_hops: int = 0
    reached_gateway: bool = False


class SOSPriorityItem(BaseModel):
    """Lightweight SOS item for the priority queue."""
    report_id: str
    village_id: str
    village_name: str
    emergency_type: str
    severity: int
    people_affected: int
    medical_emergency: bool
    priority_score: float
    status: str
    timestamp: str


# ---------------------------------------------------------------------------
# Mesh network models
# ---------------------------------------------------------------------------

class MeshNode(BaseModel):
    """A device node in the offline mesh network."""
    id: str
    device_name: str
    device_type: str  # CIVILIAN, VOLUNTEER, RESCUE, GATEWAY
    village_id: Optional[str] = None
    village_name: str
    battery_level: int = Field(ge=0, le=100)
    status: str  # ACTIVE, INACTIVE, RELAYING
    last_seen: str
    connected_peers: list[str] = []
    latitude: float
    longitude: float
    messages_relayed: int = 0


class MeshHealthSummary(BaseModel):
    """Summary of mesh network health."""
    total_nodes: int
    active_nodes: int
    inactive_nodes: int
    relay_nodes: int
    gateway_nodes: int
    civilian_nodes: int
    volunteer_nodes: int
    rescue_nodes: int
    avg_battery: float
    total_messages_relayed: int
    network_coverage_pct: float


# ---------------------------------------------------------------------------
# Ground Reality models
# ---------------------------------------------------------------------------

class GroundRealityResult(BaseModel):
    """Combined risk + SOS intelligence for a single village."""
    village_id: str
    village_name: str
    latitude: float
    longitude: float
    population: int
    predicted_risk_score: float
    predicted_risk_level: str
    sos_intensity: float
    report_density: float
    severity_aggregate: float
    medical_urgency: float
    ground_reality_score: float
    operational_priority: str
    total_sos_reports: int
    active_sos_reports: int
    people_affected_by_sos: int
    medical_emergencies: int
    emergency_types: list[str] = []
    risk_breakdown: Optional["RiskBreakdown"] = None
    explanation: list[str] = []


class OperationalPriorityItem(BaseModel):
    """Ranked item for the operational priority table."""
    village_id: str
    village_name: str
    predicted_risk: float
    ground_reality_score: float
    operational_priority: str
    active_sos_reports: int
    people_affected: int
    medical_emergencies: int
    population: int


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
