"""
Loads demo/sample datasets from disk.

This is intentionally the ONLY place that knows about the on-disk JSON
format. Swapping in PostgreSQL/PostGIS or a real government dataset later
only requires changing this module - every engine below consumes plain
VillageInput / SafeZoneInput objects and doesn't care where they came from.
"""

import json
from pathlib import Path

from .models import VillageInput, SafeZoneInput

DATA_DIR = Path(__file__).parent / "data"


def load_villages() -> list[VillageInput]:
    with open(DATA_DIR / "villages.json", "r", encoding="utf-8") as f:
        raw = json.load(f)
    return [VillageInput(**item) for item in raw]


def load_safe_zones() -> list[SafeZoneInput]:
    with open(DATA_DIR / "safe_zones.json", "r", encoding="utf-8") as f:
        raw = json.load(f)
    return [SafeZoneInput(**item) for item in raw]
