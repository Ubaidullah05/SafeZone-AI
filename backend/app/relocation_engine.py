"""
Relocation Engine
=================

Builds on the Risk Engine to answer three further questions:

1. Vulnerability     - how badly would this population be affected, not just
                        how hazardous is the location?
2. Relocation Priority - which habitation should be relocated first?
3. Destination Ranking - given a village that needs relocation, which safe
                          zone is the best feasible destination (not simply
                          the nearest one)?

All formulas are documented inline and use named constants so they can be
tuned without hunting through the codebase.
"""

import math

from .capacity_engine import CapacityLedger
from .models import VillageInput, SafeZoneInput, DestinationScore

# ---------------------------------------------------------------------------
# Vulnerability
# ---------------------------------------------------------------------------
# Vulnerability = Risk Score x Population Exposure Factor x Accessibility Factor
# Both factors are normalized to a 0-1 range around a neutral midpoint so
# that the result stays intuitively close to the risk score rather than
# collapsing towards zero.


def calculate_vulnerability(risk_score: float, village: VillageInput) -> float:
    population_exposure_factor = 0.5 + (village.population_exposure / 200)  # 0.5 - 1.0
    accessibility_factor = 0.5 + (village.accessibility_risk / 200)  # 0.5 - 1.0
    raw = risk_score * population_exposure_factor * accessibility_factor
    return round(min(raw, 100), 1)


# ---------------------------------------------------------------------------
# People requiring relocation & relocation trigger
# ---------------------------------------------------------------------------
RELOCATION_RISK_THRESHOLD = 60  # HIGH and above


def people_requiring_relocation(village: VillageInput, risk_score: float) -> int:
    """Estimate how many residents require relocation assessment, scaled by
    how far above the relocation threshold the risk score is."""
    if risk_score < RELOCATION_RISK_THRESHOLD:
        return 0
    severity_fraction = min((risk_score - RELOCATION_RISK_THRESHOLD) / (100 - RELOCATION_RISK_THRESHOLD), 1.0)
    # Blend a floor of 40% affected with the severity fraction so CRITICAL
    # villages approach ~90-95% of population needing relocation assessment.
    affected_fraction = 0.40 + 0.55 * severity_fraction
    return round(village.population * affected_fraction)


# ---------------------------------------------------------------------------
# Relocation priority (spec section 14)
# ---------------------------------------------------------------------------
WEIGHT_PRIORITY_RISK = 0.40
WEIGHT_PRIORITY_VULNERABILITY = 0.25
WEIGHT_PRIORITY_POPULATION_EXPOSURE = 0.20
WEIGHT_PRIORITY_CAPACITY_DEFICIT = 0.15


def calculate_relocation_priority(
    risk_score: float,
    vulnerability_score: float,
    village: VillageInput,
    capacity_deficit_score: float,
) -> float:
    priority = (
        WEIGHT_PRIORITY_RISK * risk_score
        + WEIGHT_PRIORITY_VULNERABILITY * vulnerability_score
        + WEIGHT_PRIORITY_POPULATION_EXPOSURE * village.population_exposure
        + WEIGHT_PRIORITY_CAPACITY_DEFICIT * capacity_deficit_score
    )
    return round(min(priority, 100), 1)


# ---------------------------------------------------------------------------
# Destination scoring (spec sections 16-17)
# ---------------------------------------------------------------------------
EARTH_RADIUS_KM = 6371.0
AVERAGE_ROAD_SPEED_KMH = 30.0  # assumption for hilly pilot-district roads

WEIGHT_DEST_SAFETY = 0.25
WEIGHT_DEST_CAPACITY = 0.25
WEIGHT_DEST_ROAD_ACCESS = 0.20
WEIGHT_DEST_DISTANCE = 0.15
WEIGHT_DEST_MEDICAL = 0.15

MAX_REASONABLE_DISTANCE_KM = 60  # beyond this, distance suitability -> 0


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return EARTH_RADIUS_KM * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _distance_suitability(distance_km: float) -> float:
    """0-100 score: closer is better, decaying to 0 at MAX_REASONABLE_DISTANCE_KM."""
    suitability = 100 * (1 - distance_km / MAX_REASONABLE_DISTANCE_KM)
    return max(min(suitability, 100), 0)


def score_destination(
    village: VillageInput,
    safe_zone: SafeZoneInput,
    remaining_capacity: int,
    people_needing_relocation: int,
) -> DestinationScore:
    distance_km = haversine_km(village.latitude, village.longitude, safe_zone.latitude, safe_zone.longitude)
    travel_time_minutes = (distance_km / AVERAGE_ROAD_SPEED_KMH) * 60

    capacity_ratio = min(remaining_capacity / max(people_needing_relocation, 1), 1.0)
    capacity_score = capacity_ratio * 100

    distance_suitability = _distance_suitability(distance_km)

    destination_score = round(
        WEIGHT_DEST_SAFETY * safe_zone.safety_score
        + WEIGHT_DEST_CAPACITY * capacity_score
        + WEIGHT_DEST_ROAD_ACCESS * safe_zone.road_access_score
        + WEIGHT_DEST_DISTANCE * distance_suitability
        + WEIGHT_DEST_MEDICAL * safe_zone.medical_access,
        1,
    )

    reasons = []
    if safe_zone.safety_score >= 80:
        reasons.append("High safety score")
    if remaining_capacity >= people_needing_relocation:
        reasons.append("Sufficient capacity")
    elif remaining_capacity > 0:
        reasons.append("Partial capacity available")
    if safe_zone.road_access_score >= 70:
        reasons.append("Good road accessibility")
    if safe_zone.medical_access >= 70:
        reasons.append("Nearby medical facilities")
    if distance_km <= 25:
        reasons.append("Acceptable travel distance")
    if not reasons:
        reasons.append("Best available option among feasible safe zones")

    return DestinationScore(
        safe_zone_id=safe_zone.id,
        safe_zone_name=safe_zone.name,
        distance_km=round(distance_km, 1),
        estimated_travel_time_minutes=round(travel_time_minutes, 0),
        available_capacity=remaining_capacity,
        safety_score=safe_zone.safety_score,
        medical_access=safe_zone.medical_access,
        road_accessibility=safe_zone.road_access_score,
        destination_score=destination_score,
        reasons=reasons,
    )


def rank_destinations(
    village: VillageInput,
    safe_zones: list[SafeZoneInput],
    ledger: CapacityLedger,
    people_needing_relocation: int,
) -> list[DestinationScore]:
    """Score every safe zone. Zones with sufficient capacity are preferred;
    zones with zero remaining capacity are only surfaced if nothing else is
    feasible (spec section 16)."""
    scored = [
        score_destination(village, sz, ledger.remaining_capacity(sz.id), people_needing_relocation)
        for sz in safe_zones
    ]

    with_capacity = [d for d in scored if d.available_capacity > 0]
    pool = with_capacity if with_capacity else scored

    return sorted(pool, key=lambda d: d.destination_score, reverse=True)
