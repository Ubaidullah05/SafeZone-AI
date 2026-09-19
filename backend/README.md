# SafeLink-AI Backend

FastAPI service implementing the risk, vulnerability, capacity, relocation, ground-reality, SOS and scenario-simulation engines described in the root README. Uses SQLite for persistence and JWT/PIN auth with roles.

## Run locally

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows     (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API docs (Swagger): http://127.0.0.1:8000/docs

### Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `SAFEZONE_DB_PATH` | Path to the SQLite database file | `app/data/safelink.db` |
| `SAFEZONE_JWT_SECRET` | Secret for signing JWTs | auto-generated and persisted to `app/data/.jwt_secret` |
| `SAFEZONE_SKIP_SEED` | Set to `1` to skip seeding the DB with demo users/reports on startup | unset |

## Tests

```bash
backend\.venv\Scripts\python.exe -m pytest tests -q
```

Suite: `tests/conftest.py` (per-test temp SQLite DB + login fixtures), `test_auth.py`, `test_risk_capacity.py`, `test_relocation_scenario.py`, `test_sos.py`, `test_learning.py`, `test_ingestion_backtest.py` — 54 tests.

## Module map

| File | Responsibility |
|---|---|
| `app/main.py` | FastAPI routes, CORS, `/ws/alerts` WebSocket, route wiring |
| `app/models.py` | Pydantic request/response models |
| `app/db.py` | SQLite init/schema/migrations, connection helper |
| `app/auth.py` | JWT issue/verify, `require_role` / user dependencies |
| `app/auth_hashes.py` | HMAC-hashed demo credentials used during seeding |
| `app/roles.py` | ADMIN / OFFICIAL / VOLUNTEER role constants |
| `app/data_loader.py` | Loads `app/data/*.json` sample data + census CSV / hazard GeoJSON inputs |
| `app/risk_engine.py` | Weighted risk score + risk level + factor breakdown |
| `app/reasoning_engine.py` | WHAT / WHY / ACTION explanations + district advisory |
| `app/relocation_engine.py` | Vulnerability, relocation priority, destination ranking |
| `app/capacity_engine.py` | Safe-zone capacity ledger + capacity gap |
| `app/scenario_engine.py` | What-if adjustments + full pipeline orchestration |
| `app/ground_reality_engine.py` | Blends predicted risk with live SOS intensity |
| `app/learning_engine.py` | Weight tuning from observed events |
| `app/sos_engine.py` | SOS CRUD, priority queue, aggregation, adjudication |
| `app/red_zone_ingestion.py` | Hazard GeoJSON → red zones into village risk feed |

## Data layer

- `app/data/villages.json`, `app/data/safe_zones.json` — demo village/shelter records.
- `app/data/inputs/` — `census_villages.csv` and hazard GeoJSON layers (`hazard_flood.geojson`, `hazard_landslide.geojson`) consumed by the ingestion path.
- `app/data/backtest/kedarnath_2013.json` — backtest fixture for `GET /api/validation/backtest`.
- SQLite (`SAFEZONE_DB_PATH`) holds users, SOS reports and observed events; seeded on first run unless `SAFEZONE_SKIP_SEED=1`.

All data is **demo/sample data** for a fictional-but-geographically-consistent pilot district.