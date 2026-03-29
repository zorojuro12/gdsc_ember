# EMBER session log

## Last session: Day 8 — Road closure lines on map

### What was done
- Copied `road_closures.json` to `frontend/public/` for static serving
- Updated `Map.tsx`: fetches perimeter + road_closures concurrently with `Promise.all`
- Builds a GeoJSON FeatureCollection of LineString features from `coordinates_from`/`coordinates_to`; swaps `{ lat, lng }` → `[lng, lat]` for Mapbox
- Source `road-closures`, two layers: `road-closures-line` and `road-closures-labels`
- Line layer: data-driven color (CLOSED=#E24B4A 4px, ADVISORY=#EF9F27 3px), fixed `line-dasharray: [4, 2]` (dasharray doesn't support data-driven expressions in Mapbox GL)
- Labels layer: `symbol-placement: 'line'`, `text-field: road_name`, color matches status, white halo for legibility
- TypeScript check passes clean
- Committed: `feat: add road closure lines to map`

### Decisions made
- Single source + single line layer with data-driven expressions — cleaner than two separate layers
- `line-dasharray` is fixed (not per-feature) — Mapbox GL limitation; both CLOSED and ADVISORY get `[4, 2]`

### Next session
- Phase 2 continued: shelter pins layer from `shelters.json`
