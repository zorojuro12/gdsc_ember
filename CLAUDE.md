---
description: 
alwaysApply: true
---

# EMBER — BC Wildfire Community Evacuation Intelligence Platform

Real-time wildfire evacuation briefings using BC government open data.

Hackathon project — 4 members, 3-4 weeks, demo-first development.
Demo scenario: 2023 McDougall Creek Fire (K52767), Aug 15-19, West Kelowna.

---

## Tech Stack

- **Frontend:** React 18 + TypeScript (strict mode), Mapbox GL JS, Tailwind CSS, React Query
- **Backend:** Python 3.11+, FastAPI, Shapely (polygon geometry), pandas (CSV processing)
- **LLM:** Anthropic API — Claude Sonnet (one call per briefing, synthesis only)
- **Deployment:** Vercel (frontend), Railway (backend)

## Folder Structure

```
/frontend          — React app (Vite + TypeScript)
/backend           — FastAPI app
/data/scenarios/2023-west-kelowna/  — all demo scenario files (GeoJSON, JSON, CSV)
/docs              — project overview docx files for reference
```

## Architecture Rules

1. React NEVER calls external APIs directly — all requests go through FastAPI backend.
2. All 4 agents (Threat, Route, Shelter, Profile) run as async functions via `asyncio.gather` with 3-second timeout.
3. LLM is called ONCE per briefing refresh by the Profile Agent — all routing, ranking, and filtering logic runs BEFORE the LLM call in deterministic code.
4. Frontend polls `GET /api/briefing` every 5 minutes via React Query.

## Demo Mode (Critical)

- `DEMO_MODE=true` is the DEFAULT — must work 100% offline with zero external API calls.
- All data served from `/data/scenarios/2023-west-kelowna/` static JSON files.
- Demo scenario: 2023 McDougall Creek Fire (K52767), Aug 15-19, West Kelowna.
- The cache is pre-populated at startup from scenario files in Demo Mode.
- Demo Mode must be tested before every commit to dev or main.

---

## The 4 Agents

### Threat Agent
- **Input:** Fire perimeter + wind speed + wind direction from BCWS station 1277
- **Output:** Projected fire boundary at +2hr, +4hr, +6hr using Shapely `buffer()`, time-to-perimeter estimate for user address, spread rate classification (Low / Moderate / High / Extreme)

### Route Agent
- **Input:** User address + DriveBC closures + Google Maps Directions API
- **Output:** Ranked list of valid evacuation routes with closed segments flagged, recommended primary route and fallback route. Re-routes automatically when new closures appear.

### Shelter Agent
- **Input:** `shelters.json` + occupancy status + user accessibility flags
- **Output:** Ranked shelter list using: drive time (primary sort), accessibility (hard filter), pet (deprioritize non-pet shelters), medical (+20% drive time boost), near-full (+10min penalty)

### Profile Agent
- **Input:** User profile flags + outputs from all 3 other agents
- **Output:** Filtered/re-ranked recommendations → structured JSON → single LLM call → plain-language briefing

---

## The 5 Shelters (hardcoded in shelters.json — never fetched live)

| Facility | Capacity | Accessible | Pet-Friendly | Medical Power | Role |
|---|---|---|---|---|---|
| Royal LePage Place (West Kelowna) | ~600 | Yes | Yes | Yes | Reception Centre |
| Kal Tire Place (Vernon) | ~600 | Yes | No | Yes | Reception Centre |
| Princess Margaret School (Penticton) | ~250 | Yes | No | No | Reception Centre |
| Salvation Army (Kelowna) | ~300 | Yes | No | No | Reception Centre |
| Prospera Place (Kelowna) | ~500 | Yes | Yes | Yes | Group Lodging Only |

Capacity estimates use EMBC guidelines (~40 sq ft per person for shelter floor use), not venue seating capacity.

---

## Profile Flag Behaviors

| Flag | Effect on Shelters | Effect on Briefing |
|---|---|---|
| **Mobility** | Hard-filters shelters to `is_accessible=true` only. Does NOT filter routes for terrain. | Briefing adds: "Recommended shelter has confirmed accessible entry." |
| **Medical** | Soft-boosts shelters with `has_medical_power=true` (20% drive time reduction in ranking). Pre-calculated boolean, no live API calls. | Briefing adds: "This shelter has full electrical infrastructure for medical equipment." |
| **Pets** | Deprioritizes shelters with `has_pet_area=false`. Pet-friendly shelters (Royal LePage, Prospera) are boosted. | Briefing adds: "Recommended shelter accepts pets." If no pet-friendly shelter in range: "Contact shelter staff about pet accommodation on arrival." |
| **No Vehicle** | No change to shelter ranking. | Briefing adds: "If you need transportation assistance, call Emergency Support Services at 1-800-387-4258." |

---

## Caching (in-memory Python dict with TTL — no Redis, no file cache)

```python
TTL = {
    "fire_perimeter": 900,   # 15 minutes
    "drivebc": 300,           # 5 minutes
    "weather": 900,           # 15 minutes
    "directions": 600,        # 10 min (only refresh on input change)
}
```

Reference implementation in `backend/cache.py`:

```python
import time

_cache = {}

TTL = {
    "fire_perimeter": 900,
    "drivebc": 300,
    "weather": 900,
    "directions": 600,
}

def get(key):
    entry = _cache.get(key)
    if entry and time.time() - entry["ts"] < TTL.get(key.split(":")[0], 300):
        return entry["data"]
    return None

def set(key, data):
    _cache[key] = {"data": data, "ts": time.time()}
```

In Demo Mode, the cache is pre-populated at startup from scenario JSON files — TTLs are irrelevant since data never expires.

---

## API Keys

| Key | Purpose |
|---|---|
| `MAPBOX_TOKEN` | Map rendering (Mapbox GL JS) |
| `GOOGLE_MAPS_API_KEY` | Directions API for route calculation |
| `ANTHROPIC_API_KEY` | Claude Sonnet for briefing synthesis |
| `DEMO_MODE` | `true` (default) or `false` |

All keys live in `.env` file only — never committed to repo. `.env.example` with empty values IS committed.

---

## API Endpoints & Response Shapes

### GET /api/briefing?address=1240+Marble+Terrace,West+Kelowna,BC

Main resident endpoint. Returns threat assessment, route, shelter, closures, and briefing text.

```json
{
  "updated_at": "2023-08-17T21:55:00-07:00",
  "threat": {
    "distance_km": 7.4,
    "time_to_perimeter_hours": 4.2,
    "spread_rate": "HIGH",
    "wind": { "speed_kmh": 42, "direction": "NE" }
  },
  "route": {
    "summary": "Hwy 97 South via Boucherie Rd",
    "distance_km": 5.8,
    "duration_min": 8,
    "polyline": "q~ioHxlwxUQo@c@sA...",
    "fallback_summary": "Hwy 97C West to Merritt"
  },
  "shelter": {
    "id": "shelter_001",
    "name": "Royal LePage Place",
    "address": "2760 Cameron Rd, West Kelowna",
    "lat": 49.8587,
    "lng": -119.5827,
    "status": "Open",
    "is_accessible": true,
    "has_pet_area": true
  },
  "closures": [
    {
      "road": "Westside Rd",
      "status": "CLOSED",
      "lat": 50.025,
      "lng": -119.493
    },
    {
      "road": "Bear Creek Rd",
      "status": "CLOSED",
      "lat": 49.940,
      "lng": -119.518
    }
  ],
  "briefing_text": "Fire is 7.4 km from your address...",
  "fire_perimeter_geojson": "http://api/static/perimeter.geojson",
  "projections_geojson": [
    "http://api/static/spread_2hr.geojson",
    "http://api/static/spread_4hr.geojson",
    "http://api/static/spread_6hr.geojson"
  ]
}
```

### GET /api/admin/situation

Admin dashboard data. Returns fire info, evacuation counts, roads, shelters.

```json
{
  "fire": {
    "id": "K52767",
    "name": "McDougall Creek",
    "hectares": 1100,
    "spread_rate": "HIGH",
    "wind": { "speed_kmh": 42, "direction": "NE" },
    "perimeter_url": "/static/perimeter.geojson"
  },
  "evacuations": {
    "under_order": 2462,
    "under_alert": 4801
  },
  "roads": [
    {
      "road": "Westside Rd",
      "status": "CLOSED",
      "lat": 50.025,
      "lng": -119.493
    }
  ],
  "shelters": [
    {
      "id": "shelter_001",
      "name": "Royal LePage Place",
      "status": "Open",
      "capacity_estimate": 600,
      "is_accessible": true,
      "has_pet_area": true,
      "has_medical_power": true
    }
  ],
  "updated_at": "2023-08-17T21:55:00-07:00"
}
```

### POST /api/admin/shelter/{id}/status

Manual shelter status override.

```
Request:  { "status": "Filling" }
Response: { "id": "shelter_002", "status": "Filling", "updated_at": "..." }
```

### POST /api/admin/simulate/closure

Trigger a demo road closure.

```
Request:  { "closure_id": "closure_001" }
Response: { "active_closures": ["closure_001", "closure_004"], "updated_at": "..." }
```

### POST /api/admin/simulate/advance

Advance demo time.

```
Request:  { "hours": 2 }
Response: { "current_time": "2023-08-17T23:55:00-07:00", "timeline_step": 4 }
```

---

## LLM Prompt (Profile Agent → Claude Sonnet)

The Profile Agent assembles a structured JSON payload from all four agent outputs and sends it as a single API call. The LLM's only job is to synthesize this into a 3-4 sentence plain-language briefing. All decision logic (routing, ranking, filtering) happens in deterministic code before this call.

### System Prompt

```
You are EMBER, an emergency evacuation assistant for BC wildfire emergencies. Given structured data about a resident's situation, generate a 3-4 sentence plain-language evacuation briefing.

Be direct, specific, and actionable. Use no jargon. Include: distance to fire, time estimate, recommended route, shelter name, and any road closures to avoid. If accessibility flags are set, mention the relevant accommodation. Do not add disclaimers or caveats — the system labels projections on the map already.
```

### User Message (structured JSON input)

```json
{
  "threat": {
    "distance_km": 7.4,
    "time_to_perimeter_hours": 4.2,
    "spread_rate": "HIGH",
    "wind_speed_kmh": 42,
    "wind_direction": "NE"
  },
  "route": {
    "primary": "Hwy 97 South via Boucherie Rd",
    "distance_km": 5.8,
    "duration_min": 8,
    "fallback": "Hwy 97C West to Merritt"
  },
  "shelter": {
    "name": "Royal LePage Place",
    "address": "2760 Cameron Rd, West Kelowna",
    "status": "Open",
    "is_accessible": true,
    "has_pet_area": true
  },
  "closures": [
    "Westside Road — CLOSED (fire activity)",
    "Bear Creek Road — CLOSED (evacuation zone)"
  ],
  "profile": {
    "mobility": true,
    "medical": false,
    "pets": false,
    "no_vehicle": false
  }
}
```

### Expected LLM Output (plain text, 3-4 sentences)

```
Fire is 7.4 km from your address. At current wind speed (42 km/h NE), the projected boundary reaches your area in approximately 4.2 hours. Evacuate south via Hwy 97 S to Royal LePage Place — accessible entry confirmed, 5.8 km, about 8 minutes. Avoid Westside Road and Bear Creek Road, both closed due to fire activity.
```

---

## Fire Spread Projection Model

Uses Shapely `buffer()` on the existing fire perimeter polygon. Spread distance at each time step = ISI-derived rate of spread x time interval. Wind direction applies an asymmetric offset — larger buffer downwind, smaller upwind.

Generates three GeoJSON polygons: `spread_2hr.geojson`, `spread_4hr.geojson`, `spread_6hr.geojson`. For the demo, these are pre-computed and stored in the scenario folder.

**Time budget: max 4 hours.** A simple Shapely buffer with increasing radius looks convincing on stage. Do not over-engineer.

---

## Weather Data

CSV files from BCWS Datamart: `2023-08-15.csv` through `2023-08-19.csv`. Filter for station 1277 (West Kelowna). Key columns:

- `STATION_CODE` — filter for "1277"
- `HOURLY_WIND_SPEED` — km/h
- `HOURLY_WIND_DIRECTION` — degrees
- `HOURLY_WIND_GUST` — km/h
- `HOURLY_TEMPERATURE` — Celsius
- `HOURLY_RELATIVE_HUMIDITY` — %
- `HOURLY_INITIAL_SPREAD_INDEX` — ISI (used for spread rate)
- `HOURLY_FIRE_WEATHER_INDEX` — FWI

---

## Demo Timeline (from road_closures.json)

| Time | Event | Active Closures |
|---|---|---|
| Aug 17, 1:25 PM | 68 properties evacuated off Bear Creek Road | closure_004 |
| Aug 17, 7:00 PM | Westside Road closed — fire moves toward Raymer Bay | closure_004, closure_001 |
| Aug 17, 8:00 PM | DriveBC advisory for Hwy 97 (Glenrosa to Bennett Bridge) | closure_004, closure_001, closure_002 |
| Aug 17, 9:00 PM | Rose Valley & WK Estates evacuation order — 763 properties | closure_004, closure_001, closure_002, closure_003 |
| Aug 17, 9:55 PM | Fire jumps Okanagan Lake — Kelowna state of emergency | all 4 closures |

---

## Git Conventions

- Suggest a git commit after every completed task (new component, new endpoint, bug fix, config change)
- Never let more than 30 minutes of work go uncommitted
- Commit messages: one short sentence, max 120 characters, conventional commit format
- Prefixes: `feat:`, `fix:`, `docs:`, `chore:`, `style:` — nothing else
- Examples: `feat: add briefing card component`, `fix: shelter ranking ignoring pet flag`
- NEVER include "Co-authored-by" lines in commit messages
- NEVER include "Generated by" or "AI" attribution in commit messages
- Work on `dev` branch for daily coding
- Only merge `dev` → `main` when a full phase is complete and Demo Mode is tested
- No feature branches needed — solo developer workflow
- After every commit, check if `session-log.md` or `plan.md` should be updated

---

## Things Claude Should NEVER Do

- Never use Redis, Celery, or any external caching/queue system
- Never add new APIs or data sources not in this spec
- Never display false-precision shelter headcounts — Open/Filling/Near Full only
- Never make the frontend call external APIs directly — everything goes through FastAPI
- Never modify `shelters.json` or `road_closures.json` — these are verified research data
- Never use localStorage for anything except profile flag persistence
- Never add features not in the plan during Phase 6 (polish only)
- Never use subagents (multiplies token usage 4-7x on Pro plan)
