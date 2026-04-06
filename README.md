# EMBER — BC Wildfire Community Evacuation Intelligence Platform

Real-time wildfire evacuation briefings using BC government open data. Built for the GDSC Hack the Sem hackathon.

**Demo scenario:** 2023 McDougall Creek Fire (K52767), Aug 15–19, West Kelowna, BC.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + TypeScript, Vite, Tailwind CSS v4, Mapbox GL JS, React Query |
| Backend | Python 3.11+, FastAPI, Shapely, pandas |
| LLM | Anthropic Claude Sonnet (single call per briefing) |
| APIs | Google Maps (Geocoding, Directions, Places Autocomplete) |
| Deploy | Vercel (frontend), Railway (backend) |

## Views

### Resident View (`/`)

Enter an address and set profile flags (mobility, medical needs, pets, no vehicle). The app returns:

- A plain-language evacuation briefing from Claude Sonnet
- The recommended evacuation route drawn on the map
- The top-ranked shelter with status and accessibility info
- Active road closures listed in the briefing card

### Admin View (`/admin`)

A live operational dashboard for emergency coordinators:

- **Situation panel** — fire name, perimeter size, spread rate, wind speed/direction, and properties under evacuation order and alert
- **Roads panel** — active DriveBC closures with status badges
- **Shelters panel** — all 5 shelters with current status and manual override buttons (Open / Filling / Near Full)
- **Sim controls** — advance the demo timeline through 4 real historical milestones, trigger individual road closures, and reset to the initial state
- Demo/Live badge — gray pill in demo mode, pulsing red in live mode

## How It Works

### Resident briefing pipeline

1. User enters an address → **Google Geocoding** converts it to lat/lng (falls back to default demo coords)
2. Four agents run in parallel via `asyncio.gather`:
   - **Threat Agent** — computes distance from address to fire perimeter using Shapely; classifies spread rate (Low / Moderate / High / Extreme) from ISI index
   - **Shelter Agent** — ranks the 5 shelters by drive time with profile-based adjustments (see below); uses live Directions API in live mode, haversine estimates in demo mode
   - **Profile Agent** — assembles structured data from all agents and calls **Claude Sonnet** once for a 3–4 sentence plain-language briefing
3. Shelter result is passed to the **Route Agent**, which routes to the top-ranked shelter (ensuring the briefing card and map route always agree)
4. Frontend renders the briefing card, route polyline, shelter pin, fire perimeter, spread projections, and evac zones on a Mapbox map

Every live API call falls back gracefully to cached demo data on failure.

### Shelter ranking

Shelters are sorted by effective drive time after these adjustments:

| Rule | Effect |
|---|---|
| Mobility flag | Hard-filters out non-accessible shelters |
| Medical flag | Multiplies drive time by 0.8 for shelters with medical-grade power |
| Pets flag | Adds +30 min to shelters without a pet area |
| Near Full status | +10 min penalty |
| Filling status | +5 min penalty |
| Active road closure on path | +60 min per closure that lies between user and shelter |
| Route goes through fire | +200 min if straight-line path overlaps fire polygon by >0.03 degrees (~3 km) |

The fire-path penalty ensures users near the fire are routed to safe shelters (e.g. north to Vernon) rather than south through the fire perimeter.

### Map layers

The Layers panel toggles four groups independently:

- **Spread Projections** — Shapely-buffered fire spread at +2hr, +4hr, +6hr
- **Evac Zones** — evacuation order and alert polygons
- **Road Closures** — DriveBC closure markers
- **Shelters** — shelter pins

A Satellite toggle switches between the default dark style and Mapbox satellite imagery. All layer visibility state survives the style reload.

## Prerequisites

- **Node.js** 18+
- **Python** 3.11+
- **npm** (comes with Node)

## Getting Started

### 1. Clone and set up environment variables

```bash
git clone https://github.com/zorojuro12/gdsc_ember.git
cd gdsc_ember
```

**Backend** — create `backend/.env`:

```
DEMO_MODE=true
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_MAPS_API_KEY=AIza...
```

**Frontend** — create `frontend/.env`:

```
VITE_API_URL=http://localhost:8000
VITE_MAPBOX_TOKEN=your_mapbox_token
VITE_GOOGLE_MAPS_API_KEY=AIza...
```

> **Demo Mode** (`DEMO_MODE=true`, the default) works fully offline from static scenario files — no API keys required. Set `DEMO_MODE=false` to use live Google Maps and Anthropic APIs.

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The API will be running at `http://localhost:8000`. Check health at `http://localhost:8000/api/health`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be running at `http://localhost:5173`. The admin view is at `http://localhost:5173/admin`.

## Project Structure

```
frontend/
  src/
    views/
      ResidentView.tsx     Main resident briefing view
      AdminView.tsx        Operational admin dashboard
    components/
      Map.tsx              Mapbox map with layer toggles and satellite mode
      BriefingCard.tsx     Threat / route / shelter / closures display
      AddressInput.tsx     Address autocomplete input
      TopBar.tsx           Site header with nav links
      admin/
        SituationPanel.tsx Fire metrics grid
        RoadPanel.tsx      Active road closures list
        ShelterPanel.tsx   Shelter status cards with override buttons
        SimControls.tsx    Demo timeline advance and closure trigger
    hooks/
      useBriefing.ts       React Query — polls /api/briefing every 5 min
      useAdminSituation.ts React Query — polls /api/admin/situation every 30s
    contexts/
      AppConfigContext.tsx  Reads demo/live mode from /api/config
    types.ts               Shared TypeScript interfaces

backend/
  main.py                  FastAPI entrypoint and all API endpoints
  cache.py                 In-memory dict cache with TTL (no_expire flag for demo data)
  demo.py                  Loads scenario files into cache at startup (no_expire=True)
  demo_state.py            Mutable demo state: timeline step, closure list, shelter statuses
  geocode.py               Google Geocoding API wrapper
  directions.py            Google Directions API wrapper
  orchestrator.py          Runs agents, passes top shelter to route agent
  agents/
    threat.py              Fire distance + spread rate from perimeter + weather
    route.py               Evacuation route via Directions API or demo cache
    shelter.py             Shelter ranking with profile flags, closure and fire penalties
    profile.py             LLM briefing synthesis (Claude Sonnet) with template fallback

data/scenarios/2023-west-kelowna/
  mcdougall_creek_perimeter.geojson
  spread_2hr/4hr/6hr.geojson
  evac_order_zone.geojson
  evac_alert_zone.geojson
  road_closures.json
  shelters.json
  demo_route.json
  demo_briefing.json
  station_1277_weather.json
  2023-08-15.csv … 2023-08-19.csv
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Server health check |
| GET | `/api/config` | Returns `{ demo_mode: bool }` |
| GET | `/api/briefing?address=...` | Full evacuation briefing for a resident address |
| GET | `/api/admin/situation` | Fire situation for the admin dashboard |
| POST | `/api/admin/shelter/{id}/status` | Override a shelter's status |
| POST | `/api/admin/simulate/closure` | Activate a specific road closure |
| POST | `/api/admin/simulate/advance` | Advance the demo timeline by one step |
| POST | `/api/admin/simulate/reset` | Reset demo to initial state |

### Briefing query parameters

| Param | Type | Default | Description |
|---|---|---|---|
| `address` | string | `1240 Marble Terrace, West Kelowna, BC` | Resident's address |
| `mobility` | bool | false | Filters to accessible shelters only |
| `medical` | bool | false | Boosts shelters with medical-grade power infrastructure |
| `pets` | bool | false | Boosts pet-friendly shelters |
| `no_vehicle` | bool | false | Adds transit assistance info to briefing text |

## Environment Variables

| Variable | Where | Required | Description |
|---|---|---|---|
| `DEMO_MODE` | backend | No (default: `true`) | `true` = offline demo, `false` = live APIs |
| `ANTHROPIC_API_KEY` | backend | For live briefings | Claude Sonnet API key |
| `GOOGLE_MAPS_API_KEY` | backend | For live geocoding/routing | Google Maps Platform key |
| `VITE_API_URL` | frontend | Yes | Backend URL (e.g. `http://localhost:8000`) |
| `VITE_MAPBOX_TOKEN` | frontend | Yes | Mapbox GL JS access token |
| `VITE_GOOGLE_MAPS_API_KEY` | frontend | For address autocomplete | Google Maps JS API key |

## Fallback Safety

| API call | Fails gracefully to | User sees |
|---|---|---|
| Geocoding | Hardcoded demo coords (49.86, −119.58) | Briefing for default address |
| Directions (route) | Cached `demo_route.json` | Hardcoded Hwy 97 S route |
| Directions (drive times) | Haversine estimates | Geographically sensible ranking |
| Anthropic LLM | Template-composed briefing | Slightly more robotic text |
| All APIs down | Full demo mode behaviour | Identical to offline demo |

## Demo Timeline

The admin Sim Controls step through four real historical milestones from Aug 17, 2023:

| Step | Time | Event |
|---|---|---|
| 1 | 7:00 PM | Westside Road closed — fire moves toward Raymer Bay |
| 2 | 8:00 PM | DriveBC advisory for Hwy 97 (Glenrosa to Bennett Bridge) |
| 3 | 9:00 PM | Rose Valley & WK Estates evacuation order — 763 properties |
| 4 | 9:55 PM | Fire jumps Okanagan Lake — Kelowna state of emergency |

## License

MIT
