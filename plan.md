# EMBER Build Plan

Phased checklist. Solo developer workflow.

Labels:
- **🟢 Just do it** — tell Claude/Cursor what to build, no planning needed
- **🟡 Think first** — ask Claude to think through the approach before coding (multi-file, stateful, or complex logic)

---

## Phase 1 — Foundation (Days 1-3)

- [x] 🟢 Create GitHub repo with `/frontend`, `/backend`, `/data` folder structure
- [x] 🟢 Create `.gitignore` with: `node_modules/`, `__pycache__/`, `.env`, `*.pyc`, `dist/`, `.vite/`
- [x] 🟢 Set up `.env.example` with `MAPBOX_TOKEN=`, `GOOGLE_MAPS_API_KEY=`, `ANTHROPIC_API_KEY=`, `DEMO_MODE=true`
- [x] 🟢 Move scenario data files to `/data/scenarios/2023-west-kelowna/` — `mcdougall_creek_perimeter.geojson`, `shelters.json`, `road_closures.json`, `2023-08-15.csv` through `2023-08-19.csv`
- [x] 🟢 Move docx files to `/docs/` — `EMBER_Project_Overview_Final_v2.docx`, `EMBER_Addendum_UI_API_Contracts.docx`
- [x] 🟢 Initialize React + TypeScript + Vite frontend in `/frontend` — `npm create vite@latest . -- --template react-ts`
- [x] 🟢 Install frontend deps: `tailwindcss`, `mapbox-gl`, `@tanstack/react-query`, `react-router-dom`
- [x] 🟢 Configure Tailwind CSS — `tailwind.config.js`, `postcss.config.js`, base styles in `index.css`
- [x] 🟢 Initialize FastAPI backend in `/backend` — create `main.py`, `requirements.txt`
- [x] 🟢 Backend `requirements.txt`: `fastapi`, `uvicorn[standard]`, `shapely`, `pandas`, `anthropic`, `httpx`, `python-dotenv`
- [x] 🟢 Create `backend/cache.py` — in-memory dict cache with TTL (see CLAUDE.md reference implementation)
- [x] 🟡 Wire Demo Mode toggle — `DEMO_MODE` env var read in backend `main.py`, exposed via `GET /api/config` endpoint, frontend reads it on startup. Think through: how does the frontend know demo mode is on? How does the backend conditionally load static data vs call live APIs?
- [x] 🟢 Base Mapbox GL JS map component in `frontend/src/components/Map.tsx` — renders empty map centered on West Kelowna (49.86, -119.58) with token from env var
- [x] 🟢 Load and render `mcdougall_creek_perimeter.geojson` on the map as a red polygon fill with dark red outline
- [x] 🟢 Deploy frontend to Vercel — connect GitHub repo, set env vars
- [ ] 🟢 Deploy backend to Railway — connect GitHub repo, set env vars, configure `uvicorn` start command
- [x] 🟢 Git: initial commit with scaffold, data files, and working map — push to main

## Phase 2 — Core Map Layers (Days 4-6)

- [x] 🟢 Evacuation zone overlays on Mapbox map: Order (red fill, 0.3 opacity), Alert (orange fill, 0.2 opacity), Watch (yellow fill, 0.15 opacity) — sourced from scenario data or placeholder polygons
- [x] 🟢 Road closure layer: render lines from `road_closures.json` `coordinates_from`/`coordinates_to` as thick red dashed lines on map
- [x] 🟢 Shelter pins layer: render markers from `shelters.json` lat/lng with color-coded status — green circle (Open), amber circle (Filling), red circle (Near Full)
- [x] 🟢 Fire spread projection rings: render `spread_2hr.geojson`, `spread_4hr.geojson`, `spread_6hr.geojson` as translucent orange overlays with decreasing opacity (+2hr=0.3, +4hr=0.2, +6hr=0.1)
- [x] 🟡 Pre-compute spread GeoJSON files using Shapely `buffer()` on `mcdougall_creek_perimeter.geojson` — script in `backend/scripts/generate_spread.py`. Think through: what buffer distances for 2/4/6hr? How to read ISI from weather CSV to calculate spread rate? Does the perimeter GeoJSON need reprojection for Shapely buffer to work in meters?
- [x] 🟢 Wind vector arrows: render wind direction/speed from weather CSV data as arrow markers on map near station 1277 location
- [x] 🟢 Map legend component in `frontend/src/components/MapLegend.tsx` — color key for all layers
- [x] 🟢 Satellite/street map style toggle button on map
- [ ] 🟢 Git: all layers rendering from static JSON — merge to dev

## Phase 3 — Backend & Agents (Days 7-10)

- [ ] 🟡 Create `backend/agents/threat.py` — Threat Agent: load fire perimeter GeoJSON + weather CSV for station 1277, compute distance from user address to nearest perimeter point, compute time-to-perimeter from ISI-derived spread rate, classify spread rate. Think through: how to compute distance from a point to a polygon in Shapely? How to convert ISI to a rate of spread in km/h? What coordinate system for distance calculations?
- [ ] 🟡 Create `backend/agents/route.py` — Route Agent: take user address + active closures, call Google Maps Directions API (or return cached demo route), return ranked routes with closed segments flagged. Think through: what does the demo mode route look like? Do we hardcode a pre-computed route in the scenario folder? How to detect if a closure is on the returned route?
- [ ] 🟡 Create `backend/agents/shelter.py` — Shelter Agent: load `shelters.json`, apply full ranking algorithm from CLAUDE.md. Think through: the ranking has 5 factors (drive time, accessibility filter, pet deprioritize, medical boost, near-full penalty) — implement as a scoring function that modifies effective drive time, then sort.
- [ ] 🟡 Create `backend/agents/profile.py` — Profile Agent: combine outputs from Threat/Route/Shelter agents, build structured JSON payload matching the LLM prompt format in CLAUDE.md, call Anthropic API, return briefing_text. Think through: in Demo Mode, skip the API call and return a pre-cached briefing string instead.
- [ ] 🟡 Create `backend/orchestrator.py` — wire `asyncio.gather` to run Threat/Route/Shelter agents in parallel with 3-second timeout, then pass results to Profile Agent. Think through: what happens if one agent times out? Return partial data with the failed agent's section as null? How does the Profile Agent handle missing data?
- [ ] 🟡 Implement `GET /api/briefing?address=...` in `backend/main.py` — call orchestrator, return full JSON response matching the API contract in CLAUDE.md. Think through: this is the most important endpoint. It chains everything together. Make sure the response shape exactly matches what the frontend expects from CLAUDE.md.
- [ ] 🟢 Implement `GET /api/admin/situation` in `backend/main.py` — return fire info, evacuation counts, road closures, shelter statuses, last update time
- [ ] 🟡 Demo Mode data loading: on startup when `DEMO_MODE=true`, pre-populate cache with all scenario files — perimeter, closures, weather, shelters, pre-computed routes and briefing text. Think through: what exact keys does the cache need? What files map to which cache keys? Write a load_demo_data() function that runs once at startup.
- [ ] 🟡 Pre-compute fire spread GeoJSON polygons (+2hr, +4hr, +6hr) using Shapely buffer on perimeter with asymmetric wind-direction offset — save to `/data/scenarios/2023-west-kelowna/`. Same as Phase 2 item — do it here if not done earlier.
- [ ] 🟢 Filter weather CSVs for station 1277 and create a clean `station_1277_weather.json` file with hourly wind/temp/humidity/ISI data for Aug 17
- [ ] 🟢 Git: all agents working, briefing endpoint returning real data — merge to dev

## Phase 4 — Resident View (Days 11-13)

- [ ] 🟢 Top bar component `frontend/src/components/TopBar.tsx`: EMBER logo (text-based), evacuation status badge (ORDER/ALERT/WATCH with matching color)
- [ ] 🟢 Address input bar component `frontend/src/components/AddressInput.tsx`: text input + GO button, calls `GET /api/briefing?address=...` on submit
- [ ] 🟢 Profile flag toggles `frontend/src/components/ProfileFlags.tsx`: pill-shaped buttons for Mobility, Pets, Medical, No Vehicle — active state changes background color, toggles boolean state
- [ ] 🟢 Alert banner component `frontend/src/components/AlertBanner.tsx`: appears at top when route changes, shows message like "Route updated — Westside Road now closed", auto-dismisses after 10 seconds
- [ ] 🟢 Briefing card component `frontend/src/components/BriefingCard.tsx`: threat summary, route summary, shelter summary, road closure warnings, LLM briefing text, last updated timestamp
- [ ] 🟢 Wire React Query polling: `useQuery` with `refetchInterval: 300000` (5 minutes) for `GET /api/briefing`
- [ ] 🟢 Route polyline rendering: decode encoded polyline from API response, render as blue line on Mapbox map
- [ ] 🟢 Profile flags persistence: save to `localStorage` key `ember_profile_flags`, load on mount
- [ ] 🟡 Responsive layout: map 65% height + briefing card below on mobile, side-by-side on wide screens (breakpoint at 1024px). Think through: how does the map resize? Does the briefing card scroll independently? How does this look on a projector at 1920x1080?
- [ ] 🟢 Loading state: skeleton cards while briefing is fetching
- [ ] 🟢 Error state: friendly error message if API fails
- [ ] 🟢 Git: full resident view working end-to-end with demo data — merge to dev

## Phase 5 — Admin View (Days 14-16)

- [ ] 🟡 Admin route `/admin` in React Router with split-panel layout — map 60% width left, panels 40% width right. Think through: does this share the same Map component as the resident view, or a separate instance? How does the admin map differ (shows vulnerability overlay, all shelters, all closures at once)?
- [ ] 🟢 Situation summary panel `frontend/src/components/admin/SituationPanel.tsx`: metric cards for perimeter size (ha), wind speed/direction, spread rate classification, last refresh time, properties under order count, properties under alert count
- [ ] 🟢 Road status panel `frontend/src/components/admin/RoadPanel.tsx`: list of road closures with color-coded badges — red (CLOSED), amber (ADVISORY), green (OPEN)
- [ ] 🟢 Shelter panel `frontend/src/components/admin/ShelterPanel.tsx`: shelter rows with name, capacity, status badge, and inline override buttons (Open/Filling/Near Full)
- [ ] 🟢 Implement `POST /api/admin/shelter/{id}/status` in `backend/main.py` — accepts `{ "status": "Filling" }`, updates in-memory shelter state, returns updated shelter
- [ ] 🟢 Implement `POST /api/admin/simulate/closure` in `backend/main.py` — accepts `{ "closure_id": "closure_001" }`, activates the closure in the demo timeline, returns active closures list
- [ ] 🟡 Implement `POST /api/admin/simulate/advance` in `backend/main.py` — accepts `{ "hours": 2 }`, advances demo clock, updates shelter statuses per timeline (T+2: Royal LePage → Filling, T+4: → Near Full), returns new time and timeline step. Think through: need a global demo_state object that tracks current_time and timeline_step. Advancing time should update shelter statuses, activate closures per the timeline in road_closures.json, and shift the fire perimeter to the projected spread. What resets when "Reset" is clicked?
- [ ] 🟢 Simulation control buttons `frontend/src/components/admin/SimControls.tsx`: [Trigger Road Closure] dropdown, [Advance Time +2HR], [Load Scenario], [Reset]
- [ ] 🟢 Demo Mode toggle switch + LIVE badge in admin top bar
- [ ] 🟢 Census vulnerability overlay (stretch goal): DA-level 65+ choropleth from GeoJSON, rendered as dashed purple regions on admin map
- [ ] 🟢 Git: full admin view working with simulation controls — merge to dev

## Phase 6 — Polish & Demo (Days 17-18)

- [ ] 🟢 Fire spread model refinement: asymmetric buffer based on wind direction from station 1277 data
- [ ] 🟢 Pre-generate and cache the demo briefing output so LLM is never called live on stage — store in `/data/scenarios/2023-west-kelowna/demo_briefing.json`
- [ ] 🟢 Test Demo Mode fully offline: disconnect internet, verify all map layers load, verify briefing returns cached response
- [ ] 🟢 Fix any visual bugs, loading states, edge cases
- [ ] 🟢 Add loading spinner / skeleton screens for all async operations
- [ ] 🟢 Ensure responsive layout works on projector resolution (1920x1080)
- [ ] 🟢 Rehearse the 4-minute demo script 20+ times
- [ ] 🟢 Prepare presentation slides — problem statement, architecture diagram, live demo, SDG alignment
- [ ] 🟢 Final deploy to Vercel + Railway with production env vars
- [ ] 🟢 **NO NEW FEATURES** — every hour makes the existing demo more reliable, not bigger