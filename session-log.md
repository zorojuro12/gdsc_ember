# EMBER session log

## Last session: Day 10 — Fire spread projection rings

### What was done
- Added 3 spread ring sources/layers to `Map.tsx` using the existing `bboxPolygon` helper
- Rings use a `spreadRings` array iterated with a `for...of` loop — avoids repeating source/layer add calls 3 times
- Layer insertion order: 6hr (9km, opacity 0.06) → 4hr (6km, 0.10) → 2hr (3km, 0.15) — placed before evac zones so all existing layers render on top
- Each ring: orange fill (#D85A30) + dashed orange outline (`[3, 2]` dasharray, 1px)
- TypeScript check passes clean
- Committed: `feat: add fire spread projection ring placeholders`

### Decisions made
- Spread rings inserted before evac zones in the draw call sequence — no Mapbox layer reordering needed, just correct insertion order
- Placeholder bbox polygons; will be swapped for real Shapely-computed GeoJSON in Phase 3 by updating each source's `data`

### Next session
- Phase 2 continued: wind vector arrows, map legend component, satellite/street toggle
