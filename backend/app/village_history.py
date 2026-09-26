"""
Per-village historical memory
=============================

The global learning engine answers "which factors matter, overall?". This
module answers the local question: "what has actually happened in THIS village,
and how much of its risk should that carry?"

The rule
--------
    derived = max(static historical_event_risk, decay-weighted event evidence)

A village with a documented history of severe events gets a higher
`historical_event_risk` than its static inputs suggest. A village with no
recorded history is never *penalised* - it simply keeps its static value,
because absence of records is not evidence of absence of hazard. This is why
the combination is `max()` and not a replacement.

Recency
-------
Old events matter less. Severity is decayed with a 10-year half-life, so an
event from 1990 contributes roughly 1/32 of a recent one. The half-life was
chosen deliberately: long enough that a village's real repeat-hazard pattern
survives, short enough that a one-off 2013 event does not dominate a forecast
today.

Provenance
----------
Every contribution is reported with the `documented` / `derived` label it
carried. The `provenance_breakdown` field is the authoritative count, so a
panel cannot accidentally present derived scenarios as real history.
"""

import math
import time

from . import db

# Chosen with the user: 10-year half-life.
HALF_LIFE_YEARS = 10.0
# Weight added to historical_event_risk by one full-severity (5/5) recent event.
# Calibrated against the static `historical_event_risk` range in villages.json
# (8-85): a village needs roughly three severe recent events to overtake a
# high static value, so a single report can never dominate on its own.
PER_EVENT_MASS = 20.0
CEILING = 100.0


def _parse_date(value: str | None) -> float | None:
    """Return a POSIX timestamp for YYYY-MM-DD / ISO strings, else None."""
    if not value:
        return None
    head = str(value).strip()[:10]
    for fmt in ("%Y-%m-%d", "%Y-%m", "%Y"):
        try:
            return time.mktime(time.strptime(head, fmt))
        except ValueError:
            continue
    return None


def _decay(event_date: str | None, now: float | None = None) -> float:
    """0.0-1.0, halved every HALF_LIFE_YEARS. Undated events get 1.0."""
    ts = _parse_date(event_date)
    if ts is None:
        return 1.0
    now = now or time.time()
    years = max(0.0, (now - ts) / (365.25 * 24 * 3600))
    return math.pow(0.5, years / HALF_LIFE_YEARS)


def village_history(village_id: str, static_risk: float = 0.0) -> dict:
    """
    Recomputed history for one village.

    `static_risk` is the village's original `historical_event_risk` from
    villages.json, used as the floor.
    """
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, hazard_type, date, observed_severity, source, note, "
            "       factors_json, provenance "
            "FROM events WHERE village_id=%s ORDER BY date DESC",
            (village_id,),
        )
        rows = cur.fetchall()
    finally:
        conn.close()

    now = time.time()
    events = []
    total = 0.0
    documented = 0
    derived = 0

    for r in rows:
        severity = float(r["observed_severity"] or 0.0)
        d = _decay(r["date"], now)
        contribution = (severity / 5.0) * d * PER_EVENT_MASS
        total += contribution

        # Resolve the label ONCE and use it for both the per-event output and
        # the breakdown, so the two can never disagree. An unlabelled event
        # stays "unlabelled" rather than being silently promoted to
        # "documented", which would overstate the evidence.
        raw = (r["provenance"] or "").strip()
        prov = raw.lower()
        if prov.startswith("documented"):
            label = "documented"
            documented += 1
        elif prov.startswith("derived"):
            label = "derived"
            derived += 1
        else:
            label = "unlabelled"

        events.append(
            {
                "id": r["id"],
                "hazard_type": r["hazard_type"],
                "date": r["date"],
                "observed_severity": r["observed_severity"],
                "source": r["source"],
                "note": r["note"],
                "provenance": label,
                "provenance_raw": raw or None,
                "decay_weight": round(d, 4),
                "recency_contribution": round(contribution, 2),
            }
        )

    derived_risk = min(CEILING, total)
    effective = max(float(static_risk or 0.0), derived_risk)

    return {
        "village_id": village_id,
        "n_events": len(events),
        "static_historical_risk": round(float(static_risk or 0.0), 2),
        "derived_historical_risk": round(derived_risk, 2),
        "effective_historical_risk": round(effective, 2),
        "source_of_truth": (
            "recorded_events" if derived_risk > float(static_risk or 0.0) else "static_inputs"
        ),
        "half_life_years": HALF_LIFE_YEARS,
        "provenance_breakdown": {
            "documented": documented,
            "derived": derived,
            "unlabelled": len(events) - documented - derived,
        },
        "events": events,
    }
