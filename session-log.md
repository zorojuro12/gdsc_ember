# EMBER session log

## Last session: Day 18 — Road closure geometry, blue dot fix, demo address, fire pulse

### What was done

**Road closure snapping (all 4 closures)**
- Expanded `SNAPPED_CLOSURE_IDS` in `Map.tsx` from pilot (closure_001) to all 4 closures
- Updated `snap_closures_to_roads.py`: added `call_directions()` function using Mapbox Directions API for 2-point endpoint overrides; Map Matching used for multi-point traces, Directions used when override has exactly 2 waypoints (Map Matching returns 422 on sparse 2-point traces spanning >a few km)
- Added `radiuses=50` per-point parameter to Map Matching calls — default 5m snap radius was silently dropping hand-traced waypoints
- `CLOSURE_OVERRIDES` dict: closure_001 (Westside Road) and closure_004 (Bear Creek Road) use user-provided GPS coordinates for start/end; closure_002 (Hwy 97) and closure_003 (Rose Valley) use Map Matching on existing waypoints
- Regenerated `road_closures_geometry.geojson`: closure_001 = 25.73km via Directions, closure_002 = 12.67km via Matching, closure_003 = 3.55km via Matching, closure_004 = 1.88km via Directions
- `closureFeatures` in `Map.tsx` now filters out snapped IDs so they don't double-render as waypoint dots
- Added `road-closures-snapped` source + `road-closures-snapped-line` + `road-closures-snapped-labels` layers; all 4 IDs added to `LAYER_GROUPS.closures`

**Blue dot z-order fix**
- Root cause: user-location source/layers were created dynamically in `updateUserLocation()` — timing race meant they could land beneath fire/evac/closure layers depending on when briefing data arrived
- Fix: moved user-location source + glow + dot layer creation into `addAllLayers()` at the very end (after wind layers), initialised with empty FeatureCollection — guarantees top z-position
- `updateUserLocation()` simplified to only `setData` + unconditional `moveLayer` calls (no more layer creation logic)
- Bumped dot radius 8→9, glow radius 18→20, glow opacity 0.25→0.3

**Demo address update (1598 Westlake Rd)**
- Updated all demo address references: `orchestrator.py` (DEMO_LAT/DEMO_LNG + DEMO_ADDRESS_MAP key), `main.py` default query param, `AddressInput.tsx` placeholder
- Updated `generate_demo_route.py` ORIGIN coordinates; regenerated `demo_route.json` via Mapbox Directions — 5.2km, ~8min, 160 vertices, route "Westlake Road, BC 97 South", polyline start 12m from address pin
- Regenerated `demo_briefing.json`: "Fire is 260 metres from your address and closing fast — evacuate now..." — all 5 profile variants updated for new address and real threat distance
- Wind label in `Map.tsx` corrected from "42 km/h NE" (old hardcoded) to "17.8 km/h E" (actual station 1277 data for Aug 17 7PM)

**Fire perimeter pulsing animation**
- Added `startFirePulse(map)` function — `requestAnimationFrame` loop oscillating `fire-perimeter-fill` opacity on a 2.5s sine cycle (0.08–0.25 range)
- Returns cleanup function; `cancelPulse` variable cancels loop on map cleanup and `style.load` re-init

### Decisions made
- Directions API for 2-point overrides, Map Matching for multi-point traces — established pattern going forward
- 1598 Westlake Rd chosen as demo address: 260m from fire perimeter, inside evac order zone, clear route south — compelling visual (blue dot near fire edge)
- Per-point `radiuses=50` for Map Matching — necessary for hand-traced waypoints, no visible quality degradation on output

### Known issues / next steps
- Visual QA of blue dot at 1598 Westlake Rd still needed (fix just applied)
- Visual QA of all 4 snapped closure geometries still needed
- Consider auto-advance button in SimControls (20-min improvement for demo recording)
- Demo Day prep: 5-min presentation + 20-min 1-on-1 judge demo

---

## Previous: Day 17 — Shelter geography bug fix

### What was done
- Fixed critical shelter ranking bug: north Westside Rd users were being recommended Prospera Place (Kelowna, through fire) instead of Kal Tire Place (Vernon, north and safe)
- Root cause: shelter.py used haversine drive-time estimates for non-default users, which ranked Prospera at ~15 min vs Kal Tire at ~62 min, ignoring that the Prospera route goes through the active fire perimeter
- **Fix**: Added Shapely path-intersection penalty in `shelter.py` — if the straight-line user→shelter path overlaps the fire polygon by >0.03 degrees (~3 km), add +200 min effective-time penalty. Loads `fire_perimeter:K52767` from cache at run time.
- **Result**: North user now correctly gets Kal Tire (eff=122 min) over Prospera (eff=275 min); default user still gets Royal LePage (eff=8 min) with Kal Tire heavily penalised (eff=385 min, path goes north through fire)
- Also added haversine fallback for demo mode (when user ≠ default address) and closure-corridor blocking (+60 min per active closure geometrically between user and shelter)
- Fixed shelter/route mismatch: orchestrator now runs threat+shelter in parallel first, then passes `top_shelter` to route agent so both cards always show the same shelter
- Fixed `distance_km = None` crash in BriefingCard when route agent returns null distance for non-default shelters in demo mode

### Decisions made
- Used fire polygon intersection length (coordinate degrees) with binary threshold (>0.03 = danger) rather than proportional penalty — cleaner separation between "skims the edge" (Kal Tire: 0.027) and "cuts through fire" (Prospera: 0.034)
- Closure-corridor blocking uses simple lat-interval + lng-proximity check (`lng_threshold=0.08`) — good enough for demo, no road network data needed
- Fire perimeter hardcoded as `fire_perimeter:K52767` (demo-only scenario, acceptable for hackathon)

### Known issues / next steps
- Blue dot (user location on map) still not rendering — deferred
- Phase 5 git merge to main pending (after demo mode test)
- Phase 6: offline test, polish, responsive layout check, deployment

---

## Previous: Day 16 — Phase 5 Admin View complete

### What was done
- Added layer toggle panel to `Map.tsx` — "Layers" button opens a panel with checkboxes for Spread Projections, Evac Zones, Road Closures, Shelters. Uses `setLayoutProperty(..., 'visibility', ...)`. State stored in `layerVisRef` so it survives satellite style reloads.
- Set up React Router: `BrowserRouter` in `main.tsx`, `App.tsx` becomes router-only, resident view moved to `views/ResidentView.tsx`, admin view at `views/AdminView.tsx`
- Admin layout: `h-screen flex flex-col`, header + 60/40 map/panel split. Same `Map.tsx` reused (layer + satellite toggles work on admin map too). "← Resident View" back link. "Admin" link added to resident `TopBar.tsx`.
- Implemented `SituationPanel.tsx` — 2×3 metric card grid: fire name/ID, perimeter (ha), spread rate badge, wind, last updated time, properties under order/alert. Skeleton while loading.
- Implemented `RoadPanel.tsx` — colored dot + road name + status badge (CLOSED=red, ADVISORY=amber, OPEN=green). "No active road events" empty state.
- Implemented `ShelterPanel.tsx` — per-shelter card with name, status badge, capacity, accessibility tags, and 3 override buttons (Open/Filling/Near Full). Active status highlighted in matching color. Calls `POST /api/admin/shelter/{id}/status` via `onStatusChange` prop wired in `AdminView`.
- Implemented `SimControls.tsx` — Demo Time display (current sim time + step counter), closure dropdown (inactive closures only), [Advance to Next Step] (disabled + relabeled at last step), [Reset].
- Rewrote `backend/demo_state.py` — `TIMELINE` list of 4 full-snapshot milestones (7PM/8PM/9PM/9:55PM). `advance_time()` increments step by 1, capped at 4, applies milestone's closures + shelter statuses atomically. `reset()` restores step 1.
- Implemented `POST /api/admin/simulate/advance` (no body) and `POST /api/admin/simulate/reset` in `main.py`.
- Updated `GET /api/admin/situation` — evacuations now from state (not hardcoded), adds `timeline_step`, `max_step`, `active_closure_ids` to response, weather lookup now uses hour from `current_time` instead of hardcoded 19.
- Added `AdminSituationResponse` type fields: `timeline_step`, `max_step`, `active_closure_ids`.
- Added Demo/Live badge to admin header — gray "DEMO" or pulsing red "LIVE" pill from `AppConfigContext`.
- Added `useAdminSituation` hook — polls `GET /api/admin/situation` every 30s.

### Decisions made
- Admin map reuses `Map.tsx` — no separate component. Layer toggle kept on admin map.
- Timeline uses full snapshots per step, not incremental diffs — simpler reset, no drift.
- Advance = always +1 step (not arbitrary hours) — guarantees operator sees every closure escalation in order.
- Evacuation counts kept constant across all steps (2,462 order / 4,801 alert) — sourced numbers, drama comes from shelter/closure changes instead.
- Demo/Live badge is static (read from env via `/api/config`), no runtime toggle.
- `active_closure_ids` added to situation response to avoid fragile road-name-to-ID reverse mapping in frontend.

### Known issues / next steps
- Census vulnerability overlay (stretch goal) — skipped, not critical for demo
- Phase 5 git merge to main pending (after demo mode test)
- Phase 6: offline test, polish, responsive layout check, deployment

---

## Previous: Day 15 — Evac zone south boundary fix + BriefingCard null-safety

### What was done
- Added real API keys to `backend/.env` and `frontend/.env`
- Fixed critical bug: `os.getenv()` was called at module import time (before `load_dotenv()` ran in `main.py`), so API keys were always empty — moved all env var reads to call time in `geocode.py`, `directions.py`, `profile.py`
- Increased orchestrator agent timeout from 3s to 10s — shelter agent's 5 parallel Directions API calls were exceeding the old limit and returning `None`
- Added null-safety for `shelter` in `BriefingCard.tsx` — page was crashing with "Cannot read properties of null (reading 'name')" when shelter timed out
- Added `user_location` field to `/api/briefing` response — returns geocoded `{lat, lng}` from orchestrator
- Added `updateUserLocation()` to `Map.tsx` with blue dot + glow layers and `flyTo()` on address change — code is wired but dot not rendering yet (known issue, needs debugging)
- Updated README with full architecture, env var table, fallback safety table, and correct project structure

### Tested with live APIs
- Google Geocoding: resolves "1240 Marble Terrace, West Kelowna, BC" to (49.863612, -119.5644584)
- Google Directions: returns real route "BC-97 N and Boucherie Rd" with full encoded polyline (302 chars vs 80-char demo)
- Anthropic Claude Sonnet: generates fresh briefing — "LEAVE NOW. The fire is 1.6 km away..." — dynamic, urgent, uses real computed data
- Route polyline renders correctly on Mapbox map
- Shelter ranking works with real drive times from Directions API
- Address autocomplete dropdown appears when typing (Google Places API)

### Bugs found and fixed
- Env var load order: `load_dotenv()` in `main.py` runs after module-level `os.getenv()` in imported modules → keys always empty
- 3-second timeout too tight for 5 parallel Directions API calls → shelter agent returning None → BriefingCard crash
- `BriefingCard.tsx` accessing `shelter.name` without null check

### Known issues
- Blue dot for user location not rendering on map — `updateUserLocation()` code exists in `Map.tsx` but the layer doesn't appear visually. Likely a Mapbox layer ordering or React effect timing issue. Low priority — everything else works.
- Google Places Autocomplete deprecation warning in console (use `PlaceAutocompleteElement` instead) — functional but should migrate eventually

### Next session
- Debug blue dot rendering on map (check if useEffect fires, check layer z-order)
- Phase 5: Admin View frontend (SituationPanel, RoadPanel, ShelterPanel, SimControls)
- Implement `POST /api/admin/simulate/advance` — advance demo timeline
- Push to origin

---

## Previous: Day 14 — Wire live Google Maps + Anthropic APIs

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

---

## Day 15 — Evac zone south boundary fix + BriefingCard null-safety

### What was done
- Identified evac zone south floor bug from screenshot: `SOUTH_FLOOR_LAT = 49.90` was clipping both zones ~3.3 km north of the fire perimeter's actual southern edge, making the fire perimeter visually extend outside the order zone
- Fixed `backend/scripts/generate_evac_zones.py`: replaced single shared `SOUTH_FLOOR_LAT` with per-zone floors in the `EVAC_ZONES` list
  - Order zone floor: **49.87** — sits 0.002° south of fire perimeter edge (49.8721), fully containing it
  - Alert zone floor: **49.865** — extends slightly further south than order zone
- Verified all 4 constraints programmatically: fire perimeter south tip inside both zones ✓, Royal LePage (49.8587) outside both zones ✓
- Regenerated `evac_order_zone.geojson` and `evac_alert_zone.geojson`, synced to `frontend/public/`
- Added null-safety for `route` in `BriefingCard.tsx` — wraps Route section in `{route && (...)}` matching existing shelter null-guard pattern

### Decisions made
- Per-zone floors instead of a shared constant — order and alert zones need different southern extents by design (alert extends slightly beyond order)
- Floor values chosen tight against real geography: 49.87 is only ~150m south of where the fire perimeter actually ends, leaving a ~900m gap above Royal LePage (49.8587)

### Next session
- Phase 5: Admin view — SituationPanel, RoadPanel, ShelterPanel, SimControls, `/admin` route
- Implement `POST /api/admin/simulate/advance`
- Investigate blue dot user location layer (appeared to self-resolve, root cause unknown)
