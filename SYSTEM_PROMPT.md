# SafeLink-AI — System Prompt

## Project Overview

SafeLink-AI is a **decision-support prototype** for disaster management (SIH26191). It identifies hazard-based red zones, assesses carrying capacity, and determines immediate relocation needs for vulnerable habitations in the Kedarnath region. This is a prototype — all data is fictional/sample unless explicitly documented. No live government or satellite feeds are integrated.

**Access model (RBAC):**
- **PUBLIC (no account):** Villages, risk summary, scenario what-ifs, SOS submission, advisories, health
- **AUTHORITY (JWT):** SOS report detail/status updates, adjudication, account creation (ADMIN only), ingestion, learning-engine status, real events
- **Civilians never need an account.** Every mutating endpoint is protected.

## Architecture

```
SafeZone-AI/
├── backend/                  # Python FastAPI server
│   ├── app/
│   │   ├── main.py           # FastAPI app entrypoint, all routes
│   │   ├── db.py             # PostgreSQL connection (psycopg2), schema, init
│   │   ├── auth.py           # JWT auth, RBAC, bcrypt passwords, rate limiting
│   │   ├── auth_hashes.py    # Demo user seeding (bcrypt)
│   │   ├── roles.py          # Role enum (ADMIN, OFFICIAL, VOLUNTEER), hierarchy
│   │   ├── models.py         # Pydantic models for all API requests/responses
│   │   ├── sos_engine.py     # SOS report queue, priority scoring, mesh
│   │   ├── risk_engine.py    # Risk score calculation per village
│   │   ├── capacity_engine.py# Shelter capacity ledger
│   │   ├── relocation_engine.py # Destination ranking for evacuations
│   │   ├── scenario_engine.py# What-if simulation pipeline
│   │   ├── reasoning_engine.py # Advisory generation (machine proposes)
│   │   ├── ground_reality_engine.py # Ground truth vs prediction
│   │   ├── learning_engine.py # Adaptive risk weight learning
│   │   ├── red_zone_ingestion.py # CSV/JSON ingestion for red zones
│   │   ├── data_loader.py    # Load villages/safe zones from DB
│   │   └── data/             # CSV/JSON fixture data
│   ├── scripts/ingest_data.py# One-time data ingestion script
│   ├── requirements.txt
│   └── tests/
├── frontend/                 # React 19 + Vite + Tailwind
│   ├── src/
│   │   ├── App.tsx           # Routes: /, /login, /register, /authority
│   │   ├── auth/             # AuthContext, LoginPage, RegisterPage, ProtectedRoute
│   │   ├── components/       # All UI components
│   │   │   ├── PublicView.tsx       # Civilian landing page (map, SOS, advisories)
│   │   │   ├── Dashboard.tsx        # Authority dashboard (risk, SOS mgmt, etc.)
│   │   │   ├── AppDashboard.tsx     # Data-loading wrapper for Dashboard
│   │   │   ├── SOSReportForm.tsx    # One-tap SOS (geolocation → auto-send)
│   │   │   ├── SOSPanel.tsx         # Authority: view/manage incoming SOS
│   │   │   ├── RiskMap.tsx          # Leaflet map with village markers
│   │   │   └── ... (see src/components/)
│   │   ├── services/
│   │   │   ├── api.ts        # Axios client, all API calls
│   │   │   └── offlineCache.ts # IndexedDB cache for offline support
│   │   ├── hooks/useWebSocket.ts # Real-time SOS alert stream
│   │   ├── types.ts          # TypeScript interfaces
│   │   └── utils.ts          # Shared utilities (riskColor, fmtNumber)
│   ├── public/sw.js          # Service worker for offline support
│   └── vite.config.ts        # Vite config with API proxy
├── .env.example              # Environment variable template
├── render.yaml               # Render.com deployment config
└── README.md
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 5, Tailwind CSS, React Router DOM, Axios, Leaflet |
| Backend | Python 3.11+, FastAPI 0.115, Pydantic 2.x, Uvicorn |
| Database | PostgreSQL 18, psycopg2-binary 2.9.13 |
| Auth | JWT (PyJWT), bcrypt |
| Offline | Service Worker (stale-while-revalidate), IndexedDB (via `idb`) |
| Deployment | Render.com (backend), Vercel (frontend) |

## Running the Project

### Backend (port 8000)
```bash
export DATABASE_URL=postgresql://postgres@localhost:5432/safelink
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Data ingestion (one-time)
```bash
cd backend
python -m scripts.ingest_data
```

### Frontend (port 3000)
```bash
cd frontend
npm install
npm run dev
```

Vite proxies `/api` and `/ws` to `http://127.0.0.1:8000` automatically.

## Key API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | None | Health check |
| GET | `/api/villages` | None | All villages with risk scores |
| GET | `/api/safe-zones` | None | Shelter capacity data |
| GET | `/api/risk-summary` | None | District-level risk summary |
| GET | `/api/relocation-priority` | None | Villages sorted by evacuation need |
| GET | `/api/recommendation/{id}` | None | Destination recommendation for a village |
| POST | `/api/scenario` | None | What-if simulation |
| GET | `/api/advisory` | None | Machine-generated advisories |
| POST | `/api/sos/submit` | None | Civilian SOS (one-tap geolocation) |
| GET | `/api/sos/reports` | JWT | Authority: view all SOS reports |
| PATCH | `/api/sos/reports/{id}` | JWT (OFFICIAL+) | Update SOS status |
| POST | `/api/sos/adjudicate` | JWT (OFFICIAL+) | Close out SOS with outcome |
| POST | `/api/satellite/transmit` | None | Simulated phone -> BLE -> Satcom terminal -> Satellite uplink |
| GET | `/api/satellite/status` | None | Satellite constellation & link health metrics |
| GET | `/api/satellite/terminals` | None | List deployed virtual Satcom Terminals |
| POST | `/api/satellite/terminal/pair` | None | Simulate BLE handshake with terminal |
| POST | `/api/satellite/downlink/broadcast` | JWT (OFFICIAL+) | Authority satellite advisory broadcast |
| GET | `/api/satellite/downlink/messages` | None | Fetch satellite downlink messages |
| POST | `/api/auth/login` | None | Email + password login |
| POST | `/api/auth/pin-login` | None | Fast-access PIN login |
| POST | `/api/auth/register` | JWT (ADMIN) | Create authority account |
| GET | `/api/auth/users` | JWT (ADMIN) | List all authority accounts |
| GET | `/api/learning` | JWT (OFFICIAL+) | Adaptive model state |

## RBAC Roles

| Role | Label | Access |
|------|-------|--------|
| `ADMIN` | District Admin | Full access: create accounts, manage all SOS, all endpoints |
| `OFFICIAL` | Relief Official | SOS management, adjudication, learning engine, advisories |
| `VOLUNTEER` | Field Volunteer | Limited: mesh node registration, packet queueing |

**Civilians have no account.** The public stream (map, SOS submission, advisories) requires no login.

## Database Schema (PostgreSQL)

Tables: `users`, `sos_reports`, `adjudications`, `model_state`, `events`, `auth_attempts`, `villages`, `safe_zones`, `mesh_nodes`, `mesh_packets`

- `users` — authority accounts with bcrypt password hashes and optional PIN hashes
- `sos_reports` — civilian-submitted emergency reports with GPS coordinates
- `villages` / `safe_zones` — ingested from CSV/JSON fixtures
- `model_state` — adaptive risk weights stored as JSON
- `auth_attempts` — rate limiting (5 failures → 15 min lockout)

## Design Conventions

- **Backend:** All DB queries use `psycopg2` with `DictCursor`. Placeholders are `%s` (not `?`). Use `INSERT ... ON CONFLICT DO UPDATE` for upserts. Never use `conn.execute()` — always `conn.cursor().execute()`.
- **Frontend:** Components use functional React with hooks. Styling is Tailwind CSS with a custom dark theme. The `api.ts` client handles auth tokens via Axios interceptors. Offline support uses IndexedDB with `fetchWithFallback` pattern.
- **SOS flow:** The one-tap SOS button (civilian only) uses browser geolocation, auto-detects nearest village via haversine distance, and sends the report with severity=5. Officials see incoming reports in `SOSPanel` — they never send SOS themselves.
- **Auth:** JWT tokens are stored in `localStorage` as `safezone_token`. The `ProtectedRoute` component accepts `requiredRole` as a string or array of strings. Passwords are bcrypt-hashed with 12 rounds.

## Environment Variables

```bash
# Required
DATABASE_URL=postgresql://postgres@localhost:5432/safelink

# Optional
SAFEZONE_DEMO_MODE=0          # 1 = use bundled JSON data, skip DB
SAFEZONE_JWT_SECRET=<secret>  # auto-generated if not set
SAFEZONE_JWT_EXPIRY=604800    # 7 days default
SAFEZONE_SKIP_SEED=1          # skip demo user seeding
VITE_API_URL=                 # override API base URL (frontend)
```

## Deployment

- **Backend:** Render.com free tier. `render.yaml` defines a PostgreSQL database service and web service. Set `DATABASE_URL` as a linked env var.
- **Frontend:** Vercel. Static build from `npm run build`. Set `VITE_API_URL` to the Render backend URL.

## Common Pitfalls

1. **Blank `/authority` page:** The `/authority` route requires `['ADMIN', 'OFFICIAL']` roles. If an OFFICIAL sees a blank page, check `ProtectedRoute` role check.
2. **SOS form cached in browser:** The service worker caches JS bundles. After code changes, bump the cache version in `public/sw.js` and hard-refresh (Ctrl+Shift+R).
3. **`psycopg2` `CREATE DATABASE` error:** Cannot run inside a transaction. Use `conn.autocommit = True` before `CREATE DATABASE`.
4. **`DictCursor` placeholder issues:** psycopg2 with `DictCursor` still uses `%s` placeholders. Ensure placeholder count matches value tuple length.
5. **`bool` to PostgreSQL:** Convert Python `bool` to `int` (0/1) for PostgreSQL INTEGER columns explicitly.
