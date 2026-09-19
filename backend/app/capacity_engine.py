"""
Capacity Engine
===============

Tracks how much of each safe zone's capacity is usable for evacuation and how
much has already been allocated to higher-priority habitations, plus the
district-wide capacity gap.

Following Sritart et al. (2020) - "Spatial Vulnerability Assessment for
Evacuation Shelters":
  * raw capacity is NOT the binding constraint - effective (usable) capacity
    collapses when a shelter is poorly accessible or its access roads degrade,
  * we therefore discount nominal capacity by an accessibility factor before
    any allocation decisions are made.

Capacity Gap = Population Requiring Relocation - Available Effective Capacity
The gap is never allowed to go negative (spec section 15).
"""

from .models import SafeZoneInput, SafeZoneResult

# Minimal accessibility factor applied when a shelter's road access is poor.
ACCESS_COLLAPSE_FLOOR = 0.40


def effective_capacity(safe_zone: SafeZoneInput) -> int:
    """Nominal capacity discounted by road accessibility (0-1 scale)."""
    road_factor = ACCESS_COLLAPSE_FLOOR + 0.60 * (safe_zone.road_access_score / 100.0)
    return max(int(round(safe_zone.capacity * road_factor)), 0)


def total_safe_capacity(safe_zones: list[SafeZoneInput]) -> int:
    return sum(effective_capacity(sz) for sz in safe_zones)


def calculate_capacity_gap(population_requiring_relocation: int, available_capacity: int) -> int:
    gap = population_requiring_relocation - available_capacity
    return max(gap, 0)


class CapacityLedger:
    """
    Tracks live remaining EFFECTIVE capacity per safe zone as villages are
    allocated to it, in priority order. This lets the relocation engine avoid
    recommending a shelter that has already been filled by a higher-priority
    village.
    """

    def __init__(self, safe_zones: list[SafeZoneInput]):
        self._safe_zones = {sz.id: sz for sz in safe_zones}
        self._effective = {sz.id: effective_capacity(sz) for sz in safe_zones}
        self._allocated: dict[str, int] = {sz.id: 0 for sz in safe_zones}

    def remaining_capacity(self, safe_zone_id: str) -> int:
        return max(self._effective[safe_zone_id] - self._allocated[safe_zone_id], 0)

    def allocate(self, safe_zone_id: str, people: int) -> None:
        self._allocated[safe_zone_id] += people

    def as_results(self) -> list[SafeZoneResult]:
        results = []
        for sz_id, sz in self._safe_zones.items():
            allocated = self._allocated[sz_id]
            eff = self._effective[sz_id]
            results.append(
                SafeZoneResult(
                    id=sz.id,
                    name=sz.name,
                    latitude=sz.latitude,
                    longitude=sz.longitude,
                    capacity=sz.capacity,
                    medical_access=sz.medical_access,
                    safety_score=sz.safety_score,
                    road_access_score=sz.road_access_score,
                    effective_capacity=eff,
                    allocated_population=allocated,
                    remaining_capacity=max(eff - allocated, 0),
                )
            )
        return results