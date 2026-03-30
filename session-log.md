# EMBER session log

## Last session: Day 14 — Wire live Google Maps + Anthropic APIs

### What was done
- Created `backend/geocode.py` — Google Geocoding API wrapper; converts address to (lat, lng) with in-memory caching, returns None on failure
- Created `backend/directions.py` — Google Directions API wrapper; `get_route()` returns route + polyline, `get_drive_time()` returns minutes; both cache by origin+dest
- Rewrote `backend/orchestrator.py` — geocodes address first (live mode), passes (lat, lng) to all agents; falls back to demo coords (49.8625, -119.58) on geocoding failure
- Rewrote `backend/agents/threat.py` — accepts (lat, lng) instead of address string; always computes real haversine distance to fire perimeter (no more hardcoded 7.4 km in demo mode)
- Rewrote `backend/agents/shelter.py` — calls Directions API for real drive times per shelter (parallel asyncio.gather); falls back to hardcoded times from demo_route.json
- Rewrote `backend/agents/route.py` — calls Directions API for real route to nearest shelter; falls back to cached demo_route.json
- Rewrote `backend/agents/profile.py` — calls Claude Sonnet live when ANTHROPIC_API_KEY is set (Tier 3); falls back to Tier 1 (pre-generated cache in demo mode) or Tier 2 (template)
- Updated `backend/main.py` — scenario data now loads at startup in ALL modes (not just demo mode)
- Updated `backend/cache.py` — added TTL entries for geocode (1 hour) and drivetime (10 min)
- Created `backend/.env` and `backend/.env.example` with DEMO_MODE, ANTHROPIC_API_KEY, GOOGLE_MAPS_API_KEY
- Added `VITE_GOOGLE_MAPS_API_KEY` to `frontend/.env` and `frontend/.env.example`
- Updated `frontend/index.html` — conditionally loads Google Maps JS API script when key is present
- Rewrote `frontend/src/components/AddressInput.tsx` — Google Places Autocomplete with BC/Canada restriction and West Kelowna bias; graceful fallback to plain text input
- Installed `@types/google.maps` for TypeScript support
- All files use `from __future__ import annotations` for Python 3.8 compatibility

### Decisions made
- `DEMO_MODE` flag redefined: `true` = fully offline (cached data + pre-generated briefings); `false` = live APIs with fallback to cached data on failure
- Scenario data (perimeter, closures, weather, shelters) always loads from files at startup regardless of mode — agents compute against real scenario data even in live mode
- Threat agent now always computes real distance from user coords to fire perimeter (1.31 km for demo address vs old hardcoded 7.4 km) — more accurate but changes the briefing numbers
- Every live API call fails gracefully: geocode → demo coords, directions → demo_route.json, LLM → template briefing

### Tested
- `DEMO_MODE=true`: briefing returns with all agent outputs, Tier 1 pre-generated briefing text, demo route + closures — works 100% offline
- `DEMO_MODE=false` (no API keys): geocoding warns and falls back to demo coords, directions falls back to demo_route.json, briefing uses Tier 2 template — fully functional
- Profile flags (pets, mobility) correctly affect shelter ranking and briefing text in both modes
- Admin endpoints (`/api/admin/situation`, shelter status, closure simulation) all working

### Next session
- Add real API keys to `backend/.env` and `frontend/.env` and test live geocoding + directions + LLM
- Phase 5: Admin View frontend (SituationPanel, RoadPanel, ShelterPanel, SimControls)
- Implement `POST /api/admin/simulate/advance` — advance demo timeline
- Commit and push all changes

---

## Previous: Day 13 — Phase 3 backend agents complete

### What was done
- Generated `station_1277_weather.json` from BCWS CSV files (station 1277, Aug 15-19, 120 hourly records)
- Created `demo_route.json` with primary route (Hwy 97 S, 5.8 km, 8 min), fallback (Hwy 97C), and per-shelter drive times
- Created `demo_briefing.json` with pre-written briefings for 5 profile flag variants (default, mobility, medical, pets, no_vehicle)
- Implemented `backend/demo_state.py` — mutable module-level singleton; `reset()`, `get_state()`, `set_shelter_status()`, `set_active_closures()`
- Implemented `backend/agents/threat.py` — haversine-based distance to perimeter, ISI→spread rate, demo mode returns hardcoded 7.4 km/4.2 hr values for narrative consistency
- Implemented `backend/agents/route.py` — reads pre-computed route from cache, builds active closures from demo_state
- Implemented `backend/agents/shelter.py` — full ranking algorithm: mobility hard filter, medical boost (×0.8), pets +30 min penalty, Near Full +10 min, Filling +5 min
- Implemented `backend/agents/profile.py` — 3-tier briefing: Tier 1 cache lookup, Tier 2 template, Tier 3 live Anthropic API
- Implemented `backend/orchestrator.py` — `asyncio.gather` with 3s timeout per agent, returns None on failure
- Updated `backend/demo.py` — `load_demo_data()` populates 9 cache keys + calls `demo_state.reset()`
- Updated `backend/main.py` — wired `/api/briefing`, `/api/admin/situation`, `/api/admin/shelter/{id}/status`, `/api/admin/simulate/closure`; mounted StaticFiles at `/static`
- Created `backend/scripts/generate_demo_briefings.py` — one-time script to regenerate briefings with live Claude API

### Decisions made
- Demo threat agent returns hardcoded 7.4 km / 4.2 hr values: the actual perimeter vertex nearest the demo address is ~1.3 km, but that matches a different time window and breaks the pre-generated briefing narrative
- Python 3.8 compatible: removed `list[str]`, `dict | None`, `tuple[T, U]` type hints — system runs Python 3.8
- Profile agent uses `flag_key()` to map profile flags to the 5 pre-generated briefing variants; only the first set flag is matched (demo scenarios test one flag at a time)
