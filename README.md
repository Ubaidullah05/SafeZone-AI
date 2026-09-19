# SafeLink-AI

**SIH26191** — Intelligent Identification of Hazard-Based Red Zones, Carrying Capacity Assessment, and Immediate Relocation Needs for Vulnerable Habitations.

> A hackathon decision-support prototype. All data is demo/sample data for a fictional-but-geographically-consistent pilot district unless stated otherwise.

## Quick start

**You need:** Node.js ≥ 18.18 and Python 3.11+.

### 1. Start the backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate                       # Windows (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --reload
```
Server runs at **http://127.0.0.1:8000** (Swagger docs at `/docs`). The SQLite DB is seeded on first run unless `SAFEZONE_SKIP_SEED=1`.

### 2. Start the frontend
```bash
cd frontend
npm install
npm run dev
```
Runs at **http://127.0.0.1:3000**. Vite proxies `/api` and `/ws` to the backend automatically (see `vite.config.ts`). Override with `BACKEND_URL=http://other-host:port npm run dev`. The frontend can also point directly at the API by setting `VITE_API_URL` in `frontend/.env` (see `.env.example`).

### 3. Verify the connection
```bash
curl http://127.0.0.1:3000/api/health
# → {"status":"ok","service":"SafeLink - AI backend","mode":"demo-data",...}
```

### 4. Run the tests
```bash
backend\.venv\Scripts\python.exe -m pytest tests -q
```

## Demo credentials

| Email | Password | PIN | Role |
|---|---|---|---|
| `admin@safezone.gov` | `Safezone@123` | `1234` | ADMIN |
| `official@safezone.gov` | `Safezone@123` | `1234` | OFFICIAL |
| `volunteer@safezone.gov` | `Safezone@123` | — | VOLUNTEER |
| `rethikas2782@gmail.com` | `1234` | — | ADMIN |

## How to use the app

1. Open the dashboard — KPI cards and the risk map load from calculated sample data.
2. Click a **CRITICAL** habitation on the map or in the list.
3. Review its risk score, factor breakdown, and the auto-generated **WHAT / WHY / ACTION** explanation.
4. Click **Find Best Safe Zone** to see the recommended destination and the reasoning behind it.
5. Switch to the **What-If** tab, load the demo scenario (or drag the sliders), and click **Run Scenario** to see before/after comparison.

## What the app does

- **Risk engine** — weighted score (hazard, slope, exposure, accessibility, facilities, history) classifies every habitation as SAFE / MODERATE / HIGH / CRITICAL.
- **Capacity engine** — tracks safe-zone allocation so the district-wide capacity gap is always accurate.
- **Relocation engine** — ranks villages by priority and scores each destination (safety, capacity, road, distance, medical).
- **Scenario simulator** — drag hazard / rainfall / population / road sliders and re-run the whole pipeline live.
- **Ground Reality** — blends predicted risk with live citizen SOS reports.
- **SOS workflow** — NEW → ACKNOWLEDGED → IN_PROGRESS → RESOLVED, with priority scoring and official adjudication.
- **Operational priority** — day-of-response ordering once ground truth is factored in.
- **Learning engine** — observational feedback tunes engine weight shares.
- **Validation / backtest** — red-zone plausibility checks and a Kedarnath-2013-style backtest.
- **Real-time** — WebSocket `/ws/alerts` pushes new SOS/alerts to the dashboard.
- **PWA + demo fallback** — offline-capable service worker, IndexedDB persistence, and a bundled demo-data mode.

## Tech stack

**Frontend:** Vite, React 19, TypeScript, Tailwind CSS, React-Leaflet 5, Framer Motion, Lucide React, Axios, `react-router-dom`, `idb` (IndexedDB), PWA service worker.

**Backend:** Python, FastAPI, Pydantic, Uvicorn, PyJWT, bcrypt, SQLite (`sqlite3` stdlib), WebSockets.

**Data:** JSON sample data + SQLite; accepts CSV (census) and GeoJSON (hazard layers) inputs so real datasets can be swapped in.

## Environment variables

| Variable | Where | Purpose | Default |
|---|---|---|---|
| `SAFEZONE_DB_PATH` | Backend | SQLite database path | `app/data/safelink.db` |
| `SAFEZONE_JWT_SECRET` | Backend | JWT signing secret | auto-generated → `app/data/.jwt_secret` |
| `SAFEZONE_SKIP_SEED` | Backend | Skip demo user seeding | unset |
| `BACKEND_URL` | Frontend | Proxy target | `http://127.0.0.1:8000` |
| `PORT` | Frontend | App port | `3000` |
| `VITE_API_URL` | Frontend | Direct API override (bypasses Vite proxy) | `''` |
| `NEXT_PUBLIC_API_URL` | Frontend | Deprecated — use `VITE_API_URL` | `''` |

## Assumptions & known limitations

- Travel time uses straight-line haversine distance at ~30 km/h — not a real routing engine.
- Village/safe-zone names are illustrative, not an official real-world location.
- "People requiring relocation" is a modeled fraction, not a census figure.
- Capacity allocation is greedy-by-priority in a single pipeline run.
- No live government, satellite, or IoT feeds are connected.
