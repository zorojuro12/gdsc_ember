# EMBER — Final Project Vision

What the finished product should do, how it should look, and how the demo should run.
Synthesized from the project overview, UI addendum, CLAUDE.md, and current build plan.

---

## The Problem

Every year, BC residents facing wildfire evacuations receive a single generic alert — a text that says "evacuate now" and nothing more. No route info, no shelter availability, no fire proximity, no accessibility guidance.

During the 2023 McDougall Creek fire (K52767), 35,000+ residents evacuated West Kelowna without knowing Westside Road was already closed. Some drove toward the fire. Elderly and mobility-limited residents are disproportionately harmed — they need the most lead time but receive the same generic alert.

The data to make smarter decisions existed in every one of these events. EMBER connects it.

---

## What EMBER Does

Two views, one backend intelligence layer.

### Resident View (`/`)

A resident enters their address and within seconds receives:

- **Live map** showing fire perimeter, evacuation zones (Order/Alert/Watch), road closures, shelter pins, and projected fire spread at +2hr, +4hr, +6hr
- **Plain-language briefing** updated every 5 minutes: how far the fire is, how long until it reaches them, recommended route, nearest shelter, and what roads to avoid
- **Profile-aware recommendations**: mobility flag filters to accessible shelters, medical flag boosts shelters with power infrastructure, pets flag prioritizes pet-friendly facilities, no-vehicle flag shows transit assistance phone number
- **Google Places autocomplete** on the address input for fast entry
- **Real route polyline** rendered on the map from Google Directions API

### Admin / Command View (`/admin`)

A municipal operator sees the full regional picture:

- **Split-panel layout**: map (60% left) + situation panels (40% right)
- **Situation summary**: perimeter size (ha), wind speed/direction, spread rate, properties under order/alert
- **Road network status**: all closures with color-coded badges (CLOSED red, ADVISORY amber)
- **Shelter capacity panel**: each shelter with name, capacity, status badge, and manual override buttons (Open / Filling / Near Full)
- **Census vulnerability overlay** (stretch): Dissemination Areas with high 65+ population, color-coded
- **Simulation controls**: Trigger Road Closure dropdown, Advance Time +2HR, Load Scenario, Reset
- **Demo Mode toggle** with LIVE badge

---

## System Architecture

### Data Flow

```
User enters address
  → Google Geocoding API → (lat, lng)
  → 4 agents run in parallel (10s timeout):
      Threat Agent:  distance to fire perimeter + time estimate
      Route Agent:   Google Directions API → route + polyline
      Shelter Agent: Google Directions API → drive times → ranking
      Profile Agent: assembles structured JSON → Claude Sonnet → briefing
  → JSON response to frontend
  → Map renders route, dot, layers
  → Briefing card displays
```

### The 4 Agents

| Agent | Input | Output | Live API |
|---|---|---|---|
| **Threat** | User (lat,lng) + fire perimeter GeoJSON + weather | distance_km, time_to_perimeter, spread_rate, wind | None (pure computation) |
| **Route** | User (lat,lng) + active closures + top shelter coords | summary, distance_km, duration_min, polyline, fallback | Google Directions |
| **Shelter** | User (lat,lng) + shelters.json + profile flags | Ranked shelter list, top shelter with accessibility info | Google Directions (x5 parallel) |
| **Profile** | All 3 agent outputs + profile flags | 3-4 sentence plain-language briefing | Anthropic Claude Sonnet |

### Shelter Ranking Algorithm

1. Load all 5 shelters + current statuses from demo_state
2. Get drive times (Google Directions API or hardcoded fallback)
3. **Hard filter**: `mobility=true` → remove shelters where `is_accessible=false`
4. **Medical boost**: `medical=true` + `has_medical_power=true` → drive_time × 0.8
5. **Pet penalty**: `pets=true` + `has_pet_area=false` → +30 min
6. **Near-full penalty**: Near Full → +10 min; Filling → +5 min
7. Sort by effective drive time ascending

### The 5 Shelters

| Facility | Capacity | Accessible | Pet-Friendly | Medical Power |
|---|---|---|---|---|
| Royal LePage Place (West Kelowna) | ~600 | Yes | Yes | Yes |
| Kal Tire Place (Vernon) | ~600 | Yes | No | Yes |
| Princess Margaret School (Penticton) | ~250 | Yes | No | No |
| Salvation Army (Kelowna) | ~300 | Yes | No | No |
| Prospera Place (Kelowna) | ~500 | Yes | Yes | Yes |

### Fallback Safety

Every live API call fails gracefully:

| API | Fails to | User sees |
|---|---|---|
| Geocoding | Hardcoded demo coords (49.86, -119.58) | Briefing for default address |
| Directions (route) | Cached demo_route.json | Hardcoded Hwy 97 S route |
| Directions (drive times) | Hardcoded per-shelter times | Same ranking as before |
| Anthropic LLM | Template-composed briefing | Slightly more robotic text |
| All APIs down | Full demo mode behavior | Identical to offline demo |

---

## UI Layout — Final Target

### Resident View

```
┌─────────────────────────────────────────────────────────────────┐
│ EMBER                                          EVACUATION ORDER │
├────────────────────────────────────┬────────────────────────────┤
│                                    │ [Address input + GO]       │
│                                    │ [Mobility] [Medical]       │
│          MAPBOX MAP                │ [Pets] [No Vehicle]        │
│                                    │                            │
│  Fire perimeter (red)              │ ┌──────────────────────┐   │
│  Evac zones (red/orange)           │ │ LLM briefing text    │   │
│  Spread rings (+2/4/6hr)           │ │ 3-4 sentences        │   │
│  Road closures (red dashed)        │ ├──────────────────────┤   │
│  Shelter pins (green/amber/red)    │ │ THREAT: 7.4 km EXTREME│  │
│  Route polyline (blue)             │ │ ~4.2h to perimeter   │   │
│  User dot (blue)                   │ ├──────────────────────┤   │
│  Wind arrow (NE)                   │ │ ROUTE: Hwy 97 S      │   │
│  Satellite/Map toggle              │ │ 5.8 km · 8 min       │   │
│                                    │ ├──────────────────────┤   │
│                                    │ │ SHELTER: Royal LePage │   │
│                                    │ │ Accessible · Pets OK  │   │
│                                    │ ├──────────────────────┤   │
│                                    │ │ CLOSURES              │   │
│                                    │ │ • Bear Creek CLOSED   │   │
│                                    │ │ • Westside CLOSED     │   │
│                                    │ ├──────────────────────┤   │
│                                    │ │ Updated 9:55 PM       │   │
│                                    │ └──────────────────────┘   │
├────────────────────────────────────┴────────────────────────────┤
│ Legend: perimeter · spread · evac zones · closures · shelters   │
└─────────────────────────────────────────────────────────────────┘
```

On mobile: map takes 65% height, briefing card scrolls below.
On desktop (1024px+): side-by-side, map left, 380px panel right.

### Admin / Command View

```
┌─────────────────────────────────────────────────────────────────┐
│ EMBER COMMAND                    [Demo Mode ON] [LIVE]          │
├────────────────────────────────────┬────────────────────────────┤
│                                    │ SITUATION                  │
│          MAPBOX MAP                │ K52767 · 1,100 ha · HIGH   │
│                                    │ Wind: 42 km/h NE           │
│  All evac zones visible            │ Under Order: 2,462         │
│  All closures visible              │ Under Alert: 4,801         │
│  All shelter pins visible          │                            │
│  Census 65+ overlay (purple)       │ ROADS                      │
│  Fire perimeter + spread           │ • Westside Rd      CLOSED  │
│                                    │ • Bear Creek Rd    CLOSED  │
│                                    │ • Hwy 97 advisory  OPEN   │
│                                    │                            │
│                                    │ SHELTERS                   │
│                                    │ Royal LePage  [Open▼]  600│
│                                    │ Kal Tire      [Open▼]  600│
│                                    │ Princess Marg [Open▼]  250│
│                                    │ Salvation Army[Open▼]  300│
│                                    │ Prospera Place[Open▼]  500│
│                                    │                            │
│                                    │ SIMULATION                 │
│                                    │ [Trigger Closure ▼]        │
│                                    │ [Advance +2HR] [Reset]     │
└────────────────────────────────────┴────────────────────────────┘
```

---

## Demo Script (4 Minutes)

### Minute 0-1 — The Hook

> "In August 2023, 35,000 people were told to evacuate West Kelowna. Most of them received a text that said: evacuate. That was it. EMBER is what they should have had."

Open Admin View. The map renders the real 2023 fire perimeter. Wind vectors animate. Evacuation zones color the map red and orange. Show the situation panel — 1,100 hectares, HIGH spread, 2,462 properties under order.

### Minute 1-2 — The Resident Experience

Switch to Resident View. Type a real West Kelowna address (Google autocomplete appears). Briefing card generates — Claude Sonnet writes a fresh, urgent briefing from real computed data. Read it aloud.

Then toggle **"Mobility"**. The briefing updates — the shelter changes to one with confirmed accessible entry, and the text says so.

> "Maria is 67 and needs an accessible shelter. EMBER knows that. The generic government alert does not."

### Minute 2-3 — The Live Re-Route

Return to Admin View. Click **[Trigger Road Closure]** → Westside Road (this actually happened at 7 PM on Aug 17, 2023).

Switch to Resident View. Alert banner appears: **"Route updated — Westside Road now closed."** A new route is displayed with a different polyline on the map.

> "The fire just cut off the primary evacuation route. EMBER detected it in real time and re-routed automatically."

### Minute 3-4 — Scale and Impact

Return to Admin View. Click **[Advance Time +2HR]**. Fire projection rings advance. Royal LePage Place status changes to "Filling." More addresses light up red.

> "Every data source we use is a confirmed public BC government API. Every piece of logic runs on real data. This is not a concept — it is a working system built on infrastructure that already exists."

---

## Demo Timeline (from road_closures.json)

| Time | Event | Active Closures |
|---|---|---|
| Aug 17, 1:25 PM | 68 properties evacuated off Bear Creek Road | closure_004 |
| Aug 17, 7:00 PM | Westside Road closed — fire moves toward Raymer Bay | closure_004, closure_001 |
| Aug 17, 8:00 PM | DriveBC advisory for Hwy 97 (Glenrosa to Bennett Bridge) | closure_004, closure_001, closure_002 |
| Aug 17, 9:00 PM | Rose Valley & WK Estates evacuation order — 763 properties | closure_004, closure_001, closure_002, closure_003 |
| Aug 17, 9:55 PM | Fire jumps Okanagan Lake — Kelowna state of emergency | all 4 closures |

---

## Profile Flag Behaviors

| Flag | Effect on Shelters | Effect on Briefing |
|---|---|---|
| **Mobility** | Hard-filters to `is_accessible=true` only | "Recommended shelter has confirmed accessible entry." |
| **Medical** | Soft-boosts `has_medical_power=true` (drive_time × 0.8) | "This shelter has full electrical infrastructure for medical equipment." |
| **Pets** | Deprioritizes `has_pet_area=false` (+30 min penalty) | "Recommended shelter accepts pets." or "Contact shelter staff about pet accommodation." |
| **No Vehicle** | No change to ranking | "Call Emergency Support Services at 1-800-387-4258." |

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript (strict), Vite, Tailwind CSS v4, Mapbox GL JS, React Query |
| Backend | Python 3.8+, FastAPI, Shapely, pandas |
| LLM | Anthropic Claude Sonnet (one call per briefing, synthesis only) |
| APIs | Google Maps Platform (Geocoding, Directions, Places Autocomplete) |
| Cache | In-memory Python dict with TTL (no Redis) |
| Deploy | Vercel (frontend), Railway (backend) |

---

## SDG Alignment

- **SDG 13 — Climate Action**: Wildfire response intelligence powered by real government climate data
- **SDG 11 — Sustainable Cities**: Smarter evacuation routing reduces road congestion and saves lives
- **SDG 3 — Good Health**: Accessibility-aware shelter recommendations protect vulnerable populations

---

## What's Built vs What's Left

### Done (Phases 1-4 + live API wiring)
- Full Mapbox map with all layers (perimeter, spread, evac zones, closures, shelters, wind, route)
- 4 backend agents with live Google Maps + Anthropic APIs and graceful fallback
- Resident View with address input (Places Autocomplete), profile flags, briefing card, alert banner
- Responsive layout, skeleton loading, error states, localStorage persistence
- Demo mode works 100% offline from static scenario files

### Remaining (Phase 5-6)
- Admin View frontend: situation panel, road panel, shelter panel, simulation controls
- `POST /api/admin/simulate/advance` — advance demo timeline
- Census vulnerability overlay (stretch goal)
- Deploy to Railway
- Polish: offline test, visual bugs, projector resolution, loading spinners
- Rehearse demo 20+ times
- Presentation slides
