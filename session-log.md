# EMBER session log

## Last session: Day 13 — Phase 3 backend agents complete

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

### Next session
- Phase 3 testing: install backend deps (`pip install -r requirements.txt`) and test `/api/briefing` HTTP endpoint
- Phase 4: Resident View frontend components (TopBar, AddressInput, ProfileFlags, BriefingCard, AlertBanner)
- Wire React Query polling to `/api/briefing`
