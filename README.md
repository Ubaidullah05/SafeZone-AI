# SafeLink-AI

**SIH26191** — Intelligent Identification of Hazard-Based Red Zones, Carrying Capacity Assessment, and Immediate Relocation Needs for Vulnerable Habitations.

> A decision-support prototype for disaster management. Real data ingestion from CSV/JSON, with a demo mode fallback for offline development. Mobile-responsive UI.

## Quick start

**You need:** Node.js >= 18.18 and Python 3.11+.

### 1. Start PostgreSQL
Create a database `safelink` and set `DATABASE_URL`:
```bash
createdb safelink
export DATABASE_URL=postgresql://user:password@localhost:5432/safelink
```

### 2. Install backend dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 3. Start the backend
```bash
cd backend
python -m uvicorn app.main:app --reload
```
Server runs at **http://127.0.0.1:8000** (Swagger docs at `/docs`).

### 4. Ingest real data (one-time)
```bash
cd backend
python -m scripts.ingest_data
```
Populates the PostgreSQL DB with 12 real Kedarnath villages and 5 safe zones. Skip this step to run in demo mode.

### 5. Start the frontend
```bash
cd frontend
npm install
npm run dev
```
Runs at **http://127.0.0.1:3000**. Vite proxies `/api` and `/ws` to the backend automatically.

### 6. Verify the connection
```bash
curl http://127.0.0.1:8000/api/health
# {"status":"ok","mode":"real-data",...}
```

### 7. Run the tests
```bash
backend\.venv\Scripts\python.exe -m pytest tests -q
```

## Demo mode

Set `SAFEZONE_DEMO_MODE=1` to fall back to bundled JSON sample data:

```bash
SAFEZONE_DEMO_MODE=1 uvicorn app.main:app --reload
```

The frontend detects the mode via `/api/health` and shows a **DEMO MODE** badge when the backend is unreachable.

## Demo credentials

| Email | Password | PIN | Role |
|---|---|---|---|
| `admin@safezone.gov` | `Safezone@123` | `1234` | ADMIN |
| `official@safezone.gov` | `Safezone@123` | `1234` | OFFICIAL |
| `volunteer@safezone.gov` | `Safezone@123` | — | VOLUNTEER |

## How to use the app

1. **Public page** (`/`) — View the danger map, shelter locations, and latest emergency activity. Tap **Send SOS** to submit an emergency report.
2. **Dashboard** (`/authority`) — KPI cards, risk map, village details. Click a village to see its risk breakdown and recommended shelter.
3. **Emergency Calls** — View, filter, and adjudicate citizen SOS reports. Reports flow through NEW -> ACKNOWLEDGED -> IN_PROGRESS -> RESOLVED.
4. **What-If** — Drag hazard/rainfall/population/road sliders and click **See What Happens** to compare before/after scenarios.
5. **Evacuation** — See which villages should move first and the recommended shelter for each.

## Mobile support

The UI is fully responsive and works on mobile devices:

- **Sidebar** collapses to a hamburger menu with a slide-in drawer on mobile
- **SOS detail panels** open as bottom sheets on mobile
- **SOS form** slides up from the bottom like a native mobile form
- **Tables** convert to card-based lists on small screens
- **Toast notifications** appear at the bottom of the screen
- **Safe area** support for notched devices (iPhone, etc.)

## What the app does

- **Risk engine** — weighted score (hazard, slope, exposure, accessibility, facilities, history) classifies every habitation as SAFE / MODERATE / HIGH / CRITICAL.
- **Capacity engine** — tracks safe-zone allocation so the district-wide capacity gap is always accurate.
- **Relocation engine** — ranks villages by priority and scores each destination (safety, capacity, road, distance, medical).
- **Scenario simulator** — drag hazard / rainfall / population / road sliders and re-run the whole pipeline live.
- **Ground Reality** — blends predicted risk with live citizen SOS reports.
- **SOS workflow** — NEW -> ACKNOWLEDGED -> IN_PROGRESS -> RESOLVED, with priority scoring and official adjudication.
- **Operational priority** — day-of-response ordering once ground truth is factored in.
- **Learning engine** — observational feedback tunes engine weight shares.
- **Validation / backtest** — red-zone plausibility checks and a Kedarnath-2013-style backtest.
- **Real-time** — WebSocket `/ws/alerts` pushes new SOS/alerts to the dashboard.
- **Offline support** — IndexedDB caching, service worker, and automatic sync when reconnected.

## Data ingestion

Real village and shelter data is loaded from:

- `data/census_villages.csv` — 12 Kedarnath-area villages with coordinates, population, and vulnerability scores
- `data/safe_zones.json` — 5 safe zones with capacity, coordinates, and access info

Run the ingestion script to populate the database:
```bash
cd backend
python -m scripts.ingest_data
```

## Tech stack

**Frontend:** Vite, React 19, TypeScript, Tailwind CSS 3.4, React-Leaflet 5, Framer Motion, Lucide React, Axios, react-router-dom, idb (IndexedDB), PWA service worker.

**Backend:** Python, FastAPI, Pydantic, Uvicorn, PyJWT, bcrypt, PostgreSQL (psycopg2), WebSockets.

**Data:** PostgreSQL database populated from CSV/JSON; bundled JSON fallback for demo mode.

## Environment variables

| Variable | Where | Purpose | Default |
|---|---|---|---|
| `DATABASE_URL` | Backend | PostgreSQL connection string | `postgresql://postgres@localhost:5432/safelink` |
| `DB_HOST` | Backend | DB host | `localhost` |
| `DB_PORT` | Backend | DB port | `5432` |
| `DB_NAME` | Backend | DB name | `safelink` |
| `DB_USER` | Backend | DB user | `postgres` |
| `DB_PASSWORD` | Backend | DB password | `""` |
| `SAFEZONE_JWT_SECRET` | Backend | JWT signing secret | auto-generated |
| `SAFEZONE_SKIP_SEED` | Backend | Skip demo user seeding | unset |
| `SAFEZONE_DEMO_MODE` | Backend | Use JSON fallback data when DB is empty | `0` |
| `BACKEND_URL` | Frontend | Proxy target | `http://127.0.0.1:8000` |
| `PORT` | Frontend | App port | `3000` |
| `VITE_API_URL` | Frontend | Direct API override | `''` |

## Project structure

```
SafeZone-AI/
  backend/
    app/
      main.py              # FastAPI app, routes, WebSocket
      db.py                # PostgreSQL schema (psycopg2), villages/safe_zones tables
      data_loader.py       # DB-first loading with JSON fallback
      auth.py              # JWT auth, RBAC
      risk_engine.py       # Multi-factor risk scoring
      capacity_engine.py   # Shelter allocation
      relocation_engine.py # Destination ranking
      scenario_engine.py   # What-if simulation
      learning_engine.py   # Observational feedback
    scripts/
      ingest_data.py       # Populate DB from CSV/JSON
    data/                  # census_villages.csv, safe_zones.json
    tests/                 # pytest suite
    requirements.txt       # psycopg2-binary for PostgreSQL
  frontend/
    src/
      components/          # React components (Dashboard, SOS, Map, etc.)
      auth/                # Login, Register, AuthContext
      services/            # API client, offline cache
      hooks/               # WebSocket hook
      contexts/            # Theme context
    index.css              # Tailwind + CSS variables + theming
```

## Assumptions and limitations

- Travel time uses straight-line haversine distance at ~30 km/h, not a real routing engine.
- Village/safe-zone names are from the Kedarnath region but illustrative for the prototype.
- "People requiring relocation" is a modeled fraction, not a census figure.
- Capacity allocation is greedy-by-priority in a single pipeline run.
- No live government, satellite, or IoT feeds are connected.
