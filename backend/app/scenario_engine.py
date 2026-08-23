"""
Scenario Engine
===============

Two responsibilities:

1. apply_adjustments() - takes the base village dataset and a set of what-if
   sliders (spec section 18) and returns an ADJUSTED copy. The base dataset
   on disk is never mutated.

2. run_full_pipeline() - the single, centralized place that walks the full
   data flow (spec section 22):

       Raw Village Data -> Risk -> Risk Level -> Vulnerability ->
       Relocation Requirement -> Candidate Safe Zones -> Capacity ->
       Destination Ranking -> Final Recommendation

   Both the "before" and "after" side of a scenario simulation call this
   exact same function, which guarantees the comparison is apples-to-apples
   and that there is only one implementation of the business logic.
"""

from .capacity_engine import CapacityLedger, calculate_capacity_gap, total_safe_capacity
from .models import (
    VillageInput,
    SafeZoneInput,
    VillageResult,
    RiskSummary,
    ScenarioAdjustments,
    ScenarioComparison,
    ScenarioResult,
)
from .relocation_engine import (
    calculate_vulnerability,
    people_requiring_relocation,
    calculate_relocation_priority,
    rank_destinations,
)
from .risk_engine import calculate_risk


def apply_adjustments(villages: list[VillageInput], adjustments: ScenarioAdjustments) -> list[VillageInput]:
    """Returns a new list of VillageInput with what-if sliders applied.
    Values are clamped to the valid 0-100 range."""

    def clamp(v: float) -> float:
        return max(0.0, min(100.0, v))

    adjusted = []
    for v in villages:
        hazard = v.hazard_severity * (1 + adjustments.hazard_severity_delta_pct / 100)
        hazard += v.hazard_severity * (adjustments.rainfall_intensity_delta_pct / 100) * 0.5

        population_exposure = v.population_exposure * (1 + adjustments.population_exposure_delta_pct / 100)

        # Positive road_accessibility_delta_pct improves accessibility, i.e.
        # REDUCES accessibility_risk. Road closure is a hard penalty.
        accessibility_risk = v.accessibility_risk * (1 - adjustments.road_accessibility_delta_pct / 100)
        if adjustments.road_closure:
            accessibility_risk = max(accessibility_risk, 85)

        adjusted.append(
            v.model_copy(
                update={
                    "hazard_severity": clamp(hazard),
                    "population_exposure": clamp(population_exposure),
                    "accessibility_risk": clamp(accessibility_risk),
                }
            )
        )
    return adjusted


def run_full_pipeline(
    villages: list[VillageInput], safe_zones: list[SafeZoneInput]
) -> tuple[list[VillageResult], CapacityLedger, RiskSummary]:
    # Step 1: risk + vulnerability for every village (independent of priority order)
    scored = []
    for v in villages:
        risk_score, risk_level, explanation, breakdown = calculate_risk(v)
        vulnerability = calculate_vulnerability(risk_score, v)
        relocation_needed = people_requiring_relocation(v, risk_score)
        scored.append((v, risk_score, risk_level, explanation, breakdown, vulnerability, relocation_needed))

    total_capacity = total_safe_capacity(safe_zones)

    # Step 2: capacity deficit score per village (used as a priority input),
    # computed against total district-wide capacity before allocation.
    prioritized = []
    for v, risk_score, risk_level, explanation, breakdown, vulnerability, relocation_needed in scored:
        capacity_deficit = calculate_capacity_gap(relocation_needed, total_capacity)
        capacity_deficit_score = min((capacity_deficit / max(v.population, 1)) * 100, 100)
        priority = calculate_relocation_priority(risk_score, vulnerability, v, capacity_deficit_score)
        prioritized.append(
            {
                "village": v,
                "risk_score": risk_score,
                "risk_level": risk_level,
                "explanation": explanation,
                "breakdown": breakdown,
                "vulnerability": vulnerability,
                "relocation_needed": relocation_needed,
                "priority": priority,
            }
        )

    # Step 3: allocate safe-zone capacity in priority order (highest priority
    # villages get first claim on the best-fitting shelters).
    prioritized.sort(key=lambda r: r["priority"], reverse=True)
    ledger = CapacityLedger(safe_zones)

    results: list[VillageResult] = []
    for rank, r in enumerate(prioritized, start=1):
        v = r["village"]
        recommended_id = None
        recommended_name = None

        if r["relocation_needed"] > 0:
            ranked = rank_destinations(v, safe_zones, ledger, r["relocation_needed"])
            if ranked:
                best = ranked[0]
                recommended_id = best.safe_zone_id
                recommended_name = best.safe_zone_name
                allocation = min(r["relocation_needed"], best.available_capacity) if best.available_capacity > 0 else 0
                if allocation > 0:
                    ledger.allocate(best.safe_zone_id, allocation)

        results.append(
            VillageResult(
                id=v.id,
                name=v.name,
                latitude=v.latitude,
                longitude=v.longitude,
                population=v.population,
                risk_score=r["risk_score"],
                risk_level=r["risk_level"],
                vulnerability_score=r["vulnerability"],
                relocation_required=r["relocation_needed"] > 0,
                people_requiring_relocation=r["relocation_needed"],
                relocation_priority_score=r["priority"],
                relocation_priority_rank=rank,
                risk_breakdown=r["breakdown"],
                explanation=r["explanation"],
                recommended_safe_zone_id=recommended_id,
                recommended_safe_zone_name=recommended_name,
            )
        )

    # restore original dataset order for display purposes, priority rank is preserved on each record
    results.sort(key=lambda res: res.id)

    high_or_critical = sum(1 for r in results if r.risk_level in ("HIGH", "CRITICAL"))
    population_at_risk = sum(r.population for r in results if r.risk_level in ("HIGH", "CRITICAL"))
    relocation_population = sum(r.people_requiring_relocation for r in results)
    capacity_gap = calculate_capacity_gap(relocation_population, total_capacity)

    distribution = {"SAFE": 0, "MODERATE": 0, "HIGH": 0, "CRITICAL": 0}
    for r in results:
        distribution[r.risk_level] += 1

    summary = RiskSummary(
        total_habitations=len(results),
        high_or_critical=high_or_critical,
        population_at_risk=population_at_risk,
        relocation_required_population=relocation_population,
        available_safe_capacity=total_capacity,
        capacity_gap=capacity_gap,
        risk_distribution=distribution,
    )

    return results, ledger, summary


def run_scenario(
    base_villages: list[VillageInput],
    safe_zones: list[SafeZoneInput],
    adjustments: ScenarioAdjustments,
) -> ScenarioResult:
    before_results, _, before_summary = run_full_pipeline(base_villages, safe_zones)

    adjusted_villages = apply_adjustments(base_villages, adjustments)
    after_results, after_ledger, after_summary = run_full_pipeline(adjusted_villages, safe_zones)

    comparison = ScenarioComparison(
        before_high_risk=sum(1 for r in before_results if r.risk_level == "HIGH"),
        before_critical=sum(1 for r in before_results if r.risk_level == "CRITICAL"),
        before_population_at_risk=before_summary.population_at_risk,
        after_high_risk=sum(1 for r in after_results if r.risk_level == "HIGH"),
        after_critical=sum(1 for r in after_results if r.risk_level == "CRITICAL"),
        after_population_at_risk=after_summary.population_at_risk,
        additional_population_at_risk=after_summary.population_at_risk - before_summary.population_at_risk,
    )

    return ScenarioResult(
        villages=after_results,
        safe_zones=after_ledger.as_results(),
        risk_summary=after_summary,
        comparison=comparison,
    )
