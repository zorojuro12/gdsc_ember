# EMBER session log

## Last session: Day 5 — Mapbox map with fire perimeter

### What was done
- Created `frontend/src/components/Map.tsx` — Mapbox GL JS map, full-width `h-[65vh]`, centered West Kelowna (-119.58, 49.86), zoom 11, streets-v12 style
- On `map.on('load')`: adds `fire-perimeter` GeoJSON source and two layers — fill (#E24B4A, 0.15 opacity) and line (#A32D2D, width 2)
- GeoJSON copied to `frontend/public/mcdougall_creek_perimeter.geojson` and referenced as `/mcdougall_creek_perimeter.geojson` (Vite serves public/ at root)
- Replaced scaffold `App.tsx` with minimal wrapper that renders `<Map />`
- TypeScript check passes clean
- Committed: `feat: add Mapbox map with McDougall Creek fire perimeter`
- Checked off plan.md Phase 1 items for Map component and perimeter layer

### Decisions made
- GeoJSON served from `frontend/public/` (not imported as JSON module) — Mapbox loads it via URL, works offline, avoids outside-Vite-root import issues
- `useRef` guard (`if (mapRef.current) return`) handles React 19 StrictMode double-mount cleanly

### Next session
- Phase 1 continued: deploy frontend to Vercel, deploy backend to Railway

---

## Session: Day 4 — Demo Mode toggle wiring

### What was done
- Backend (`main.py`) already had `DEMO_MODE` from dotenv and `GET /api/config` — no changes needed
- Created `frontend/src/contexts/AppConfigContext.tsx` — `AppConfigProvider` fetches `/api/config` on mount, stores `{ demoMode: boolean }` in React context, logs to console. Falls back to `demoMode: true` on fetch error (keeps app usable offline)
- Updated `frontend/src/main.tsx` — wraps app with `QueryClientProvider` (React Query setup) and `AppConfigProvider`
- Created `frontend/.env.example` with `VITE_API_URL` and `VITE_MAPBOX_TOKEN` stubs
- TypeScript check passes clean
- Committed: `feat: wire Demo Mode toggle with /api/config endpoint`
- Checked off plan.md Phase 1 Demo Mode toggle item

### Decisions made
- Backend CORS already uses `allow_origins=["*"]` — covers `localhost:5173`, no change needed
- `VITE_API_URL` env var with fallback to `http://localhost:8000` — overridable at Vercel deploy time
- `QueryClientProvider` set up now at `main.tsx` level so all future `useQuery` hooks work without additional setup
- Error fallback defaults to `demoMode: true` — safe offline behavior

### Next session
- Phase 1 continued: base Mapbox GL JS map component (`frontend/src/components/Map.tsx`)

---

## Session: Day 3 — Phase 1 backend scaffold

### What was done
- Created `backend/requirements.txt` with all deps: `fastapi`, `uvicorn[standard]`, `shapely`, `pandas`, `anthropic`, `httpx`, `python-dotenv`
- Created `backend/main.py` — FastAPI app skeleton with CORS middleware, lifespan hook for demo data loading, and stub endpoints for all API contracts in CLAUDE.md (`/api/config`, `/api/health`, `/api/briefing`, `/api/admin/situation`, shelter status override, closure simulation, time advance)
- Created `backend/cache.py` — in-memory dict cache with TTL exactly matching CLAUDE.md spec, plus a `clear()` helper for demo reset
- Created `backend/demo.py` stub — placeholder for `load_demo_data()` implemented fully in Phase 3
- Syntax-checked all backend Python files
- Committed: `feat: scaffold FastAPI backend with cache module and API stubs`
- Checked off plan.md lines 21–23

### Decisions made
- `demo.py` stubbed now so `main.py` can import it cleanly — full implementation deferred to Phase 3
- `cache.clear()` added beyond the CLAUDE.md spec to support demo reset (Phase 5)

### Blockers
- No Python 3.11+ in local WSL environment — Railway will provide the runtime at deploy time

### Next session
- Phase 1 continued: wire Demo Mode toggle (`GET /api/config`), base Mapbox map component

---

## Session: Day 2 — Phase 1 frontend scaffold

### What was done
- Created `dev` branch — all daily coding now on `dev`, merge to `main` only when a full phase is complete
- Initialized Vite + React + TypeScript frontend in `/frontend` using `create-vite@latest` with `react-ts` template
- Installed core frontend deps: `tailwindcss`, `mapbox-gl`, `@tanstack/react-query`, `react-router-dom`
- Configured Tailwind CSS v4 using `@tailwindcss/vite` plugin (no `tailwind.config.js` needed in v4)
- Replaced default Vite `index.css` with clean `@import "tailwindcss"` base styles
- Verified clean production build (`npm run build` passes)
- Added Cursor rules: `function-comments.mdc`, `git.mdc` — enforce comment style and commit conventions
- Updated `CLAUDE.md` Git Conventions section to match new solo-developer workflow
- Committed: `feat: scaffold Vite React TS frontend with Tailwind v4 and core deps`
- Checked off plan.md lines 18–20

### Decisions made
- Tailwind v4 (latest) — uses Vite plugin, no `tailwind.config.js` or `postcss.config.js` required
- Solo developer workflow: no feature branches, work directly on `dev`

### Blockers
- None

### Next session
- Phase 1 continued: initialize FastAPI backend (`main.py`, `requirements.txt`), `backend/cache.py`, Demo Mode toggle
