# SafeLink-AI

**SIH26191 — Intelligent Identification of Hazard-Based Red Zones, Carrying Capacity Assessment, and Immediate Relocation Needs for Vulnerable Habitations**

> SafeLink-AI converts hazard maps into actionable relocation decisions.

This is a hackathon **decision-support prototype**, not an autonomous evacuation authority. All data is demo/sample data for a fictional-but-geographically-consistent pilot district (a hill state district with 12 habitations) unless explicitly stated otherwise.

## Problem

Disaster-prone regions often have hazard maps, but officials lack a fast way to translate "this area is hazardous" into "these specific communities need to be relocated, in this order, to these specific safe zones, and here is how much shelter capacity is missing." SIH26191 calls for a system that identifies hazard-based red zones, assesses whether nearby safe zones can absorb the affected population, and prioritizes relocation for the most vulnerable habitations first.

## Solution

SafeLink-AI implements a transparent, end-to-end pipeline:

```
Risk  →  Vulnerability  →  Capacity  →  Relocation
```

1. **Risk** — an explainable, weighted multi-factor score (hazard severity, slope, population exposure, accessibility, facility access, historical events) classifies every habitation as SAFE / MODERATE / HIGH / CRITICAL.
2. **Vulnerability** — combines risk with population-exposure and accessibility factors, because raw hazard alone doesn't capture how badly a community would be affected.
3. **Capacity** — every safe zone's real capacity is tracked as it's allocated to higher-priority villages first, so the district-wide **capacity gap** (population requiring relocation minus available safe capacity) is always accurate.
4. **Relocation** — a priority score ranks which habitation should be relocated first, and a destination-scoring model (safety + capacity + road access + distance + medical access — never distance alone) recommends the best feasible safe zone, with a plain-language explanation.

A **What-If Scenario Simulator** lets a user drag hazard severity / rainfall intensity / population exposure / road accessibility sliders (and toggle a road closure) and re-run the entire pipeline to see how risk, relocation needs, and capacity gaps change — live, on the map and in the KPI cards.

### Beyond the planning core

- **Ground Reality Engine** blends the predicted (model) risk with live citizen SOS reports so a village with an actual emergency outranks a village that merely scores high on paper.
- **SOS workflow** — citizen-reported emergencies (NEW → ACKNOWLEDGED → IN_PROGRESS → RESOLVED), severity/priority scoring, medical-emergency flagging, and official adjudication.
- **Operational priority** — the day-of-response ordering of villages once ground-truth and field constraints are factored in.
- **Learning engine** — observational feedback (events) adjusts engine weight shares so continued operation tunes the model.
- **Validation / backtest** — red-zone plausibility checks and a Kedarnath-2013-style backtest comparing model red zones against reported impact.
- **Auth with roles** — JWT + PIN login; ADMIN / OFFICIAL / VOLUNTEER roles with role-gated endpoints.
- **Reasoning / advisory** — per-village WHAT / WHY / ACTION explanations and district advisory bulletins.
- **Real-time** — a WebSocket channel (`/ws/alerts`) pushes new SOS/alerts to the dashboard.
- **PWA + demo fallback** — offline-capable service worker, IndexedDB persistence, and a bundled demo-data mode (`fallbackData.ts`) that clearly labels itself instead of silently pretending to be live.

## Tech Stack

**Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, React-Leaflet 5 / Leaflet, Framer Motion, Lucide React, `idb` (IndexedDB), custom Node proxy (`server.js`), PWA service worker

**Backend:** Python 3.13, FastAPI, Pydantic, Uvicorn, JWT auth, SQLite (via stdlib `sqlite3`), WebSockets

**Data processing:** NumPy, Pandas
**Data (MVP):** JSON sample data + SQLite; accepts CSV (census) and GeoJSON (hazard layers) inputs so real datasets can be swapped in without touching the engines.

## Architecture

```
             ┌─────────────────────────────────────────────┐
             │          Next.js frontend (:3000)            │
             │  Dashboard / RiskMap / Panels / Auth (JWT)    │
             │            custom server.js                   │
             │     proxies /api and /ws → backend            │
             └──────────────────────┬───────────────────────┘
                                    │ REST (fetch/axios) + WS
                                    ▼
             ┌─────────────────────────────────────────────┐
             │            FastAPI backend (:8000)           │
             │            app/main.py (routes)              │
             └───────┬──────────┬─────────┬─────────┬───────┘
                     ▼          ▼         ▼         ▼
              risk_engine  relocation  capacity  scenario_engine
              relocation_   engine     engine     (full pipeline
              engine +                                       )
              learning_     ground_    reasoning  sos_engine
              engine        reality    engine     + red_zone_
                            engine                ingestion
```

## Repository Layout

```
backend/
  app/
    main.py               FastAPI routes, WebSocket, CORS
    models.py             Pydantic request/response models
    db.py                 SQLite init/migrations (SAFEZONE_DB_PATH)
    auth.py               JWT issue/verify, role-gated dependencies
    auth_hashes.py        HMAC-hashed demo credentials
    roles.py              ADMIN / OFFICIAL / VOLUNTEER definitions
    data_loader.py        Loads villages/safe-zones JSON + CSV/GeoJSON inputs
    risk_engine.py        Weighted risk score, levels, factor breakdown
    reasoning_engine.py   WHAT / WHY / ACTION explanations + advisory
    relocation_engine.py  Vulnerability, priority ranking, destination scoring
    capacity_engine.py    Safe-zone capacity ledger + capacity gap
    scenario_engine.py    What-if adjustments + pipeline orchestration
    ground_reality_engine.py  Predicted risk × live SOS ground-truth blend
    learning_engine.py    Weight-tuning from observed events
    sos_engine.py         SOS CRUD, priority queue, aggregation, adjudication
    red_zone_ingestion.py Hazard GeoJSON → red zones → village risk feed
    data/                 Demo JSON, hazard GeoJSON/census inputs, backtest set
  tests/                  pytest suite (54 tests)
frontend/
  src/
    app/                  App Router: layout, providers, /login /register /authority
    auth/                 AuthContext, Login/Register pages, ProtectedRoute
    components/           Dashboard, RiskMap, panels (SOS, Ground Reality, …)
    services/api.ts       API client + demo (fallback) pipeline
    services/offlineCache.ts  IndexedDB store
    hooks/useWebSocket.ts WebSocket hook (fallback to polling)
    data/fallbackData.ts  Bundled demo data computed with the same formulas
  server.js               Express-less Node proxy: /api + /ws → backend
  public/                 sw.js service worker, manifest.json
```

## Running Locally

### Prerequisites

- Node.js ≥ 18 (WebSocket globals require ≥ 21 for some tooling)
- Python 3.11+
- Backend running on `:8000` for live features (demo fallback works without it)

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows     (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Runs at http://127.0.0.1:8000 — Swagger docs at `/docs`. The DB (`safelink.db`) is seeded on first run unless `SAFEZONE_SKIP_SEED=1`. `SAFEZONE_JWT_SECRET` overrides the auto-generated key.

Run the test suite:

```bash
backend\.venv\Scripts\python.exe -m pytest tests -q
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at http://127.0.0.1:3000. `server.js` proxies `/api` and `/ws` to `http://127.0.0.1:8000` by default — override with `BACKEND_URL=http://host:port npm run dev` (or `PORT=3001` to change the app port).

- `npm run build` — Next.js production build
- `npm run start` — production server
- `npm run typecheck` — `tsc --noEmit`

## Demo Credentials

| Email | Password | PIN | Role |
|---|---|---|---|
| `admin@safezone.gov` | `Safezone@123` | `1234` | ADMIN |
| `official@safezone.gov` | `Safezone@123` | `1234` | OFFICIAL |
| `volunteer@safezone.gov` | `Safezone@123` | — | VOLUNTEER |

## API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Service health check |
| POST | `/api/auth/register` | Create a user (role-gated) |
| POST | `/api/auth/login` | Email + password → JWT + user |
| POST | `/api/auth/pin-login` | Emergency PIN → JWT + user |
| GET | `/api/auth/me` | Current profile |
| GET | `/api/auth/users` | List users (ADMIN) |
| GET | `/api/villages` | All habitations with computed results |
| GET | `/api/villages/{id}` | Single habitation result + explanation |
| GET | `/api/safe-zones` | Safe zones with live capacity |
| GET | `/api/risk-summary` | District-wide KPI summary |
| GET | `/api/relocation-priority` | Ranked relocation queue |
| GET | `/api/recommendation/{village_id}` | Best safe-zone recommendation + why |
| POST | `/api/scenario` | What-if simulation → before/after |
| GET | `/api/advisory` | District advisory bulletins |
| GET | `/api/advisory/{village_id}` | Per-village advisory |
| GET | `/api/learning` | Current learned model weights |
| POST | `/api/sos/submit` | Submit an SOS report |
| GET | `/api/sos/reports` | SOS reports (filterable) |
| GET | `/api/sos/reports/{id}` | Single report |
| PATCH | `/api/sos/reports/{id}` | Update report status |
| POST | `/api/sos/adjudicate` | Official adjudication of a report |
| GET | `/api/sos/priority-queue` | Priority-ordered SOS queue |
| GET | `/api/sos/aggregate` | SOS aggregation for ground-reality |
| GET | `/api/sos/stats` | SOS statistics |
| GET | `/api/sos/latest` | Latest reports (polling) |
| GET | `/api/validation/red-zones` | Red-zone plausibility checks |
| GET | `/api/validation/backtest` | Kedarnath-2013 backtest |
| POST | `/api/validation/register-event` | Log an observed event (learning input) |
| GET | `/api/events` | Logged observational events |
| GET | `/api/offline-manifest` | Offline cache manifest for the PWA |
| GET | `/api/ground-reality` | Ground-reality scores (predicted × SOS) |
| GET | `/api/ground-reality/{village_id}` | Single-village ground reality |
| GET | `/api/operational-priority` | Field response ordering |
| WS | `/ws/alerts` | Real-time SOS / alert push |

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
- The MVP uses demo JSON/SQLite data; the input layer accepts census CSV and hazard GeoJSON, but no live government, satellite, or IoT feeds are connected.
```