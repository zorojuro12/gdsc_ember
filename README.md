# EMBER — BC Wildfire Community Evacuation Intelligence Platform

Real-time wildfire evacuation briefings using BC government open data. Built for the GDSC Hack the Sem hackathon.

**Demo scenario:** 2023 McDougall Creek Fire (K52767), Aug 15–19, West Kelowna, BC.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript, Vite, Tailwind CSS v4, Mapbox GL JS, React Query |
| Backend | Python 3.8+, FastAPI, Shapely, pandas |
| LLM | Anthropic Claude Sonnet (single call per briefing) |
| APIs | Google Maps (Geocoding, Directions, Places Autocomplete) |
| Deploy | Vercel (frontend), Railway (backend) |

## How It Works

1. User enters an address → **Google Geocoding** converts it to lat/lng
2. Four agents run in parallel:
   - **Threat Agent** — computes distance from address to fire perimeter using Shapely
   - **Route Agent** — gets real driving route via **Google Directions API**
   - **Shelter Agent** — ranks 5 shelters by real drive time (Directions API, parallel)
   - **Profile Agent** — assembles structured data and calls **Claude Sonnet** for a plain-language briefing
3. Frontend renders the briefing, route polyline, shelter pin, and fire layers on a Mapbox map

Every live API call falls back gracefully to cached demo data on failure.

## Prerequisites

- **Node.js** 18+
- **Python** 3.8+
- **npm** (comes with Node)

## Getting Started

### 1. Clone and set up environment variables

```bash
git clone https://github.com/zorojuro12/gdsc_ember.git
cd gdsc_ember
```

**Backend** — create `backend/.env`:

```
DEMO_MODE=false
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_MAPS_API_KEY=AIza...
```

**Frontend** — create `frontend/.env`:

```
VITE_API_URL=http://localhost:8000
VITE_MAPBOX_TOKEN=your_mapbox_token
VITE_GOOGLE_MAPS_API_KEY=AIza...
```

> **Demo Mode** (`DEMO_MODE=true`) works fully offline from static scenario files — no API keys required. Set `DEMO_MODE=false` for live API calls.

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

The app will be running at `http://localhost:5173`.

## Project Structure

```
frontend/                React app (Vite + TypeScript)
  src/components/        UI components (Map, BriefingCard, AddressInput, etc.)
  src/hooks/             React Query hooks (useBriefing)
backend/                 FastAPI app
  main.py                App entrypoint, all API endpoints
  cache.py               In-memory dict cache with TTL
  demo.py                Demo data loader (pre-populates cache from scenario files)
  demo_state.py          Mutable demo state (closures, shelter statuses, timeline)
  geocode.py             Google Geocoding API wrapper
  directions.py          Google Directions API wrapper
  orchestrator.py        Runs agents in parallel, coordinates the pipeline
  agents/                The 4 agent modules
    threat.py            Fire distance + spread rate from perimeter + weather
    route.py             Evacuation route via Directions API or cached demo route
    shelter.py           Shelter ranking with profile-based adjustments
    profile.py           LLM briefing synthesis (Claude Sonnet) with template fallback
data/scenarios/          Static demo scenario files
  2023-west-kelowna/     McDougall Creek fire data (GeoJSON, JSON, CSV)
docs/                    Project overview documents
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Server health check |
| GET | `/api/config` | Returns demo mode status |
| GET | `/api/briefing?address=...` | Full evacuation briefing for a resident |
| GET | `/api/admin/situation` | Fire situation summary for admin dashboard |
| POST | `/api/admin/shelter/{id}/status` | Override shelter status |
| POST | `/api/admin/simulate/closure` | Activate a road closure in demo |
| POST | `/api/admin/simulate/advance` | Advance demo clock |

### Briefing query parameters

| Param | Type | Default | Description |
|---|---|---|---|
| `address` | string | `1240 Marble Terrace, West Kelowna, BC` | User's address |
| `mobility` | bool | false | Accessibility needs — filters to accessible shelters only |
| `medical` | bool | false | Medical equipment — boosts shelters with power infrastructure |
| `pets` | bool | false | Pets — boosts pet-friendly shelters |
| `no_vehicle` | bool | false | No vehicle — adds transit info to briefing |

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
| Geocoding | Hardcoded demo coords (49.86, -119.58) | Briefing for default address |
| Directions (route) | Cached `demo_route.json` | Hardcoded Hwy 97 S route |
| Directions (drive times) | Hardcoded per-shelter times | Same ranking as before |
| Anthropic LLM | Template-composed briefing | Slightly more robotic text |
| All APIs down | Full demo mode behavior | Identical to offline demo |

## License

MIT
