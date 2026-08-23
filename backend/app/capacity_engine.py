"""
Capacity Engine
===============

Tracks how much of each safe zone's capacity has already been allocated to
higher-priority habitations, and computes the district-wide capacity gap:

    Capacity Gap = Population Requiring Relocation - Available Safe Capacity

The gap is never allowed to go negative (spec section 15) - a surplus of
capacity is simply reported as a gap of 0.
"""

from .models import SafeZoneInput, SafeZoneResult


def total_safe_capacity(safe_zones: list[SafeZoneInput]) -> int:
    return sum(sz.capacity for sz in safe_zones)


def calculate_capacity_gap(population_requiring_relocation: int, available_capacity: int) -> int:
    gap = population_requiring_relocation - available_capacity
    return max(gap, 0)


class CapacityLedger:
    """
    Tracks live remaining capacity per safe zone as villages are allocated to
    it, in priority order. This lets the relocation engine avoid recommending
    a shelter that has already been filled by a higher-priority village.
    """

    def __init__(self, safe_zones: list[SafeZoneInput]):
        self._safe_zones = {sz.id: sz for sz in safe_zones}
        self._allocated: dict[str, int] = {sz.id: 0 for sz in safe_zones}

    def remaining_capacity(self, safe_zone_id: str) -> int:
        sz = self._safe_zones[safe_zone_id]
        return max(sz.capacity - self._allocated[safe_zone_id], 0)

    def allocate(self, safe_zone_id: str, people: int) -> None:
        self._allocated[safe_zone_id] += people

    def as_results(self) -> list[SafeZoneResult]:
        results = []
        for sz_id, sz in self._safe_zones.items():
            allocated = self._allocated[sz_id]
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
                    allocated_population=allocated,
                    remaining_capacity=max(sz.capacity - allocated, 0),
                )
            )
        return results
