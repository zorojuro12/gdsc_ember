## Claude Code Prompts

### Session Start (run at the beginning of EVERY Claude Code session)

```
Read these files carefully before doing anything:
1. CLAUDE.md — project rules and conventions
2. plan.md — current build phase and checklist
3. session-log.md — what was done last session and what to do next

Tell me: what phase are we in, what was done last session, and what's the next task?
```

### Session End (run at the end of EVERY Claude Code session)

```
Update these three files:
1. plan.md — check off any items we completed today
2. session-log.md — overwrite with: what was built today, decisions made, any blockers, and the exact next task for the next session
3. CLAUDE.md — if we learned any new rules or patterns, add them to the appropriate section

Then commit all changes with a conventional commit message and push to the current branch.
```

### Phase Planning (Opus, plan mode — Shift+Tab x2)

```
Read CLAUDE.md and plan.md. We are starting Phase [N].
Generate a detailed implementation plan for this phase:
- Exact file paths for every file to create or modify
- What changes in each file and why
- The order of implementation (what must exist before what)
- What tests or manual checks confirm it works
- How Demo Mode is handled (all data paths must work from static JSON)
Save to phase-[N]-plan.md. Do not write any code yet.
```

### Feature Planning (Opus, plan mode)

```
Read CLAUDE.md, plan.md, session-log.md.
Before writing any code for [FEATURE], deeply research the existing codebase.
Read every relevant file in full — not just signatures, but implementations.
Write a detailed implementation plan:
- Exact file paths to create or modify
- What changes in each file and why
- Order of implementation
- How it works in Demo Mode
- What manual test confirms it works
Save to feature-plan-[name].md. Do not write any code yet.
```

### Execute Plan (Sonnet)

```
The plan looks good. Execute [plan-file].md exactly as written.
Work through the files in the order specified.
After completing each file, pause and confirm what was done.
When all files are done, tell me what manual test to run to verify.
```

### Fix After Review

```
I've added notes to the plan marked ## YOUR NOTE: — read them and
update the plan accordingly. Don't start coding yet.
```

---

## Cursor Agent Mode Prompts (Ctrl+I)

### Create a React Component

```
Create [ComponentName].tsx in frontend/src/components/.
It should [describe what it does].
Use Tailwind CSS for styling. TypeScript strict mode.
Follow the patterns in CLAUDE.md for API contracts.
Props should match the /api/briefing response shape.
```

### Create a FastAPI Endpoint

```
Add a new endpoint to backend/main.py:
[METHOD] [PATH]
Request body: [shape]
Response: [shape from CLAUDE.md]
In Demo Mode, return data from the scenario files.
In live mode, call [which agent/API].
```

### Create an Agent

```
Create backend/agents/[name].py following CLAUDE.md agent spec.
Input: [describe inputs]
Output: [describe output shape]
Must work in Demo Mode (load from /data/scenarios/2023-west-kelowna/).
Must have a 3-second timeout when called via asyncio.gather.
```

### Add a Mapbox Layer

```
Add a new Mapbox layer to the Map component.
Layer type: [fill/line/circle/symbol]
Data source: [file path to GeoJSON or JSON]
Style: [color, opacity, width, etc.]
The layer should update when Demo Mode simulation advances time.
Reference existing layers in Map.tsx for the pattern.
```

### Debug Something

```
[Component/endpoint] is not working correctly.
Expected behavior: [what should happen]
Actual behavior: [what's happening]
Read the relevant files first. Do not guess — identify the specific
cause before proposing a fix.
```

---

## Cursor Chat Prompts (Cmd+L) — Quick Questions

### Architecture Question
```
Looking at CLAUDE.md, how should I structure [X]?
Which files need to change and in what order?
```

### API Contract Check
```
I'm building [component/endpoint]. What's the exact JSON shape
it should send/receive? Check CLAUDE.md API endpoints section.
```

### Tailwind Help
```
I need a [describe UI element] using Tailwind CSS.
Colors: red for danger (#E24B4A), amber for warning (#EF9F27),
green for safe (#639922), blue for info (#185FA5).
```

---

## Gemini Prompts (backup when Claude is rate-limited)

### Codebase Review
```
Read all files in this project. I'm building EMBER, a wildfire
evacuation app. Check if all components follow the conventions
in CLAUDE.md. Flag any inconsistencies — especially:
- Frontend calling external APIs directly (should go through FastAPI)
- Missing Demo Mode handling in any agent or endpoint
- Shelter data being fetched instead of read from shelters.json
- Any hardcoded API keys
```

### Generate Tests
```
Read [file path]. Generate a test file for it.
For React components: use React Testing Library.
For FastAPI endpoints: use pytest with httpx AsyncClient.
For agents: test both Demo Mode (static data) and the response shape.
```

---

## Codex Prompts (use $100 credits for test generation)

### Generate Component Tests
```
Here is a React component: [paste component code]
Generate a comprehensive test file using React Testing Library and vitest.
Test: rendering, user interactions, loading states, error states.
The component receives data matching this shape: [paste API response from CLAUDE.md]
```

### Generate API Tests
```
Here is a FastAPI endpoint: [paste endpoint code]
Generate pytest tests using httpx AsyncClient.
Test: success response matches this shape: [paste from CLAUDE.md],
error handling, Demo Mode returns static data.
```

---

## Git Prompts (for Claude Code)

### Commit Current Work
```
Commit all changes with a conventional commit message describing what was built.
Format: feat: [short description] or fix: [short description]
```

### Create Feature Branch
```
Create a new branch: feat/ember-[feature-name]
Switch to it.
```

### Merge to Dev
```
First, test that Demo Mode works (all data loads from static JSON, no API errors).
If it works, merge the current feature branch to dev.
Push both branches to origin.
```

---

## Emergency / Recovery

### Claude Code Made a Mess — Rewind
Press Esc to stop Claude immediately.
Then press Esc + Esc to open checkpoint picker.
Or in terminal:
```
git checkout dev
git branch -D feat/ember-[broken-branch]
git checkout -b feat/ember-[feature-name]-v2
```

### Rate Limited — Switch Tools
1. Close Claude Code
2. Open Cursor — use Agent mode (Ctrl+I) with Sonnet for execution
3. Or use Gemini in VS Code for review/debugging
4. Come back to Claude Code when limit resets

### Demo Mode Broken
```
Demo Mode is failing — it's making a live API call instead of loading
from static JSON. The rule from CLAUDE.md: all data must be served from
/data/scenarios/2023-west-kelowna/ with zero external API calls.
Trace the code path from the Demo Mode toggle through to the data fetch.
Find where the conditional check is missing or incorrect.
```