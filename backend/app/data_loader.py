"""
Loads village and safe-zone data.

Priority:
  1. SQLite database (real data, populated by ingest_data.py)
  2. JSON files on disk (demo mode, when SAFEZONE_DEMO_MODE=1)

This is intentionally the ONLY place that knows about data sources.
Swapping in PostgreSQL/PostGIS or a real government dataset later
only requires changing this module.
"""

import json
import os
from pathlib import Path

from .models import VillageInput, SafeZoneInput

DATA_DIR = Path(__file__).parent / "data"


def _is_demo_mode() -> bool:
    return os.environ.get("SAFEZONE_DEMO_MODE", "0") == "1"


def load_villages() -> list[VillageInput]:
    """Load villages from database (real mode) or JSON files (demo mode)."""
    if not _is_demo_mode():
        try:
            from . import db
            rows = db.get_villages_from_db()
            if rows:
                return [VillageInput(**{
                    "id": r["id"],
                    "name": r["name"],
                    "latitude": r["latitude"],
                    "longitude": r["longitude"],
                    "population": r["population"],
                    "hazard_severity": r["hazard_severity"],
                    "slope_risk": r["slope_risk"],
                    "population_exposure": r["population_exposure"],
                    "accessibility_risk": r["accessibility_risk"],
                    "facility_access_risk": r["facility_access_risk"],
                    "historical_event_risk": r["historical_event_risk"],
                }) for r in rows]
        except Exception:
            pass  # Fall through to JSON

    # Demo mode or DB empty: load from JSON
    with open(DATA_DIR / "villages.json", "r", encoding="utf-8") as f:
        raw = json.load(f)
    return [VillageInput(**item) for item in raw]


def load_safe_zones() -> list[SafeZoneInput]:
    """Load safe zones from database (real mode) or JSON files (demo mode)."""
    if not _is_demo_mode():
        try:
            from . import db
            rows = db.get_safe_zones_from_db()
            if rows:
                return [SafeZoneInput(**{
                    "id": r["id"],
                    "name": r["name"],
                    "latitude": r["latitude"],
                    "longitude": r["longitude"],
                    "capacity": r["capacity"],
                    "medical_access": r["medical_access"],
                    "safety_score": r["safety_score"],
                    "road_access_score": r["road_access_score"],
                }) for r in rows]
        except Exception:
            pass  # Fall through to JSON

    # Demo mode or DB empty: load from JSON
    with open(DATA_DIR / "safe_zones.json", "r", encoding="utf-8") as f:
        raw = json.load(f)
    return [SafeZoneInput(**item) for item in raw]
