# SafeLink - AI

**SIH26191 — Intelligent Identification of Hazard-Based Red Zones, Carrying Capacity Assessment, and Immediate Relocation Needs for Vulnerable Habitations**

> SafeLink - AI converts hazard maps into actionable relocation decisions.

This is a hackathon **decision-support prototype**, not an autonomous evacuation authority. All data shown is demo/sample data for a fictional-but-geographically-consistent pilot district unless explicitly stated otherwise.

## Problem

Disaster-prone regions often have hazard maps, but officials still lack a fast way to translate "this area is hazardous" into "these specific communities need to be relocated, in this order, to these specific safe zones, and here is how much shelter capacity is missing." SIH26191 calls for a system that identifies hazard-based red zones, assesses whether nearby safe zones can actually absorb the affected population, and prioritizes relocation for the most vulnerable habitations first.

## Solution

SafeLink - AI implements a transparent, end-to-end pipeline:

```
Risk  →  Vulnerability  →  Capacity  →  Relocation
```

1. **Risk** — an explainable, weighted multi-factor score (hazard severity, slope, population exposure, accessibility, facility access, historical events) classifies every habitation as SAFE / MODERATE / HIGH / CRITICAL.
2. **Vulnerability** — combines risk with population-exposure and accessibility factors, because raw hazard alone doesn't capture how badly a community would be affected.
3. **Capacity** — every safe zone's real capacity is tracked as it's allocated to higher-priority villages first, so the district-wide **capacity gap** (population requiring relocation minus available safe capacity) is always accurate.
4. **Relocation** — a priority score ranks which habitation should be relocated first, and a destination-scoring model (safety + capacity + road access + distance + medical access — never distance alone) recommends the best feasible safe zone, with a plain-language explanation.

A **What-If Scenario Simulator** lets a user drag hazard severity / rainfall intensity / population exposure / road accessibility sliders (and toggle a road closure) and re-run the entire pipeline to see how risk, relocation needs, and capacity gaps change — live, on the map and in the KPI cards.

## Features

- Interactive Leaflet risk map: hazard shading, habitation markers (colored by risk level), safe-zone markers, legend, click-to-inspect
- KPI dashboard: total habitations, high/critical count, population at risk, relocation required, available capacity, capacity gap
- Per-village risk breakdown with a bar chart of every contributing factor
- Auto-generated WHAT / WHY / ACTION explanation for every habitation
- "Find Best Safe Zone" recommendation engine with a "why was this recommended" checklist
- Relocation priority table ranking every habitation that needs relocation
- Safe-zone capacity panel showing live allocation/remaining capacity
- What-if scenario simulator with before/after comparison
- Graceful **Demo Data Mode**: if the backend is unreachable, the frontend falls back to bundled sample data (computed with the same formulas) and clearly labels itself as such — it never silently pretends to be live

## Tech Stack

**Frontend:** React, Vite, Tailwind CSS, React-Leaflet, Leaflet, Axios, Lucide React
**Backend:** Python, FastAPI, Pydantic, Uvicorn
**Data processing:** Pandas, NumPy, GeoPandas, Shapely
**Data (MVP):** JSON sample data, structured so PostgreSQL/PostGIS can be swapped in later without touching the engines

## Architecture

```
                     ┌─────────────────────────────┐
                     │        React Frontend        │
                     │  Dashboard / RiskMap / Panels │
                     └───────────────┬───────────────┘
                                     │ REST (axios)
                                     ▼
                     ┌─────────────────────────────┐
                     │         FastAPI Backend       │
                     │            main.py            │
                     └───────────────┬───────────────┘
                                     │
        ┌────────────────┬──────────┼──────────┬────────────────┐
        ▼                ▼          ▼          ▼                ▼
  risk_engine.py  relocation_    capacity_  scenario_       data_loader.py
  (Weighted Risk   engine.py     engine.py  engine.py       (villages.json,
   Model + ML hook) (Vulnerability,(Ledger + (What-if +      safe_zones.json)
                     Priority,     gap calc)  full pipeline
                     Destination              orchestration)
                     Scoring)
```

## Running Locally

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at http://127.0.0.1:5173 (falls back to bundled demo data automatically if the backend isn't running).

### Backend

```bash
cd backend
python -m venv .venv
```

Windows:

```bash
.venv\Scripts\activate
```

macOS/Linux:

```bash
source .venv/bin/activate
```

Then:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Runs at http://127.0.0.1:8000 (Swagger docs at `/docs`).

Copy `.env.example` to `frontend/.env` if you need to point the frontend at a non-default backend URL.

## API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Service health check |
| GET | `/api/villages` | All habitations with calculated risk/vulnerability/relocation results |
| GET | `/api/villages/{id}` | Single habitation's full result |
| GET | `/api/safe-zones` | All safe zones with live allocation/remaining capacity |
| GET | `/api/risk-summary` | District-wide KPI summary |
| GET | `/api/relocation-priority` | Habitations requiring relocation, ranked by priority |
| GET | `/api/recommendation/{village_id}` | Best safe-zone recommendation + explanation for one village |
| POST | `/api/scenario` | Runs the what-if simulator and returns before/after comparison |

## Demo Data

All habitation and safe-zone records in `backend/app/data/*.json` (and their mirror in `frontend/src/data/fallbackData.js`) are **prototype/demo data** for a fictional-but-geographically-consistent pilot district. No live government, satellite, or IoT feeds are integrated in this MVP — the architecture (see `data_loader.py` and the "Future Extensibility" notes in each engine) is intentionally structured so real datasets and PostgreSQL/PostGIS can replace the sample data later.

## Demo Flow

1. Open the dashboard — KPI cards and the risk map load from calculated sample data.
2. Click a CRITICAL habitation on the map or in the list.
3. Review its risk score, factor breakdown, and WHAT/WHY/ACTION explanation.
4. Click **Find Best Safe Zone** to see the recommended destination and why it was chosen.
5. Switch to the **What-If** tab, load the demo scenario (or drag the sliders yourself), and click **Run Scenario**.
6. Watch the map, KPI cards, and priority table update, and read the before/after comparison.

## Assumptions & Known Limitations

- Travel time is estimated from straight-line (haversine) distance at an assumed 30 km/h average road speed for a hilly pilot district — not a real routing engine.
- The pilot district's coordinates and village/safe-zone names are illustrative, not an official real-world location.
- "People requiring relocation" is estimated as a fraction of village population once risk crosses the HIGH threshold; it is a modeling assumption, not a census figure.
- Capacity allocation is greedy-by-priority within a single pipeline run; it does not model multi-day logistics or partial transfers across scenario runs.
- No authentication, database, or real-time feeds are implemented in the MVP, by design (see the system prompt's "Do Not Overengineer" constraints).
