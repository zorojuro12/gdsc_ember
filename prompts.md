# EMBER — Daily Workflow & Prompts

Solo developer reference. Keep on desktop, don't commit to repo.

---

## Your Daily Workflow

1. Open project in Cursor
2. Check plan.md — find the next unchecked item
3. Build it using Cursor Agent (Ctrl+I)
4. Test it works (especially Demo Mode)
5. Commit: `git add -A && git commit -m "feat: [what you built]"`
6. Repeat steps 2-5 until done for the day
7. End of day: update session-log.md and plan.md (check off completed items)
8. Push: `git push origin dev`

That's it. No extra planning docs needed for most tasks.

---

## When to Use Which Tool

| Situation | Tool | Why |
|---|---|---|
| Build a component or endpoint | Cursor Agent (Ctrl+I) | Fast, uses Cursor subscription not Claude tokens |
| Quick question while coding | Cursor Chat (Cmd+L) | Free, instant |
| Complex multi-file wiring (agents, orchestrator) | Claude Code + Sonnet | Better at coordinating across many files |
| Stuck on architecture decision | Claude Code + Opus (plan mode) | Use sparingly — max 2-3 times total |
| Claude is rate-limited | Gemini in VS Code | Good backup for review and debugging |
| Generate test files | Codex | Save Claude tokens, Codex is fine for tests |

---

## Cursor Agent Prompts (Ctrl+I) — Your Main Tool

### Simple Task (most plan.md items)
```
[Describe what to build]. Follow the conventions in CLAUDE.md.
```

That's usually enough. Cursor already has your CLAUDE.md loaded via the rules.
Examples:

```
Create frontend/src/components/MapLegend.tsx — a legend showing color keys
for fire perimeter (red), projection (orange), road closures (red lines),
shelters (green/amber/red dots). Use Tailwind CSS.
```

```
Add a GET /api/config endpoint to backend/main.py that returns
{"demo_mode": true/false} based on the DEMO_MODE env var.
```

```
Add road closure lines to the Map component. Read coordinates from
road_closures.json in the scenario folder. Render as thick red dashed
lines on Mapbox. Follow existing layer patterns in Map.tsx.
```

### When Something Isn't Working
```
[Component/endpoint] is broken.
Expected: [what should happen]
Actual: [what's happening]
Read the relevant files first. Find the cause before suggesting a fix.
```

---

## Claude Code Prompts — Use Sparingly

### Session Start (beginning of any Claude Code session)
```
Read CLAUDE.md, plan.md, and session-log.md.
What phase are we in, what was done last, and what's next?
```

### Session End (end of any Claude Code session)
```
Update session-log.md with: what was built, decisions made, blockers,
and the exact next task. Check off completed items in plan.md.
Commit everything with a conventional commit message.
```

### Complex Multi-File Task (only for agent wiring, orchestrator, etc.)
```
Read CLAUDE.md. I need to [describe the complex task].
This touches these files: [list files].
Research the existing code first, then implement.
Make sure it works in Demo Mode (all data from static JSON).
```

### Architecture Decision (Opus plan mode — use 2-3 times TOTAL)
```
Read CLAUDE.md and plan.md. I'm about to build [complex feature].
Before I start, think through: what files need to change, in what order,
and what could go wrong. Write a short plan — 10 lines max, not a document.
```

---

## Tasks That Need Planning vs Tasks That Don't

### Just do it (Cursor Agent, no planning needed)
- Any single-file component (BriefingCard, MapLegend, TopBar, etc.)
- Any single endpoint (GET /api/config, POST /api/admin/shelter)
- Config files (.gitignore, .env.example, tailwind.config.js)
- Adding a Mapbox layer (each layer is self-contained)
- CSS/layout adjustments
- Bug fixes
- Moving/organizing files

### Think first, then do (Claude Code or Cursor with careful prompting)
- Wiring 4 agents together with asyncio.gather + timeout
- The full /api/briefing endpoint (chains all agents + LLM call)
- Admin simulation controls (advance time changes state across system)
- Fire spread model (Shapely buffer with wind direction offset)

For the "think first" tasks, you don't need a separate planning document.
Just tell Claude Code or Cursor: "Before coding, think through the approach
and tell me what files change in what order. Then implement."

---

## Git Commands

### After completing any task
```
git add -A && git commit -m "feat: [one sentence, max 72 chars]"
```

### End of day
```
git push origin dev
```

### Phase complete (Demo Mode tested)
```
git checkout main
git merge dev
git push origin main
git checkout dev
```

### Something went wrong
```
git stash
git log --oneline -5
git checkout [last good commit hash]
```

---

## Demo Mode Testing (do this often)

Before any merge to main, and at least once per day:

1. Set DEMO_MODE=true in .env (should already be default)
2. Start backend: `cd backend && uvicorn main:app --reload`
3. Start frontend: `cd frontend && npm run dev`
4. Open browser — map should show McDougall Creek fire perimeter
5. Enter address — briefing should return from cached data
6. No network errors in browser console
7. No external API calls in backend logs

If any step fails, fix it before doing anything else.

---

## Commit Message Examples

```
feat: add base Mapbox map centered on West Kelowna
feat: render fire perimeter polygon from GeoJSON
feat: add shelter pins with status colors
feat: implement cache module with TTL
feat: add Threat Agent with time-to-perimeter calc
feat: add GET /api/briefing endpoint
feat: add briefing card component
feat: add profile flag toggles with localStorage
feat: add admin shelter override buttons
fix: shelter ranking not applying pet deprioritization
fix: Demo Mode making live API call for directions
fix: map legend overlapping briefing card on mobile
chore: move scenario data to /data/scenarios/
docs: update session-log after Phase 2
style: adjust briefing card padding and font sizes
```