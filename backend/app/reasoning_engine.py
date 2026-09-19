"""
Reasoning Engine (advisory)
==========================

Turns engine outputs + live field data into a human-readable ADVISORY for
authorities. Deliberately structured so that the machine proposes and the
authority decides:

  * output is always phrased as a recommendation with a confidence value,
  * every recommendation carries evidence it can be traced back to,
  * `verdict` is always "AUTHORITY" - the platform never issues the final
    call on evacuation or relocation.
"""

from .learning_engine import model_confidence as model_confidence

# Action ladder (least to most severe)
NO_ACTION = "NO_ACTION"
MONITOR = "MONITOR"
REVIEW_EVACUATION = "REVIEW_EVACUATION"
PREFERENTIAL_RELOCATION = "PREFERENTIAL_RELOCATION"

ACTION_LABELS = {
    NO_ACTION: "No action required",
    MONITOR: "Monitor closely",
    REVIEW_EVACUATION: "Review / prepare evacuation",
    PREFERENTIAL_RELOCATION: "Prioritise relocation assessment",
}


def _pick_action(risk_level: str, operational_priority: str, active_sos: int, medical: int) -> str:
    if risk_level == "CRITICAL":
        return PREFERENTIAL_RELOCATION
    if risk_level == "HIGH":
        if operational_priority in ("IMMEDIATE", "URGENT") or active_sos >= 3 or medical >= 1:
            return REVIEW_EVACUATION
        return MONITOR
    if risk_level == "MODERATE":
        if operational_priority in ("IMMEDIATE", "URGENT") or medical >= 1:
            return REVIEW_EVACUATION
        return MONITOR
    return NO_ACTION


def _evidence_items(village_result, ground, active_sos: int, medical: int) -> list[str]:
    evidence = []
    evidence.extend(str(e) for e in (village_result.explanation or [])[:4])
    if ground:
        evidence.append(
            f"Ground reality score {ground.get('ground_reality_score')} "
            f"({ground.get('operational_priority')}) combines model risk with live field reports."
        )
    if active_sos:
        evidence.append(f"{active_sos} active SOS reports on record for this habitation.")
    if medical:
        evidence.append(f"{medical} confirmed medical emergency/emergencies among active reports.")
    return evidence


def build_advisory(
    village_result,
    ground=None,
    active_sos: int = 0,
    medical: int = 0,
    confidence: float = None,
    proposed_relocation=None,
) -> dict:
    """
    Returns a decision-support advisory dict. `village_result` is a
    VillageResult-like object (pydantic or dict with the expected keys).
    """
    risk_level = getattr(village_result, "risk_level", None) or (
        village_result.get("risk_level") if isinstance(village_result, dict) else "MODERATE"
    )
    op_prio = "LOW"
    if ground:
        op_prio = ground.get("operational_priority") if isinstance(ground, dict) else getattr(ground, "operational_priority", "LOW")
    action = _pick_action(risk_level, op_prio, active_sos, medical)
    evidence = _evidence_items(village_result, ground, active_sos, medical)
    conf = confidence if confidence is not None else model_confidence()

    reasoning = (
        f"{getattr(village_result, 'name', '') or village_result.get('name', '')} is flagged as "
        f"{risk_level} risk by the analytical model. Based on this model and "
        f"{active_sos} active field report(s), the platform proposes: {ACTION_LABELS[action].lower()}."
    )

    return {
        "village_id": getattr(village_result, "id", None) or village_result.get("id"),
        "village_name": getattr(village_result, "name", None) or village_result.get("name"),
        "recommended_action": action,
        "recommended_action_label": ACTION_LABELS[action],
        "confidence": conf,
        "evidence": evidence,
        "reasoning": reasoning,
        "caveats": [
            "Risk factors are estimated from available geospatial and census-derived inputs, not ground-truth surveys.",
            "Confidence reflects the volume of observations seen so far; a low-confidence recommendation should be verified in the field.",
            "Road conditions and shelter availability can change within hours.",
        ],
        "proposed_relocation": proposed_relocation,
        "verdict": "AUTHORITY",
        "verdict_note": (
            "This is a decision-support recommendation only. The final decision on "
            "evacuation, relocation or shelter assignment rests with authorized officials."
        ),
    }


def district_advisory(result_summary: dict, relocations: list) -> dict:
    """High-level advisory for the whole district (authority dashboard)."""
    n = result_summary.get("total_habitations", 0)
    critical = result_summary.get("risk_distribution", {}).get("CRITICAL", 0)
    high = result_summary.get("risk_distribution", {}).get("HIGH", 0)
    gap = result_summary.get("capacity_gap", 0)
    pop_at_risk = result_summary.get("population_at_risk", 0)

    if critical >= 1 or gap > 0:
        action = "REVIEW_EVACUATION"
        label = "Prepare evacuation & protect capacity"
    elif high >= 1:
        action = "MONITOR"
        label = "Monitor high-risk habitations"
    else:
        action = "NO_ACTION"
        label = "Continue routine monitoring"

    evidence = [
        f"{n} habitations assessed; {critical} critical and {high} high risk.",
        f"~{pop_at_risk:,} residents estimated in high/critical habitations.",
    ]
    if gap > 0:
        evidence.append(
            f"Current safe-zone capacity is short by ~{gap:,} places - shelter expansion or "
            "alternative staging should be reviewed by officials."
        )

    return {
        "recommended_action": action,
        "recommended_action_label": label,
        "confidence": model_confidence(),
        "evidence": evidence,
        "verdict": "AUTHORITY",
        "verdict_note": (
            "District-level advisory only. Officials make the final operational decisions."
        ),
    }