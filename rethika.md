# SafeLink - AI — Detailed Project Report

## 1. Project Overview

SafeLink - AI is a disaster-response decision support system built as a prototype for hazard-prone regions. It helps government officials, field responders, and emergency coordinators identify high-risk habitations, estimate relocation needs, compare shelter capacity, and prioritize action based on available data.

The application is designed to turn hazard information into actionable decisions. Instead of only showing a map of danger zones, it calculates:

- which communities are at risk,
- how severe the risk is,
- how many people may need relocation,
- which shelters can absorb displaced residents,
- which villages should be prioritized first,
- how scenario changes (rainfall, accessibility, road closure, etc.) affect decisions.

This project is an intelligent prototype for the SIH26191 challenge theme, focusing on hazard-based red zones, carrying capacity assessment, and immediate relocation planning for vulnerable habitations.

---

## 2. What the App Does

SafeLink - AI combines a risk dashboard, alerting system, relocation planner, and operational response view into a single web app.

### Core functions

1. Risk analysis
   - Scores every habitation using hazard, exposure, accessibility, slope, and historical risk factors.
   - Classifies each location into SAFE, MODERATE, HIGH, or CRITICAL categories.

2. Population vulnerability assessment
   - Estimates which communities are most exposed and most likely to require relocation.

3. Shelter and capacity analysis
   - Evaluates safe zones and shelters based on available space, occupancy, and logistics.
   - Tracks how much remaining capacity exists after higher-priority villages are allocated shelter space.

4. Relocation recommendation engine
   - Recommends the best destination for each affected village.
   - Explains why a particular shelter is chosen using safety, capacity, accessibility, medical access, and distance considerations.

5. Scenario simulation
   - Lets users simulate changes in rainfall, hazard severity, exposure, road access, and closure conditions.
   - Recomputes the risk profile and relocation plan instantly to show before-and-after impact.

6. Emergency response monitoring
   - Supports SOS reports, status tracking, operational priority ranking, and network-health monitoring.

7. Demo-mode fallback
   - If the backend is not available, the frontend can run from bundled fallback data and clearly indicates it is in demo mode.

---

## 3. Primary Users

The app is designed for a few major user types:

- District or disaster officials: review vulnerability, relocation priorities, and shelter allocation.
- Emergency response coordinators: monitor high-risk villages and prioritize assignments.
- Citizens / volunteers: submit SOS reports and view emergency status.
- Administrators: manage access and system-level monitoring.

---

## 4. System Architecture

### Frontend

The frontend is built with React and Vite and uses:

- React for component-based UI
- Vite for frontend build tooling
- Tailwind CSS for styling
- Leaflet + React-Leaflet for the map UI
- Axios for API calls
- Lucide React for icons

### Backend

The backend is a FastAPI service that exposes the API and runs the analytics logic. It includes:

- authentication endpoints,
- risk summary endpoints,
- village and safe-zone data APIs,
- relocation recommendation APIs,
- scenario simulation,
- SOS and mesh-network management,
- ground-reality and operational-priority endpoints.

### Data layer

The app uses sample JSON data for villages, safe zones, SOS records, mesh nodes, and user profiles. These are structured to mimic a realistic pilot district and are intentionally demo data, not production live feeds.

---

## 5. App Modules and Features

### A. Risk Map Dashboard

The main dashboard contains:

- a village search area,
- a risk map showing villages and shelters,
- KPI cards for population at risk, required relocation, capacity gap, and safe capacity,
- village selection and inspection,
- recommendations for the selected village.

This view is the operational center of the product.

### B. Village Risk Breakdown

When a village is selected, the app shows:

- risk score,
- hazard level,
- risk factors,
- population estimate,
- relocation requirement,
- explanation of why the village is classified as high or critical.

### C. Safe Zone / Shelter Panel

This panel shows:

- available safe zones,
- shelter capacity,
- currently allocated capacity,
- remaining capacity after reallocation,
- operational fit based on risk and travel factors.

### D. Relocation Recommendation Panel

This is one of the most important modules. It shows:

- which village should move first,
- the recommended destination shelter,
- the reason the shelter was selected,
- alternative shelters if the top option is unavailable.

The recommendation is built using criteria like:

- safety of destination,
- remaining capacity,
- road accessibility,
- medical access,
- distance,
- suitability for vulnerable populations.

### E. What-If Scenario Simulator

This module allows users to adjust:

- hazard severity,
- rainfall intensity,
- exposure level,
- accessibility,
- road closure status.

It then recalculates the whole pipeline and returns a comparison of the "before" and "after" conditions.

### F. SOS Reporting

The app includes a citizen-first SOS workflow:

- report a local emergency,
- mark whether it is a medical emergency,
- classify urgency and affected population,
- track report status from NEW to ACTIVE to RESOLVED,
- prioritize reports by urgency.

### G. Ground Reality Panel

This module models practical operational data such as ground-level conditions that affect decision-making beyond pure geography. It helps translate risk scores into field actionability.

### H. Mesh Network Health

The product includes a mesh communication health section that monitors:

- active vs inactive nodes,
- relay nodes,
- gateway and volunteer devices,
- battery levels,
- message relay volume,
- network coverage percentage.

This helps represent emergency communications continuity in disaster settings.

### I. Authentication

The frontend supports several login styles to simulate realistic field access patterns:

- email + password,
- face recognition simulation,
- fingerprint simulation,
- emergency PIN login.

This gives the app the feel of a command-and-control emergency platform.

---

## 6. Data Model and Logic Flow

The app treats the district as a set of villages and shelter destinations. Each village is evaluated using several factors including:

- hazard severity,
- slope and terrain risk,
- population exposure,
- road accessibility,
- facility access,
- historical events.

The risk pipeline works like this:

1. Load village and shelter data
2. Evaluate risk score for each village
3. Compute vulnerable population requiring relocation
4. Evaluate shelter capacity and remaining availability
5. Rank relocation priority by urgency and vulnerability
6. Recommend the best shelter destination
7. Allow scenario changes and generate a new decision picture

This makes the app an end-to-end decision-support system rather than just a map viewer.

---

## 7. API Overview

The backend exposes these important routes:

- GET /api/health — checks service status
- POST /api/auth/register — register a user
- POST /api/auth/login — sign in
- POST /api/auth/face-login — demo face verification
- POST /api/auth/pin-login — emergency PIN login
- GET /api/villages — all evaluated villages
- GET /api/villages/{id} — single village risk profile
- GET /api/safe-zones — shelter and capacity data
- GET /api/risk-summary — district-wide KPIs
- GET /api/relocation-priority — prioritized relocation queue
- GET /api/recommendation/{village_id} — top shelter recommendation
- POST /api/scenario — run scenario simulation
- POST /api/sos/submit — submit an SOS report
- GET /api/sos/reports — fetch SOS records
- PATCH /api/sos/reports/{id} — update status
- GET /api/mesh/nodes — mesh node inventory
- GET /api/mesh/health — mesh communication summary
- GET /api/ground-reality — operational ground-level evaluation
- GET /api/operational-priority — operational action priorities

---

## 8. Demo Data and Scope

This project is intentionally built with demo data. The data files are designed to look and behave like a realistic district pilot, but they are sample records for demonstration and testing only.

Important notes:

- no live government feeds are connected,
- no real-time satellite imagery is used,
- no real rescue logistics backend is connected,
- no production database is required for the prototype,
- the architecture is structured so real datasets can replace the JSON dataset later.

This keeps the project focused on the decision-support workflow and core logic instead of production data engineering.

---

## 9. Project Structure

The repository is organized as follows:

- README.md — project overview and setup instructions
- backend/ — FastAPI service and logic engines
- backend/app/ — route handlers, models, data loaders, engines
- backend/app/data/ — sample villages, safe zones, users, mesh data, SOS reports
- frontend/ — React application
- frontend/src/ — pages, components, auth flows, services, fallback logic

This project is intentionally modular so each concern remains separate:

- risk logic,
- capacity analysis,
- relocation scoring,
- scenario simulation,
- SOS handling,
- mesh health monitoring,
- authentication.

---

## 10. Current Product Positioning

SafeLink - AI is a prototype for a real emergency planning platform. It demonstrates how a disaster intelligence tool can help a region move from:

- static hazard maps,
- to dynamic risk scoring,
- to operational relocation planning,
- to scenario-based decision support,
- to field emergency response coordination.

In short, it transforms hazard visibility into an actionable emergency response workflow.

---

## 11. Key Strengths of the App

- clear visualization of risk across a district,
- explainable scoring and recommendations,
- capacity-aware relocation planning,
- scenario-based “what if” analysis,
- emergency response features beyond planning,
- modular design suitable for future integration with real data sources.

---

## 12. Known Limitations

This is still a prototype and has known constraints:

- travel time is estimated using simplified assumptions,
- the district map is fictional but geographically consistent,
- relocation capacity is allocated greedily and not fully logistics-aware,
- real government or IoT feeds are not yet connected,
- the app is designed as a demo system, not as a final production emergency authority platform.

---

## 13. Final Summary

SafeLink - AI is a fast, explainable disaster-risk and relocation decision-support platform. It combines maps, analytics, shelter capacity calculations, and emergency response workflows into one user-friendly system for crisis planning.

Its purpose is not to replace human judgment, but to help officials make more informed, transparent, and timely decisions during disaster preparation and response.

This project is a strong prototype for an AI-powered disaster intelligence and operation-planning assistant, and it is currently positioned as a realistic demo of how such a system could work in the field.
