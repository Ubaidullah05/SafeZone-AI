# SafeZone-AI

**SIH26191** — Intelligent Identification of Hazard-Based Red Zones, Carrying Capacity Assessment, and Immediate Relocation Needs for Vulnerable Habitations.

> A decision-support prototype for disaster management. Real data ingestion from CSV/JSON, with a demo mode fallback for offline development. Mobile-responsive UI.

**Built for when the network is gone.** Every existing Indian disaster system —
IMD, INCOIS, NDMA, state DRO portals — depends on cellular connectivity that
fails first in a major event. SafeZone-AI keeps working offline (verified), and
defines the protocol for getting messages out when even that is lost.

## Where this sits among existing systems

| System | Does | Does not |
|---|---|---|
| IMD / INCOIS warnings | Regional rainfall, flood, tsunami, GLOF alerts | Rank individual villages; allocate shelters; work offline |
| NDMA SADPR | Standardised disaster vocabulary | Any predictive scoring or evacuation logic |
| State DRO / SDRF portals | Shelter lists, relief tracking | Static data, no live model, no field reporting |
| Crowdsourced mapping (Ushahidi, Sahana) | Citizen reports | Fuse reports into relocation decisions |

SafeZone-AI's distinctive combination is **village-level risk ranking + shelter
allocation + live citizen reports + full offline operation**, and the satcom
protocol design for the case where all connectivity is gone. Blending citizen
SOS reports into an operational priority ordering is the piece most similar
tools do not attempt; the offline operation is what makes it usable during a
real event.

## Offline operation (verified)

The app keeps working when the backend is unreachable. This was tested with the
**server process confirmed dead** — not merely a browser offline toggle, which
does not govern service-worker fetches and produced two false passes during
development.

With the server down the app still:

- boots and renders (JS, CSS, icons and app shell served from Cache Storage)
- displays previously-loaded villages, shelters and risk scores
- returns cached API responses
- queues new SOS reports as `PENDING_SYNC` and sends them on reconnect

### Requirements and honest limits

| Requirement | Why |
|---|---|
| A **production build** is required — `npm run build && npm run preview` | The service worker is deliberately not registered in `npm run dev`, because a cached bundle hides your edits |
| `localhost` **or HTTPS** | Browsers refuse service workers on insecure origins, so `http://<LAN-IP>:3000` will not install one. Use `VITE_HTTPS=true` for a self-signed dev certificate, or test on `localhost` |
| Data must have been loaded while online | API calls are network-first; an endpoint never visited has nothing cached and returns a 503 page rather than stale data |

The two gaps worth knowing: the authority dashboard route and offline SOS
background-sync are implemented and cached correctly but have not been
separately verified with a dead server.

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
Runs at **http://127.0.0.1:3000** (and on your LAN - see below). Vite proxies `/api` and `/ws` to the backend automatically.

### 5b. Open it from a phone or tablet on the same Wi-Fi

`npm run dev` now prints a second **Network** URL, e.g. `http://192.168.1.20:3000`.
Open that on any device on the same network.

The backend does **not** need to be exposed. The Vite proxy runs on your
machine and forwards `/api` and `/ws` to `127.0.0.1:8000`, so the browser
only ever talks to your dev machine. To also reach the API docs directly
from a phone, start the backend with `--host 0.0.0.0` (this exposes the
API to your whole network, so only do it on a trusted network).

If the phone cannot connect: both devices must be on the same subnet (guest
Wi-Fi often isolates clients), and the Windows Firewall may need a rule for
Node.js on private networks.

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
- `100dvh` viewports instead of `100vh`, so content is not cut off by mobile browser chrome
- 16px minimum form controls, so iOS does not zoom on field input
- `prefers-reduced-motion` respected

Tested at 390x844 in a real browser. Full offline operation additionally needs
HTTPS or `localhost` — see [Offline operation](#offline-operation-verified).

## What the app does

- **Offline-first** — the app boots, renders cached data, and queues SOS reports for later sync with the backend unreachable. See [Offline operation](#offline-operation-verified).
- **Satcom backhaul protocol (ISRO DAT-SG / NavIC aligned)** — a designed burst protocol (`SZ1`) for getting a distress report out of a dead zone, with two-way downlink broadcast. The protocol, compression and link maths are implemented; the RF hop is modelled. See [What is real, and what is modelled](#what-is-real-and-what-is-modelled).
- **Risk engine** — weighted score (hazard, slope, exposure, accessibility, facilities, history) classifies every habitation as SAFE / MODERATE / HIGH / CRITICAL.
- **Capacity engine** — tracks safe-zone allocation so the district-wide capacity gap is always accurate.
- **Relocation engine** — ranks villages by priority and scores each destination (safety, capacity, road, distance, medical).
- **Scenario simulator** — drag hazard / rainfall / population / road sliders and re-run the whole pipeline live.
- **Ground Reality** — blends predicted risk with live citizen SOS reports into an operational priority ordering.
- **SOS workflow** — NEW -> ACKNOWLEDGED -> IN_PROGRESS -> RESOLVED, with priority scoring and official adjudication.
- **Operational priority** — day-of-response ordering once ground truth is factored in.
- **Learning engine** — reweights the six risk factors from how each factor co-varies with confirmed outcome severity. Learns from **adjudicated SOS reports** (live) and a **labelled historical corpus** (seeded at startup). Weights are *not* hand-set; see [How the model learns](#how-the-model-learns).
- **Real-time** — WebSocket `/ws/alerts` pushes new SOS/alerts to the dashboard.
- **Validation** — red-zone plausibility checks and a pipeline **replay** of a documented 2013 event (a validation fixture, not a training set).

## How the model learns

Risk scoring weights six factors. Rather than hard-coding how much each one
matters, the engine derives the weights from observed outcomes:

```
r    = Pearson(factor, observed_severity)     # does this factor predict bad outcomes?
mass = (1 + r)^2 + 0.5
w    = mass / sum(mass)                        # then blended toward the published prior
```

A factor that is **high but unrelated to outcomes earns nothing**. This replaced
an earlier additive update that could only ever *increase* a factor's weight, so
a consistently high-but-uninformative factor was reinforced instead of discounted.

Two properties matter more than the formula itself:

- **Provenance is never mixed.** Corpus events are tagged `documented` (the
  Kedarnath 2013 reconstruction) or `derived` (synthetic scenarios). Derived
  scenarios are never presented as historical records, and each records exactly
  how it was built.
- **Historical evidence never inflates live confidence.** Public confidence is
  computed from *live adjudications only*. Replaying the corpus re-weights the
  model but leaves the public confidence figure at 0% until officials confirm
  real outcomes. The historical figure is reported separately.

### Why the corpus is a "crossed design"

v1.0 built each scenario by blending a hazard zone into a village's own factor
values. That **could not work**, because the factors in `villages.json` are
almost perfectly correlated *with each other*:

| pair | r |
| --- | --- |
| hazard ↔ slope | +0.99 |
| accessibility ↔ facility | +0.99 |
| hazard ↔ historical | +0.97 |

Every risky village is risky in every dimension at once. When all factors move
together, **no choice of severities can reveal which one mattered** — so v1.0
scored road access at only r=0.14 despite building scenarios specifically for
it.

v2.0 draws all six factors **independently** and computes severity from a
declared causal model, so each factor becomes individually measurable.

| factor | r | learned weight | prior | role |
| --- | --- | --- | --- | --- |
| accessibility_risk | +0.60 | 0.223 | 0.15 | planted driver |
| facility_access_risk | +0.51 | 0.203 | 0.10 | planted driver |
| hazard_severity | +0.46 | 0.192 | 0.30 | planted driver |
| population_exposure | +0.16 | 0.135 | 0.15 | control |
| slope_risk | +0.14 | 0.131 | 0.20 | control |
| historical_event_risk | +0.05 | 0.117 | 0.10 | control |

The learned ranking (`access > facility > hazard`) **differs from the prior**
(`hazard > slope > population`). That is the point: it shows the engine learned
rather than echoed. All three declared drivers rank above all three controls.

Each event also records which factor was dominant *and* which control was
highest, separately. Narrative text is written only from a declared driver, so
a control can never be blamed for an outcome the model attributes to something
else — the corpus cannot quietly contradict its own stated model.

### The declared ground truth is an assumption, not a finding

`causal_weights` asserts that road access (0.42) and facility access (0.33)
matter more than raw hazard (0.25). **We chose that.** It is a defensible
assumption about hill-disaster response — in a blocked road or a distant
hospital, the hazard matters less than the response — but it is **not a
measured fact** about Uttarakhand.

So the corpus is a **self-test of the pipeline**, and the tests assert two
things:

1. the engine recovers the planted ranking, and
2. it reports near-zero correlation for the three *controls* that genuinely
   do not drive outcomes.

`test_engine_follows_whichever_truth_it_is_given` plants three *other*
rankings — including one where slope leads — and requires the engine to follow
each. Without that test, "it recovered our truth" would only prove it echoed
us.

**What this does not prove:** that road access causes disaster outcomes in
reality. That needs real incident data, which this project does not have.

Per-village history uses a **10-year half-life**, so a one-off 2013 event does
not dominate a forecast today. A village's effective historical risk is
`max(static, decay-weighted recorded events)` — a village is never *penalised*
for having no records, because absence of records is not absence of hazard.

| Endpoint | Access | Returns |
| --- | --- | --- |
| `GET /api/learning` | public | counts + confidence only (no weights) |
| `GET /api/learning/weights` | official | weights, correlations, prior |
| `GET /api/learning/corpus` | official | corpus counts + provenance note |
| `GET /api/villages/{id}/history` | official | that village's recency-weighted history |
| `POST /api/validation/seed-history` | official | idempotent re-seed |
| `POST /api/validation/reset-learning` | official | clear learned state, re-seed |

The public endpoint omits the weights on purpose: publishing which signals drive
the risk model would make it easy to game.

Rebuild the corpus after editing hazard layers:

```bash
cd backend && .\.venv\Scripts\python.exe -m scripts.build_event_corpus
```

Set `SAFEZONE_LEARNING_MODE=dirichlet` to restore the legacy additive behaviour
if you need to roll back.

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
| `SAFEZONE_CORS_ORIGINS` | Backend | Comma-separated frontend origins allowed to call the API | localhost dev ports |
| `VITE_API_URL` | Frontend | API origin for deployed builds | `''` |
| `VITE_HTTPS` | Frontend | Serve the dev/preview server over HTTPS (needed for PWA on a LAN IP) | `false` |
| `VITE_ENABLE_SW` | Frontend | Register the service worker in dev (off by default; conflicts with HMR) | `false` |
| `PORT` | Frontend | App port | `3000` |

## What is real, and what is modelled

Disaster technology is easy to overclaim, so this section is deliberately
explicit. No satellite licence, RF hardware, or live government feed is used
anywhere in this project.

| Implemented and testable | Modelled |
|---|---|
| `SZ1` burst packet codec and compression (650 B → 44 B, 93.2% reduction) | RF propagation and real C/N0 measurements |
| Orbital link budget, propagation delay, Doppler model | Bluetooth BLE pairing and terminal discovery |
| Terminal fleet state machine and pairing logic | An actual uplink to ISRO / GSAT-7R |
| Downlink advisory routing, ACK handling, delivery record | Ground-station receipt at INMCC |
| SOS ingestion into the risk pipeline, priority assignment | Terminal battery and fleet telemetry |
| CSV/GeoJSON hazard ingestion with provenance | Any live IMD / NDMA / satellite / IoT feed |

**In this build** the phone-to-backend hop is an ordinary HTTPS request, so no
licence is required and it runs on any laptop. In the field the same `SZ1`
protocol would ride a Satcom terminal. The engineering question the design
answers — *what do you send when you have very few bytes to spend?* — is
implemented, not simulated.

The Kedarnath 2013 fixture used for pipeline validation is likewise labelled in
its own `source` field: *"Illustrative reconstruction… NOT official
measurements."* It is a validation fixture, not a data feed.

## Deploying (Vercel frontend + Render backend)

The frontend and backend end up on **two different web addresses**, which
means two settings must be wired to each other. Get this wrong and the page
loads but shows no data.

The app calls the API at the relative path `/api/...`. Locally the Vite dev
server proxies that to `http://127.0.0.1:8000`. **A static host has no such
proxy**, so a deployed frontend must be told the backend's real address.

| # | Where | Variable | Value |
|---|---|---|---|
| 1 | Vercel → Project → Settings → Environment Variables | `VITE_API_URL` | `https://<your-backend>.onrender.com` |
| 2 | Render → Service → Environment | `SAFEZONE_CORS_ORIGINS` | `https://<your-frontend>.vercel.app` |

`render.yaml` already declares `SAFEZONE_CORS_ORIGINS` with `sync: false`, so
Render will prompt you for the value on the next deploy. It only accepts
exact origins, with no trailing slash and no path.

The two settings are a pair: **#1 gets the request to the backend, #2 lets
the browser accept the reply.** Setting only one leaves a broken app:

- Only #1 → requests arrive, but the browser blocks the response (CORS error).
- Only #2 → the browser is ready, but the frontend is still calling itself
  and every request 404s.

`SAFEZONE_CORS_ORIGINS` is never allowed to be `*`. The backend falls back to
localhost-only origins and logs a warning at startup, which is safe but means a
deployed frontend will be blocked until you set it.

`VITE_API_URL` is read at **build** time, so redeploy the frontend after
changing it.

## Project structure

```
SafeZone-AI/
  backend/
    app/
      main.py                 # FastAPI app, routes, WebSocket, CORS
      db.py                   # Schema (SQLite + PostgreSQL), model_state, seeding
      models.py               # Pydantic request/response models
      data_loader.py          # DB-first loading with JSON fallback
      red_zone_ingestion.py   # GeoJSON/CSV hazard ingestion + backtest fixtures
      auth.py                 # JWT auth, bcrypt, PIN login
      auth_hashes.py          # Password hashing helpers
      roles.py                # Role definitions and dependencies
      risk_engine.py          # Multi-factor risk scoring (adaptive weights)
      capacity_engine.py      # Shelter allocation
      relocation_engine.py    # Destination ranking
      scenario_engine.py      # What-if simulation
      ground_reality_engine.py# Predicted risk + live SOS -> operational priority
      sos_engine.py           # SOS aggregation, priority scoring
      learning_engine.py      # Correlation-based factor weighting + observation store
historical_seed.py      # Idempotent, provenance-preserving corpus seeding
village_history.py      # Per-village recency-weighted memory (10-yr half-life)
      satellite_engine.py     # SZ1 burst protocol, link budget, terminal fleet
      reasoning_engine.py     # Human-readable advisory for authorities
    scripts/
      ingest_data.py          # Populate DB from CSV/JSON
    data/
      inputs/                 # census_villages.csv, hazard_*.geojson
      backtest/               # kedarnath_2013.json (validation fixture)
                        # event_corpus.json (labelled training corpus)
      villages.json, safe_zones.json
    tests/                    # pytest suite (97 tests)
    requirements.txt
  frontend/
    public/
      sw.js                   # Service worker (precache, offline, background sync)
      manifest.json           # PWA manifest
      icon-192.png, icon-512.png, apple-touch-icon.png
    scripts/
      generate-sw.mjs         # Injects hashed build id + precache manifest
      generate_icons.py       # Regenerates PWA icons
    src/
      main.tsx                # App bootstrap + service worker registration
      App.tsx                 # Routes
      components/             # Dashboard, SOS, Map, Satellite panel, panels
      auth/                   # Login, Register, AuthContext, ProtectedRoute
      services/               # API client, offline cache (IndexedDB)
      hooks/                  # WebSocket hook
      contexts/               # Theme context
    index.css                 # Tailwind + CSS variables + theming
```

## Assumptions and limitations

- Travel time uses straight-line haversine distance at ~30 km/h, not a real routing engine.
- Village/safe-zone names are from the Kedarnath region but illustrative for the prototype.
- "People requiring relocation" is a modeled fraction, not a census figure.
- Capacity allocation is greedy-by-priority in a single pipeline run.
- **No live government, satellite, or IoT feeds are connected.** See
  [What is real, and what is modelled](#what-is-real-and-what-is-modelled).
- **The training corpus is not a real historical dataset.** It mixes the six
  Kedarnath 2013 locations (an illustrative reconstruction that its own `source`
  field says is "NOT official measurements") with 90 *synthetic* vignettes from a
  crossed design. The derived scenarios carry a **declared causal model that we
  chose**; it is an assumption about hill-disaster response, not a measured fact
  about Uttarakhand. No government, satellite or IoT feed is used anywhere.
- **The corpus proves the learning pipeline works, not that road access causes
  disasters.** It shows the engine recovers a planted ranking and correctly
  reports no signal for the three control factors. Confirming that road access
  matters in *real* incidents needs real outcome data, which this project does
  not have. Do not let a demo imply otherwise.
- **Historical evidence is excluded from public confidence by design.** Public
  confidence is derived from live SOS adjudications only, so it legitimately
  reads 0% in a fresh deployment even though 96 historical cases are loaded.
  This is intentional, not a bug.
- **Weight detail is official-only.** `GET /api/learning` returns counts and
  confidence but not the factor weights.
- The satellite layer is a protocol implementation plus a link model. It is not
  connected to any satellite, and no licence is held.
- Offline SOS submission is implemented but not yet independently verified with
  a confirmed-dead server, unlike the offline app-boot path.
