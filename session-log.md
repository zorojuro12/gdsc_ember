# EMBER session log

## Last session: Day 12 — Phase 2 bug fix and verification

### What was done
- Fixed blank map bug: `containerRef` was on an inner `absolute inset-0` div; Mapbox read `clientHeight = 0` at init time before CSS resolved the absolute positioning, causing the canvas to render at browser-default 300px height
- Fix: moved `containerRef` to the outer `relative w-full h-[65vh]` div (same as Phase 1) — Mapbox now reads the correct height immediately; legend and satellite button remain as absolute overlays inside it
- Map verified working: all layers render (spread rings, evac zones, perimeter, road closures, shelter pins, wind arrow, legend, satellite toggle)
- Committed: `fix: put containerRef on outer div so Mapbox canvas gets correct height`

### Decisions made
- `absolute inset-0` is unreliable as a Mapbox container because Mapbox reads container dimensions synchronously at construction time, before the browser resolves inherited absolute-positioning dimensions — always give Mapbox a direct-height container

### Next session
- Merge `dev` → `main` (Phase 2 complete and verified)
- Phase 3: backend agents (Threat, Route, Shelter, Profile) and demo data loading
