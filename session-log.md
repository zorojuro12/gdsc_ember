# EMBER session log

## Last session: Day 7 — Evacuation zone overlays

### What was done
- Updated `Map.tsx`: on load, fetches `/mcdougall_creek_perimeter.geojson`, computes bounding box from all coordinates, builds two rectangular placeholder polygons
- Evac Alert zone: 5km bbox buffer, orange (#EF9F27), fill opacity 0.08, line width 1.5
- Evac Order zone: 2km bbox buffer, red (#E24B4A), fill opacity 0.12, line width 1.5
- Layer order (bottom to top): alert fill → alert line → order fill → order line → perimeter fill → perimeter line
- km→degrees conversion uses lat 49.86°: `KM_LAT = 1/111`, `KM_LNG = 1/(111*cos(49.86°))`
- Async fetch inside `map.on('load')` wrapped with `void (async () => {...})()` to satisfy no-floating-promises
- TypeScript check passes clean
- Committed: `feat: add evacuation zone overlays on map`

### Decisions made
- Rectangular bbox polygons — visually sufficient for demo, fast to compute, no Shapely/turf dependency in frontend
- Single fetch of perimeter GeoJSON (already served from `public/`) — reused for bbox, then Mapbox fetches it again for the perimeter source (two fetches total, both cached by browser)

### Next session
- Phase 2 continued: road closure layer from `road_closures.json`, shelter pins layer
