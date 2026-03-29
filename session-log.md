# EMBER session log

## Last session: Day 9 — Shelter pins on map

### What was done
- Copied `shelters.json` to `frontend/public/` for static serving
- Added `shelters.json` to the existing `Promise.all` fetch (now fetches perimeter, closures, and shelters in parallel)
- Added `Shelter` type, built Point FeatureCollection with `status: 'Open'` defaulted on each feature
- Source `shelters`, two layers: `shelter-pins` (circle) and `shelter-labels` (symbol)
- Circle layer: radius 12, data-driven color (Open=#639922, Filling=#EF9F27, Near Full=#E24B4A default), white 2px stroke
- Labels: `text-offset: [0, 1.8]`, `text-anchor: top` places name below the pin; white halo for legibility
- TypeScript check passes clean
- Committed: `feat: add shelter pins with status colors to map`

### Decisions made
- `status: 'Open'` hardcoded in feature properties for now — color expression is fully wired so Phase 5 dynamic status just needs to update the GeoJSON source data
- All three static files now fetched in one `Promise.all` — no sequential waterfall

### Next session
- Phase 2 continued: fire spread projection rings, wind vector arrows, map legend component
