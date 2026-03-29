# EMBER session log

## Last session: Day 3 — Phase 1 backend scaffold

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
