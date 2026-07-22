# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Vite dev server → http://localhost:5173
npm test           # Vitest, all sim/data tests (run once)
npm run test:watch # Vitest watch mode
npm run typecheck  # tsc --noEmit (strict)
npm run lint       # ESLint 9 (flat config)
npm run build      # tsc --noEmit && vite build (the ~1.4 MB maplibre chunk warning is expected)

# Requires Node 20+ (Vite 6 toolchain).

# Run one test file or one test by name:
npx vitest run src/sim/hazard.test.ts
npx vitest run -t "routes pediatric"
```

Tests live only in `src/sim/` and `src/data/` (the pure, deterministic core). There is no DOM/browser test setup; UI is verified manually.

**Regenerating the checked-in data snapshots** (rare — only when refreshing base data):
`scripts/build-data-snapshots.py` rebuilds `src/data/snapshots/*.json` from documented source URLs. `scripts/build-road-geometry.py` rebuilds `roadGeometry.json` from OSRM, but first needs a one-off Vitest dump writing `src/data/raw/_graphdump.json` (that `raw/` dir is gitignored) — see the script header. The app never calls these at runtime; it loads the snapshots.

## What this app is

"LA Quake Ops" — a map-centered emergency-ops dashboard that plays a deterministic earthquake scenario with explainable hospital routing. The user places an epicenter anywhere in LA County (magnitude/depth configurable) and the whole crisis regenerates around it.

**The core product line: REAL BASE DATA vs SIMULATED CRISIS.** Map, hospitals (names/coords/licensed beds/ED level/trauma designation), faults, neighborhoods, population, roads, and route geometry are **real public data** shipped as offline snapshots in `src/data/`. The earthquake and everything it causes — shaking, damage, ED occupancy, diversion, closures, incidents, aftershocks — are **simulated**. Never present a simulated value as real (e.g. licensed beds are real; live bed availability is simulated and derived from them). `src/data/provenance.ts` is the source of truth for which is which; the UI surfaces it (provenance card, `.databar` labels, disclaimer pill).

## Architecture (the big picture)

Three layers, strictly separated:

1. **`src/sim/` — pure, DOM-free, fully deterministic engine.** No React, no MapLibre, no `window`. Pipeline: `types` → `rng` (mulberry32) → `geo` → `hazard` (shaking model + shake zones) → `roadNetwork` (graph) → `pathfinding` (A*) → `facilities` (roster) → `routing` (scoring + explanations) → `scenario` (types + `DEFAULT_PARAMS`) → `scenarioGen` (procedural generator) → `engine` (tick loop). `SimulationEngine` holds all mutable state and advances on integer deci-minute (0.1 sim-min) quanta.

2. **`src/data/` — real base data.** `baseData.ts` gives typed access to `snapshots/*.json` plus geo lookups (`nearestNeighborhood`, `nearestFault`, `isInLACounty`). `sim/facilities.ts` builds the hospital roster from these snapshots; `sim/hazard.ts` and `sim/scenarioGen.ts` use the fault/population/neighborhood data. `sim` may import `data`; `data` never imports `sim` runtime (only `sim/geo` + types).

3. **`src/store.ts` + `src/map/` + `src/ui/` — the React/MapLibre shell.** `store.ts` binds the engine to React via `useSyncExternalStore` with notifications **throttled to ~7 Hz** (`src/store.ts`), and drives the sim clock with a rAF loop (`startSimLoop`). `map/MapView.tsx` renders MapLibre and runs **its own rAF** to animate transports and route dashes at full frame rate by reading `engine.state` directly (bypassing the throttle). `ui/*` are panels.

Scenario flow: `App.tsx` holds pending `ScenarioParams` while idle; `engine.setScenarioParams()` / `restoreDefault()` rebuild the scenario (idle only); `engine.start()` runs it. The map shows a draggable epicenter + preview zones while `placement` is non-null (idle).

## Invariants — do not break

- **Determinism is absolute.** No `Math.random()` / `Date.now()` in `src/sim/`. All noise flows through `rng.ts` (mulberry32); `scenarioGen` seeds from `(epicenter, magnitude, depth)`; the clock is integer deci-minutes. `engine.test.ts` compares runs with different tick slicing and will catch nondeterminism.

- **Route cost is decoupled from displayed geometry** (`sim/roadNetwork.ts`). Each edge's `lengthKm` (used for A* cost and ETAs) is the **hand-traced chord length** — stable, tuned, deterministic. Each edge's `coords` (displayed polyline) is the **real OSRM road geometry** from the snapshot. ETAs are a SIMULATED post-quake model (length × reduced speeds × shake/closure penalties), **not** OSRM durations. Don't "simplify" by computing `lengthKm` from the OSRM coords — it inflates ETAs and re-introduces a long delivery tail.

- **Hospitals are `hosp:*` leaf nodes.** `nearestNode` deliberately skips them, so raw points (incidents) snap to through-roads. Route *to* a hospital via `findPath({ goalNodeId: 'hosp:<id>' })` (see `sim/routing.ts`) to end on its real access road. Scenario closures only ever touch corridor edge ids, never `hospaccess:*`.

- **Zones array is replaced immutably** (`state.zones = [...]`) — `pathfinding.ts` memoizes per-edge shake cost in a `WeakMap` keyed on the array's identity. Mutating in place gives stale costs.

- **In-transit units do NOT reroute away from a merely *diverting* hospital** — only offline / inaccessible / path-blocked. Mirrors real EMS diversion and keeps delivery tests stable (`engine.ts` `validateRouting`).

- **MapLibre marker elements: never reassign `element.className`.** MapLibre adds a `maplibregl-marker` class (→ `position:absolute`); overwriting `className` drops it, the element becomes a full-width static block, and the pin flies off its coordinate. Toggle your own classes with `classList.toggle('sel', …)` (`map/MapView.tsx`).

- **Facility status is never color-alone.** Every `FacilityStatus` pairs color + glyph + label via `STATUS_META` (`ui/format.ts`). Keep that for anything new.

- **Basemap stays key-free** (OpenFreeMap dark) with an offline fallback style; overlays must re-add on `style.load` (`map/MapView.ensureLayers`, `map/basemap.ts`).

## Gotchas

- Panel DOM updates lag ~140 ms behind engine changes (the 7 Hz throttle); map GL state is not throttled. When asserting panel text in browser QA, wait past it.
- `window.__map` and (dev only) `window.__engine` are exposed for console/QA camera + sim control.
- The routing graph topology is a stylized hand-placed subset covering the **LA metro core**; epicenters far outside it (Antelope Valley) still produce valid readouts/shaking but routing snaps to the nearest graphed corridor.
