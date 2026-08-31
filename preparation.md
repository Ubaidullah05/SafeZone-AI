# SafeLink-AI — Presentation Preparation Document

## Complete Project Breakdown: Page by Page, Component by Component

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Page-by-Page Breakdown](#3-page-by-page-breakdown)
4. [Backend Architecture](#4-backend-architecture)
5. [Offline & Mesh Network System](#5-offline--mesh-network-system)
6. [Real-World Scenario: Nepal Flood](#6-real-world-scenario-nepal-flood)
7. [Key Differentiators](#7-key-differentiators)
x`.,
---

## 1. Project Overview

**SafeLink-AI** is a **Disaster Response Command Center** — a full-stack web application that helps disaster management officials identify at-risk villages, prioritize evacuations, manage real-time SOS reports from citizens, and coordinate mesh-network-based communication when traditional infrastructure fails.

**Problem Statement (SIH26191):** During natural disasters like floods and earthquakes, vulnerable hilltop and riverside habitations face immediate danger. Government officials need a single dashboard that combines risk prediction, citizen field reports, shelter capacity tracking, and evacuation recommendations — all updated in real-time, even when the internet goes down.

**Solution:** A command-center dashboard that:
- Predicts risk for 12 habitations using weighted hazard models
- Receives real-time SOS reports from citizens via mesh network
- Combines predicted risk with ground truth (citizen reports) for dynamic scoring
- Recommends the best safe zone for each village based on distance, capacity, safety, and road access
- Simulates what-if disaster scenarios (e.g., "what if rainfall increases 30%?")
- Works offline using IndexedDB, Service Workers, and a browser-based mesh simulation

---

## 2. Technology Stack

### Frontend
| Technology | What | Why |
|------------|------|-----|
| **React 18** | UI framework | Component-based architecture, fast rendering with virtual DOM, hooks for state management |
| **Vite** | Build tool | Sub-second hot module replacement, fast builds, native ES modules |
| **Tailwind CSS** | Utility-first CSS | Rapid styling without writing custom CSS files, consistent design system |
| **Framer Motion** | Animation library | Smooth page transitions, staggered card animations, spring physics for natural feel |
| **React Leaflet** | Map component | OpenStreetMap integration for plotting villages, safe zones, and hazard zones on a real map |
| **Recharts** | Charts | Risk breakdown bar charts, radar charts for village profiles |
| **Lucide React** | Icons | Beautiful, consistent SVG icons (AlertTriangle, Shield, Wifi, Heart, etc.) |
| **React Router DOM** | Client-side routing | `/login`, `/register`, dashboard routes with protected auth |
| **Axios** | HTTP client | API calls with interceptors for JWT token injection, automatic error handling |
| **WebAuthn API** | Biometric auth | Fingerprint and face recognition on mobile devices (native browser API) |
| **MediaDevices API** | Camera access | Front-facing camera capture for face authentication on mobile |
| **IndexedDB** | Client-side database | Persistent offline storage for mesh messages, SOS queues, synced data |
| **Service Worker** | Background caching | Offline-first PWA — caches all app assets so the app loads without internet |
| **WebSocket** | Real-time connection | Live updates for new SOS alerts, mesh node status changes, and heartbeat pings |

### Backend
| Technology | What | Why |
|------------|------|-----|
| **Python 3** | Backend language | Fast development, rich scientific/math libraries for risk calculations |
| **FastAPI** | Web framework | Async-ready, automatic OpenAPI docs at `/docs`, Pydantic validation |
| **Uvicorn** | ASGI server | High-performance async server for FastAPI |
| **Pydantic** | Data validation | Type-safe request/response models, automatic validation, clear error messages |
| **Passlib + bcrypt** | Password hashing | Industry-standard password security (never stores plain text) |
| **PyJWT** | Token auth | JSON Web Tokens for stateless authentication sessions |
| **Haversine formula** | Distance calc | Accurate distance between lat/lng coordinates on Earth's surface (used for routing and destination scoring) |
| **BFS routing** | Pathfinding | Breadth-First Search for multi-hop mesh network routing between devices |

### Offline / Mesh
| Technology | What | Why |
|------------|------|-----|
| **IndexedDB** | Local database | Stores messages, SOS reports, and mesh state when offline |
| **Service Worker (sw.js)** | Offline cache | Serves cached app shell and API responses when network is unavailable |
| **Store-and-Forward** | Networking pattern | Messages are buffered on a node and delivered when a route becomes available |
| **BFS Multi-Hop Routing** | Network routing | Messages hop through multiple intermediate nodes to reach a gateway |
| **Background Sync** | Offline queue | SOS reports queue up offline and automatically sync when connectivity returns |

---

## 3. Page-by-Page Breakdown

---

### 3.1 Login Page (`LoginPage.jsx`)

**What the user sees:**
A beautiful animated login screen with four authentication tabs: Email, PIN, Face ID, and Thumb (fingerprint). The background has animated gradient orbs that slowly drift. Each tab has its own unique visual experience — the email tab shows input fields, the PIN tab shows a numeric keypad, the Face ID tab opens the camera with a scanning animation, and the Thumb tab shows a fingerprint pulse animation.

**Why each element exists:**
- **Email/Password tab** — Standard authentication for desktop users at government offices
- **PIN tab** — Emergency quick-access for field workers who can't type a full password
- **Face ID tab (mobile only)** — Uses the phone's front camera via `navigator.mediaDevices.getUserMedia()` to capture a face image. Shows a golden scanning line animation over the camera feed for 2.5 seconds, then sends the image to the backend for verification. This is for first responders in the field who need quick, hands-free authentication.
- **Thumb tab (mobile only)** — Uses the WebAuthn API (`navigator.credentials.create()`) to trigger the device's native biometric prompt (Touch ID, Face ID, or fingerprint sensor). Shows animated pulse rings. This is the fastest authentication method on mobile.

**Tech deep-dive:**
- Mobile detection uses User-Agent sniffing + `'ontouchstart' in window` to determine if Face/Thumb tabs should appear
- Camera access uses `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })` — the `facingMode: 'user'` ensures the front camera is used
- WebAuthn uses `PublicKeyCredential` to create a credential, triggering the device's native biometric dialog
- All authentication methods hit the FastAPI backend which returns a JWT token stored in `localStorage`
- Animations use Framer Motion's `AnimatePresence` for smooth tab switching

**Real-world reason:** In a disaster, officials might be wearing gloves, have wet hands, or be in a hurry. Multiple auth methods ensure everyone can access the system quickly.

---

### 3.2 Dashboard (`Dashboard.jsx`)

**What the user sees:**
The main command center — a full-screen layout with:
- **Header** at the top (branding, active SOS counter, day/night toggle, user profile)
- **Alert Banner** below the header (critical alerts with urgency pulse animation)
- **Sidebar** on the left (7 navigation tabs with icons and active indicators)
- **Main Content Area** in the center (changes based on which sidebar tab is selected)
- **Footer** at the bottom (LIVE indicator with pulsing green dot)

**Why it exists:**
This is the central hub — every piece of information flows through here. The sidebar gives officials one-click access to any view. The alert banner ensures critical information is always visible regardless of which tab is active.

**Tech deep-dive:**
- Uses `useState` for tab selection, village selection, and scenario state
- Data flows from `App.jsx` → `Dashboard.jsx` → individual tab components
- The `isDemoMode` flag means the app works even without a backend — it uses pre-computed fallback data from `fallbackData.js`
- The layout uses CSS flexbox with `h-screen overflow-hidden` to prevent page scrolling — only the content area scrolls internally

---

### 3.3 Risk Map Tab (Default View)

**What the user sees:**
A split-panel layout:
- **Left panel:** Search bar + scrollable list of 12 villages with color-coded risk scores (green=safe, yellow=moderate, orange=high, red=critical)
- **Center:** Interactive Leaflet/OpenStreetMap showing the district with color-coded circle markers for each village, purple markers for safe zones, and semi-transparent hazard zone circles
- **Right panel:** When a village is selected, shows a detailed risk profile card with bar charts (Recharts) showing the 6 risk factors, plus a relocation priority table ranking all villages

**Why each element exists:**
- **Village list** — Quick overview of all habitations; color coding lets officials instantly spot danger
- **Interactive map** — Geographic context is critical in disasters; officials need to see which villages are near rivers, on hills, or along blocked roads
- **Hazard zone circles** — The semi-transparent colored circles around villages represent the hazard radius — larger circles mean higher risk score
- **Risk profile card** — When you click a village, you see exactly WHY it's at risk (6 factors with individual scores)
- **Relocation table** — Ranked list showing which villages need evacuation first, how many people, and to which shelter

**Tech deep-dive:**
- `react-leaflet` renders the OpenStreetMap tile layer
- `CircleMarker` components plot villages with `fillColor` based on `riskColor()` function
- `Circle` components draw hazard zones with `fillOpacity: 0.08` for subtle shading
- Risk scores come from the **Risk Engine** which uses a weighted formula:
  ```
  Risk = 0.30 × Hazard Severity
       + 0.20 × Slope Risk
       + 0.15 × Population Exposure
       + 0.15 × Accessibility Risk
       + 0.10 × Facility Access Risk
       + 0.10 × Historical Event Risk
  ```
- Thresholds: SAFE (0-30), MODERATE (31-60), HIGH (61-80), CRITICAL (81-100)

---

### 3.4 SOS Reports Tab

**What the user sees:**
A real-time emergency report management interface:
- **Stats cards** at the top: Total Reports, Active, Medical Emergencies, People Affected
- **Filter bar** with status (New/Acknowledged/In Progress/Resolved) and severity (1-5) dropdowns
- **Report cards** in a scrollable list — each card shows emoji for emergency type (🌊 flood, 🏥 medical, 🔥 fire), village name, severity badge, status badge, priority score, and people affected
- **Detail panel** on the right when a card is selected — shows full description, reporter info, phone number, medical details, and action buttons (Acknowledge / Dispatch Team / Resolve)
- **Submit SOS button** — opens a form for citizens to submit new reports
- **Live indicator** — shows "Live — Real-time Alerts" (WebSocket connected) or "Polling — Auto-refresh" (fallback)
- **New report flash** — when a new SOS arrives via WebSocket, a red flash notification appears

**Why each element exists:**
- **Stats cards** — At-a-glance summary for commanders; medical emergencies need immediate attention
- **Severity filtering** — In a crisis with hundreds of reports, officials need to filter by urgency
- **Status workflow** — NEW → ACKNOWLEDGED → IN_PROGRESS → RESOLVED mirrors real emergency response procedures
- **Medical emergency badge** — 🏥 icon makes medical cases instantly visible (life-or-death priority)
- **Relay hops** — Shows how many mesh hops the message took to reach the command center (indicates network health)

**Tech deep-dive:**
- Reports are fetched from `GET /api/sos/submit` and `GET /api/sos/stats`
- WebSocket connection via `useAlertWebSocket()` hook receives real-time SOS updates
- When WebSocket is disconnected, falls back to 5-second polling interval
- Priority score calculation: `severity × 15 + people_affected/100 (max 25) + medical_bonus(20) + type_weight`
- Status updates hit `PATCH /api/sos/{id}` endpoint
- Each report carries `relay_hops` and `relay_via` — the actual path the message took through the mesh network

---

### 3.5 Ground Reality Tab

**What the user sees:**
Cards for each village showing:
- Village name with priority badge (HIGH/MODERATE/LOW)
- **Two progress bars:** "Predicted" (purple) vs "Ground" (golden) risk scores
- Five component scores: SOS Intensity, Report Density, Severity, Medical Urgency
- All cards are arranged in a responsive 2-column grid

**Why this exists:**
This is the most innovative feature. The Risk Engine predicts risk based on static geographic data (slope, hazard history, etc.), but the Ground Reality Engine combines that with LIVE citizen reports. A village might have low predicted risk but lots of SOS reports (ground truth says it's worse than predicted). Or a village might have high predicted risk but no reports yet (officials should investigate).

**Tech deep-dive:**
The Ground Reality Score formula:
```
Ground Reality = 0.35 × Predicted Risk
               + 0.25 × SOS Intensity (active reports → 0-100)
               + 0.15 × Report Density (reports + people affected → 0-100)
               + 0.15 × Severity Aggregate (avg severity → 0-100)
               + 0.10 × Medical Urgency (% of medical emergencies)
```

- SOS Intensity: `min(active_reports × 10, 100)` — 10+ active reports = maximum intensity
- Report Density: combines total reports (max 60 points) with people affected (max 40 points)
- Medical Urgency: `medical_emergencies / active_reports × 100`

**Real-world use:** If Amrapur has a predicted risk of 88 but only 1 SOS report, its Ground Score might be 68 (lower than predicted). But if Bhairavgarh has a predicted risk of 74 but 8 active SOS reports with medical emergencies, its Ground Score might be 82 (higher than predicted) — meaning respond to Bhairavgarh FIRST.

---

### 3.6 Network Health Tab (Mesh Network)

**What the user sees:**
- **8 health metric cards:** Active Nodes, Total Nodes, Avg Battery, Messages Relayed, Avg Signal, Avg Latency, Network Coverage %, Active Clusters
- **Interactive SVG topology diagram** showing 17 mesh network nodes as colored circles with connection lines between them. Nodes are color-coded by type (blue=volunteer, green=civilian, orange=rescue, purple=gateway, red=offline). Each node shows battery percentage and name label. Active message relay paths light up in different colors.
- **LIVE indicator** with refresh button

**Why this exists:**
During a disaster, cell towers and internet infrastructure often fail. SafeLink-AI uses a mesh network where smartphones relay messages to each other using Bluetooth/Wi-Fi Direct. This tab lets officials monitor the health of that network — which nodes are active, which are running low on battery, and whether messages are successfully relaying.

**Tech deep-dive:**
- Backend `mesh_engine.py` simulates 17 nodes across 4 types (GATEWAY, RESCUE, VOLUNTEER, CIVILIAN)
- Each node has: latitude, longitude, battery level, device type, signal strength, latency
- **BFS routing** finds multi-hop paths from source to gateway
- **Battery-aware routing:** nodes with <10% battery are excluded from relay paths
- **Communication ranges:** CIVILIAN=5km, VOLUNTEER=8km, RESCUE=9.6km, GATEWAY=12km
- **Store-and-forward:** when no route exists, messages are buffered and retried every 5 seconds
- **Cluster formation:** dynamic clusters form around gateway and rescue nodes
- The SVG coordinates are calculated using a linear mapping of lat/lng to SVG viewport space
- Battery drains at 0.05%/minute idle, 2% per message relayed
- The frontend's `offlineMesh.js` mirrors this engine entirely in the browser for offline use

---

### 3.7 What-If Scenario Tab

**What the user sees:**
- **4 sliders:** Hazard Severity (-50% to +100%), Rainfall Intensity (-50% to +100%), Population Exposure (-50% to +100%), Road Accessibility (-50% to +50%)
- **Road Closure toggle** — a red on/off switch
- **"Load Demo Scenario" button** — pre-fills sliders with +20% hazard, +30% rainfall, +10% population, -15% road access
- **"Run Scenario" button** — executes the simulation
- **Before → After comparison panel** showing:
  - High Risk villages: before vs after count
  - Critical villages: before vs after count
  - Population at Risk: before vs after number
  - **"Additional Population At Risk"** — the delta (red number)

**Why this exists:**
Disaster officials need to answer "what if" questions: "What if rainfall increases 30%?" "What if the main road gets blocked?" This tool lets them simulate those scenarios and see exactly how many additional people would be at risk, so they can pre-position resources.

**Tech deep-dive:**
- Sliders send `ScenarioAdjustments` to `POST /api/scenario`
- Backend `scenario_engine.py` runs `run_full_pipeline()` TWICE — once with base data, once with adjusted data
- `apply_adjustments()` modifies village data:
  - Hazard increases: `hazard × (1 + delta/100)` + rainfall contribution: `hazard × (rainfall/100) × 0.5`
  - Road closure: `accessibility_risk = max(current, 85)` — hard floor
- Comparison is computed as `after_population_at_risk - before_population_at_risk`
- The entire pipeline runs again: Risk → Vulnerability → Relocation → Capacity → Destination Ranking
- This ensures the comparison is apples-to-apples — the same algorithm applied to both datasets

---

### 3.8 Relocation Tab

**What the user sees:**
- **Recommendation card** (when a village is selected): Shows the recommended safe zone with distance, travel time, capacity, safety score, medical access, road accessibility, overall destination score, and a list of "why" reasons
- **Relocation Priority table:** Ranked list of villages needing relocation with columns: Rank, Village Name, Risk Score, People to Relocate, Recommended Safe Zone, and an arrow to view details

**Why this exists:**
After identifying which villages need evacuation, officials need to know WHERE to send people. Not every shelter is equally good — some are too far, some are already full, some lack medical facilities. This tab ranks all feasible destinations per village.

**Tech deep-dive:**
- `relocation_engine.py` scores each destination using:
  ```
  Destination Score = 0.25 × Safety Score
                    + 0.25 × Capacity Score (capacity available / people needed)
                    + 0.20 × Road Accessibility
                    + 0.15 × Distance Suitability (closer = better, decays to 0 at 60km)
                    + 0.15 × Medical Access
  ```
- `CapacityLedger` tracks how much of each shelter has been allocated — higher-priority villages get first pick
- Travel time estimated at 30 km/h average (hilly terrain assumption)
- Distance uses Haversine formula for accurate great-circle distance
- The recommendation includes natural language reasons: "High safety score", "Sufficient capacity", "Good road accessibility", "Nearby medical facilities", "Acceptable travel distance"

---

### 3.9 Safe Zones Tab (Shelters)

**What the user sees:**
Cards for each safe zone/shelter showing:
- Shelter name with house icon
- Utilization percentage ("72% full")
- **Progress bar** — color changes based on utilization (purple < 50%, amber 50-80%, red > 80%)
- Bottom stats: Allocated population, Remaining capacity, Total capacity

**Why this exists:**
Officials need to know at a glance which shelters have room and which are nearly full. The color-coded progress bar makes this instantly clear.

**Tech deep-dive:**
- Data comes from `CapacityLedger.as_results()` which tracks allocations
- `utilization = (allocated_population / capacity) × 100`
- The ledger is stateful — when villages are allocated to shelters during priority ranking, the remaining capacity updates
- This prevents recommending a shelter that's already full

---

## 4. Backend Architecture

### API Endpoints

| Endpoint | Method | What It Does |
|----------|--------|--------------|
| `/api/health` | GET | Health check — confirms backend is alive |
| `/api/auth/register` | POST | Create new user account |
| `/api/auth/login` | POST | Email + password login → JWT token |
| `/api/auth/face-login` | POST | Face recognition login → JWT token |
| `/api/auth/fingerprint-login` | POST | Fingerprint/WebAuthn login → JWT token |
| `/api/auth/pin-login` | POST | Emergency PIN login → JWT token |
| `/api/auth/me` | GET | Get current user profile |
| `/api/villages` | GET | Get all villages with risk scores |
| `/api/villages/{id}` | GET | Get single village detail |
| `/api/safe-zones` | GET | Get all safe zones with capacity |
| `/api/risk-summary` | GET | Get district-wide risk statistics |
| `/api/relocation-priority` | GET | Get ranked relocation list |
| `/api/recommendation/{id}` | GET | Get safe zone recommendation for a village |
| `/api/scenario` | POST | Run what-if scenario simulation |
| `/api/sos/submit` | POST | Submit new SOS report |
| `/api/sos/reports` | GET | Get all SOS reports (with filters) |
| `/api/sos/stats` | GET | Get SOS statistics |
| `/api/sos/{id}` | PATCH | Update SOS report status |
| `/api/mesh/nodes` | GET | Get all mesh network nodes |
| `/api/mesh/health` | GET | Get network health summary |
| `/api/mesh/relay-paths` | GET | Get visualization data for topology |
| `/api/mesh/messages` | GET | Get in-transit and delivered messages |
| `/api/mesh/sos-relay` | POST | Submit SOS through mesh network |
| `/api/ground-reality` | GET | Get ground reality scores for all villages |
| `/ws/alerts` | WebSocket | Real-time SOS alert notifications |

### Data Flow Pipeline

```
Raw Village Data (JSON)
    ↓
Risk Engine (weighted formula → risk score 0-100)
    ↓
Risk Classification (SAFE / MODERATE / HIGH / CRITICAL)
    ↓
Vulnerability Calculation (risk × population exposure × accessibility)
    ↓
Relocation Need (how many people need to move)
    ↓
Priority Ranking (risk + vulnerability + population + capacity deficit)
    ↓
Capacity Allocation (shelters filled in priority order)
    ↓
Destination Scoring (safety + capacity + road + distance + medical)
    ↓
Final Recommendation (best shelter for each village)
```

---

## 5. Offline & Mesh Network System

### How Offline Mode Works

1. **First Load:** Service Worker caches all app files (HTML, JS, CSS, images) in the browser's Cache API
2. **Subsequent Loads:** Even without internet, the app loads from cache
3. **API Fallback:** When backend is unreachable, `App.jsx` catches the error and switches to `isDemoMode = true`, loading pre-computed data from `fallbackData.js`
4. **Data Persistence:** All SOS reports and mesh messages are stored in IndexedDB (browser database that survives page refreshes)

### How the Mesh Network Works

**The Concept:**
In a real disaster, cell towers are down. People's phones can still communicate via Bluetooth (500m range) and Wi-Fi Direct (5-12km range). SafeLink-AI's mesh network uses phones as relay nodes — a message from a village without internet hops through nearby phones until it reaches a "gateway" phone that has internet connectivity.

**Node Types:**
- **CIVILIAN** — Regular person's phone (5km range, 20 messages buffer)
- **VOLUNTEER** — Community volunteer with a phone (8km range, better battery)
- **RESCUE** — Emergency responder (9.6km range, priority messaging)
- **GATEWAY** — Phone with internet uplink that connects mesh to the cloud (12km range)

**Message Relay Process:**
1. Citizen submits SOS from their village
2. System finds the nearest active node in that village
3. BFS algorithm finds the shortest path to the nearest gateway
4. Message hops through intermediate nodes (each hop drains 2% battery from the relay node)
5. Gateway receives the message and pushes it to the cloud backend
6. If no route exists, message is stored locally and retried every 5 seconds (store-and-forward)
7. Messages expire after 1 hour (TTL)

**Offline Mesh Engine (Browser-based):**
- `offlineMesh.js` is a complete mesh simulation that runs entirely in JavaScript
- Contains 17 demo nodes with real coordinates, battery levels, and signal strengths
- Uses `Haversine` formula for accurate distance calculation between GPS coordinates
- BFS routing with battery-aware path selection
- Battery simulation (drains 0.05/min idle, 2% per relay)
- Signal strength fluctuation simulation
- All state persisted in IndexedDB (`safelink-mesh` database)

---

## 6. Real-World Scenario: Nepal Flood

### "I'm a person in Nepal. A flood is happening. What would I do with SafeLink-AI?"

---

**🕐 6:00 PM — Heavy rainfall warning**

I open SafeLink-AI on my phone. The **Day/Night toggle** is in day mode — clean blue and golden theme. The **Dashboard** shows my district has 12 habitations, with 2 villages already flagged as HIGH risk due to steep slopes and proximity to the river.

I tap on the **Risk Map** tab. The Leaflet map shows Amrapur (risk score 87.6) and Bhairavgarh (73.9) glowing red. I tap Amrapur — the risk profile shows hazard severity is 95/100 because it sits on a floodplain. The relocation table says 3,032 people need to move to Rajpur Relief Center.

**I use the What-If simulator** and slide "Rainfall Intensity" to +50%. The comparison shows: instead of 5 villages at high risk, now 8 villages are at high risk, with 3,200 additional people in danger. I immediately call the district collector with this data.

---

**🕐 8:00 PM — Flood hits, cell towers go down**

The electricity goes out. Cell towers lose power. Internet is dead. But SafeLink-AI's **Service Worker** still serves the app from my phone's cache. I can still see the dashboard.

More importantly, I'm carrying a **mesh network node** (my phone with the SafeLink-AI PWA installed). The **Network Health** tab shows 14 of 17 nodes are still active. The mesh is alive.

---

**🕐 8:30 PM — Submitting SOS offline**

People are gathering at a school in Amrapur. Water is rising. I tap **"Submit SOS"** on the SOS Reports tab. I fill in:
- Emergency Type: FLOOD
- Severity: 5 (Critical)
- People Affected: 450
- Medical Emergency: Yes — two elderly people need insulin
- Description: "Water level rising fast. School ground floor flooding. Need immediate evacuation."

I tap Submit. The app shows **"📨 Queued for mesh relay"** — the message is stored in IndexedDB and the mesh engine starts looking for a route.

---

**🕐 8:35 PM — Message hops through the mesh**

The **offlineMesh.js** engine finds a route:
```
My Phone (Amrapur) → NODE013 (Meena, Amrapur) → NODE001 (Rajesh, Gateway) → Cloud
```

The message hops twice. After 1.3 seconds, it reaches the gateway node whose owner has partial internet via satellite uplink. The gateway pushes the SOS to the backend.

At the **command center**, officials see my SOS flash on their **SOS Reports** tab with a red "🚨 New SOS received!" notification. The **Ground Reality Engine** automatically recalculates — Amrapur's Ground Score jumps from 68 to 89 because of the critical severity and medical emergency. It now shows as **IMMEDIATE priority**.

---

**🕐 9:00 PM — Evacuation coordination**

Officials click on Amrapur in the **Relocation** tab. The system recommends:
- **Rajpur Relief Center** — 12 km away, 25 min travel, 3,200 remaining capacity, safety score 85
- Alternative: Dehragunj Stadium Shelter — 18 km, 35 min, safety score 78

They dispatch a rescue team. The team's phones appear as **RESCUE** nodes in the **Network Health** tab, extending the mesh coverage toward Amrapur.

---

**🕐 10:00 PM — Ground truth evolves**

More SOS reports come in from different villages via the mesh:
- Bhairavgarh: "Bridge collapsed, 200 people stranded"
- Nandagaon: "Landslide blocking main road, 15 homes damaged"

The **Ground Reality Engine** dynamically reprioritizes. Bhairavgarh moves to #1 priority (bridge collapse = extreme accessibility risk). The relocation table updates in real-time.

Officials use this data to dispatch rescue helicopters to Bhairavgarh first, then ground teams to Nandagaon.

---

**🕐 6:00 AM next day — Connectivity returns**

The cell towers come back online. The **Background Sync** in SafeLink-AI detects the connection and automatically uploads all 23 offline SOS reports to the server. The "PENDING_SYNC" status badges on the reports turn to "NEW" as they reach the backend.

The **Safe Zones** tab shows Rajpur Relief Center is now at 78% capacity (filled with Amrapur evacuees). Dehragunj Stadium is at 45%. Officials can see exactly how many more people each shelter can take.

---

## 7. Key Differentiators

### Why SafeLink-AI is different from existing disaster apps:

1. **Offline-First Architecture** — Most disaster apps require internet. SafeLink-AI works completely offline after first load, with mesh networking to relay messages without infrastructure.

2. **Ground Reality Scoring** — No other system combines predicted risk (satellite/geographic data) with real-time citizen reports into a single dynamic score. This bridges the gap between "what models predict" and "what's actually happening on the ground."

3. **Multi-Hop Mesh Networking** — While apps like GoTenna or Bridgefy exist, SafeLink-AI integrates mesh networking directly into the disaster management dashboard. Officials don't need a separate app — they see mesh messages flowing in real-time on the same screen as risk data.

4. **What-If Scenario Simulation** — Disaster officials can simulate "what if rainfall doubles?" or "what if the main road closes?" and see the impact on ALL villages instantly. This is typically done in spreadsheets over hours; SafeLink-AI does it in seconds.

5. **Capacity-Aware Relocation** — The system doesn't just recommend the nearest shelter — it tracks how much capacity each shelter has left and allocates higher-priority villages first. This prevents the common problem of "the nearest shelter is already full."

6. **Biometric Authentication for Field Use** — Face and fingerprint login means field workers can authenticate quickly without typing, even with wet or gloved hands.

7. **Dual Theme System** — Night mode (violet/golden) for command centers operating 24/7, Day mode (blue/golden) for daytime field use with better visibility in sunlight.

8. **Progressive Web App** — Installable on any phone as a native-like app, works offline, uses the phone's camera and biometric sensors natively.

---

## 8. Deployment Architecture

```
┌─────────────────────────────────────────────┐
│                  USER'S PHONE               │
│  ┌───────────────────────────────────────┐  │
│  │  React PWA (cached by Service Worker) │  │
│  │  ├── Dashboard (all 7 tabs)          │  │
│  │  ├── Offline Mesh Engine (IndexedDB)  │  │
│  │  ├── Service Worker (offline cache)   │  │
│  │  └── Biometric Auth (WebAuthn/Camera) │  │
│  └───────────────────────────────────────┘  │
│                    │ (when online)           │
│                    ▼                         │
│  ┌───────────────────────────────────────┐  │
│  │  Mesh Network (Bluetooth/Wi-Fi Direct)│  │
│  │  Phone A → Phone B → Gateway Phone    │  │
│  └───────────────────────────────────────┘  │
│                    │ (gateway has internet)  │
│                    ▼                         │
│  ┌───────────────────────────────────────┐  │
│  │  Vercel (Frontend CDN)                │  │
│  │  Render (FastAPI Backend)             │  │
│  │  ├── Risk Engine                      │  │
│  │  ├── Ground Reality Engine            │  │
│  │  ├── Mesh Engine                      │  │
│  │  ├── SOS Engine                       │  │
│  │  ├── Relocation Engine                │  │
│  │  └── Scenario Engine                  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

---

*Document prepared for SafeLink-AI presentation. All data is demo/sample data for a fictional-but-geographically-consistent pilot district.*
