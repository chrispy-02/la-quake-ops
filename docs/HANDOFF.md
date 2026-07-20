# Agent Handoff — LA Quake Ops prototype

**Status: COMPLETE & VERIFIED** (2026-07-19). Working demo, clean tree, 2 commits on
`master` (`58cfb56` sim core, `96e259a` UI). Nothing half-finished; everything below
is context for *extending* it, not for fixing it.

## What this is

"LA Quake Ops" — a meeting-demo prototype: an emergency-ops dashboard playing a
deterministic 75-sim-minute M6.9 LA earthquake with explainable hospital routing.
**All data is simulated** and labeled as such (top-bar chip, bottom pill, intro
card, README). It is deliberately NOT production software: no auth, no backend,
no integrations — do not add them without an explicit user request.

## Run / verify

```bash
npm run dev        # http://localhost:5173 → "Start scenario"
npm test           # 76/76 Vitest tests (sim core only, TDD-built)
npm run typecheck  # tsc strict, exit 0
npm run lint       # ESLint 9 flat, 0 problems
npm run build      # tsc + vite, passes (~1.3 MB chunk warning is expected: maplibre)
```

Verified in browser (dev + production build via `vite preview`): no console
errors; pause/step/speed/toggles/aftershock all exercised; screenshots in
`docs/screenshots/`. QA was done with the gstack `/browse` headless browser
(CLAUDE.md mandates it for all browsing; never `mcp__claude-in-chrome__*`).

## Architecture in one breath

`src/sim/` is a pure-TS, DOM-free, deterministic engine (types → rng → geo →
roadNetwork → pathfinding → facilities → routing → scenario → engine).
`src/store.ts` binds it to React via `useSyncExternalStore` with **~7 Hz
throttled notifications**; `src/map/MapView.tsx` renders MapLibre and animates
transports/route-dashes at full frame rate by reading `engine.state` directly in
its own rAF. `src/ui/*` are the panels. Design doc:
`docs/superpowers/specs/2026-07-16-la-earthquake-hospital-routing-design.md`.

## Hard invariants — do not break

1. **Determinism.** No `Math.random()`/`Date.now()` in `src/sim/`. All noise is
   seeded (`rng.ts`); the clock is integer deci-minutes; scripted events fire on
   clock crossings. `engine.test.ts` compares runs with different tick slicings
   — it will catch you.
2. **In-transit units do NOT reroute away from *diverting* hospitals** — only
   offline/inaccessible/path-blocked (mirrors real EMS diversion; also keeps the
   delivery tests stable). Rationale in `engine.ts` `validateRouting()` docstring.
3. **Zones array is replaced immutably** on change (`state.zones = [...]`) —
   `pathfinding.ts` memoizes per-edge zone cost in a `WeakMap` keyed on array
   identity. Mutating in place = stale costs.
4. **Status is never color-alone** — every `FacilityStatus` pairs color with
   glyph + label via `STATUS_META` (`src/ui/format.ts`). Keep that for anything new.
5. Basemap must stay **key-free by default** (OpenFreeMap dark). Swap options
   documented in README "Map configuration".

## Sharp edges & gotchas

- **DOM reads lag ~140 ms** after actions (the React throttle). In browser QA,
  sleep past it before asserting panel text. Map GL state is not throttled.
- **Snapshot @refs go stale fast** — the hospital board re-sorts live. Prefer
  `$B js "[...document.querySelectorAll('.hrow')].find(...)?.click()"`.
- `window.__map` (dev) exposes the MapLibre instance for camera work:
  `__map.flyTo({center:[-118.252,34.047], zoom:14.6, pitch:58})` shows 3D DTLA.
- Editing `MapView.tsx` can leave HMR without re-running the map-mount effect —
  reload the page before trusting `__map` or layer state.
- The road graph is **stylized** (~110 nodes, hand-traced corridors in
  `roadNetwork.ts`). Corridor authoring format: `NODES` table + `CORRIDORS`
  paths (node ids interleaved with raw shape coords); edges auto-generate with
  ids like `i10w:lacienega10-crenshaw10` — scenario closures reference these ids
  and `scenario.test.ts` validates they exist.
- A few East-Hollywood facilities have small pixel declutter offsets
  (`MARKER_OFFSET` in MapView) — they are intentional, not position bugs.
- PowerShell 5.1 wraps stderr of native tools in fake `NativeCommandError`
  noise (e.g., Vite's chunk warning); check the actual exit/`✓ built` line.

## Where to add things

- **New scenario beat / preset**: `scenario.ts` (keep events time-sorted; ties
  keep authoring order — engine relies on stable sort). Add closures only on
  existing edge ids.
- **New facility**: `facilities.ts` roster + ensure a graph node within ~6 km
  (`roadNetwork.test.ts` enforces coverage).
- **Scoring tweaks**: `routing.ts` `assignIncident` — update `routing.test.ts`
  expectations deliberately, test-first (project was built TDD; keep it green).
- **New map layer**: add source+layer in `MapView.ensureLayers` (re-added on
  every `style.load` — fallback style relies on this), wire visibility in the
  sync effect and `LayersState`.

## Likely next asks (if the user extends)

Multiple epicenter presets (goal mentioned them as optional; `Scenario` is
already a value — parameterize `buildMainScenario`), camera tour mode for
meetings, incident clustering at low zoom, richer arterial graph, or recording a
demo video. None are started.

## Session facts

User: Christopher Nguyen (chrisnguyen789@gmail.com), Windows 11, repo at
`C:\Users\chris\Desktop\HospitalTransport`. Agent memory lives at
`~/.claude/projects/C--Users-chris-Desktop-HospitalTransport/memory/` (see
`la-quake-sim-stack.md`). gstack + superpowers plugins are installed and their
skill gates apply (TDD, verification-before-completion, /browse for browsing).
An RTK hook may transparently rewrite shell commands (`git status` → `rtk git
status`) — it's benign.
