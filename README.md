# LA Quake Ops — Earthquake Hospital-Routing Simulation (Prototype)

A map-centered emergency-operations dashboard. **Place an earthquake anywhere in
Los Angeles County** — choose the epicenter, magnitude, and depth — and watch a
deterministic simulation regenerate the crisis around it: mass-casualty
incidents appear (weighted by real population), hospitals report damage and
overload, freeways close, and every patient transport is routed — and visibly
*re*-routed — with a plain-English explanation of why that hospital was chosen.
Switch between a county-wide **2D** operations view and a building-level **3D**
view.

> ⚠️ **REAL BASE DATA · SIMULATED CRISIS — VISUAL PROTOTYPE.** The map, hospital
> roster, faults, neighborhoods, roads, and population are **real public data**.
> The earthquake and everything it causes — shaking, damage, ED occupancy,
> diversion, closures, incidents, aftershocks — are **simulated**. Licensed bed
> counts are real; live bed availability is not (it is simulated). Not clinically
> validated, not affiliated with LA County or any agency, and never a source of
> real emergency guidance.

![Dashboard overview](docs/screenshots/overview.png)

## Quick start

```bash
npm install
npm run dev        # → http://localhost:5173
```

Open the app, read the intro, press **Set up the scenario**. In the left panel:
place an epicenter (click the map, drag the ✦ marker, search a place/hospital,
enter lat/lng, or pick a preset), set magnitude and depth, then **Generate
scenario**. **No API keys, no configuration** — the demo runs entirely from
checked-in data snapshots plus a key-free basemap.

Requirements: Node 20+, a WebGL-capable browser, network access for map tiles
(the app falls back to a plain dark canvas with all overlays if tiles are
unreachable). Everything else works offline.

## What is REAL vs SIMULATED

The app draws a hard line between real base data and simulated crisis conditions.
Open **Base data & sources** (in the setup panel, or the bottom pill) for the
in-app provenance card. Source metadata lives in `src/data/provenance.ts`.

### REAL BASE DATA (checked-in snapshots, `src/data/snapshots/`)

| Data | Source | License | Used for |
|---|---|---|---|
| Hospital names, coordinates, **licensed beds**, ED service level | California HCAI — Licensed Healthcare Facility Listing | CA open data (CHHS portal) | The 24-hospital roster |
| Adult & pediatric **trauma-center designations** | California EMSA — Designated Trauma Centers (LA County) | CA public record | Routing capability, board labels |
| **Quaternary faults** | USGS Quaternary Fault & Fold Database | Public domain | Nearest-fault readout, shake-zone shaping |
| **Population** (tract centers of population) | U.S. Census Bureau 2020 | Public domain | Weighting where incidents concentrate |
| **County boundary** | U.S. Census TIGER/Line | Public domain | Epicenter validation, county overview |
| **Neighborhoods** | LA County Countywide Statistical Areas | LA County open data | Nearest-neighborhood readout |
| Basemap, roads, **building footprints** | OpenFreeMap · OpenMapTiles · © OpenStreetMap | ODbL | Basemap + 3D extrusions |
| **Route geometry** (road-following polylines) | OSRM · © OpenStreetMap | ODbL | Displayed transport routes hug real streets |

Snapshots were retrieved **2026-07-20** and carry a "data as of" date in the
provenance card. They are re-derivable with `scripts/build-data-snapshots.py`
(documents each source URL).

### SIMULATED CRISIS DATA (never from a live feed)

Shaking, structural damage, ED occupancy, available beds, diversion, downtime,
road closures, incidents, patient counts, and aftershocks are all simulated. No
authoritative public real-time feed exists for these.

**Licensed beds are not live availability.** The simulated ED surge capacity and
occupancy are *baselines derived from* the real licensed bed count (≈11%, clamped
to a plausible ED size) purely for demo readability. They are labeled SIMULATED
everywhere they appear and must never be read as real hospital status.

## The shaking model (simulated, not validated)

`src/sim/hazard.ts` implements a simple, deterministic intensity attenuation:

```
MMI = 4.0 + 1.8·M − 3.2·ln(R_hypo)      R_hypo = √(epicentral² + depth²)
```

Higher magnitude → stronger, broader shaking; greater distance and greater depth
→ weaker surface shaking. Shake-zone rings are the closed-form radii where MMI
crosses VIII/VII/VI/V, **elongated along the nearest mapped fault's strike** so
footprints reflect magnitude, depth, and fault orientation rather than identical
circles. This is a **demo approximation, not a USGS ShakeMap** and is not
scientifically validated. Where a stronger source is desired, USGS
ShakeMap/scenario grids could replace this model behind the same interface.

## How a scenario is generated

`src/sim/scenarioGen.ts` turns `(epicenter, magnitude, depth)` into the full
timeline, seeded so a given input always produces the identical run:

- **Incidents** are sampled from real Census tract centroids, weighted by
  population × local shaking, so they cluster where people and shaking overlap.
  Count and patient severity scale with magnitude and local MMI.
- **Hospital impacts** (offline / damage / diversion / walk-in surge) are decided
  per hospital from its MMI and a seeded roll; outages are capped so the scenario
  stays playable.
- **Road closures** are chosen from real graph edges whose midpoint sits in strong
  shaking (freeways preferred, spread across corridors).
- A **scripted aftershock** (~T+30) is sited on a nearby fault; manual aftershocks
  (⚡ button) cycle deterministic presets near the epicenter.

Changing the epicenter regenerates all of the above around the new location — the
old fixed "Puente Hills / Vernon" run is now just the default parameters.

## 2D / 3D

A visible **2D / 3D** switch (top-right of the map) replaces the old buildings
checkbox:

- **2D** — top-down county operations view, buildings hidden, camera flattened
  for regional routing.
- **3D** — pitches and zooms toward the epicenter/selection and extrudes real
  OpenMapTiles building footprints. Buildings are **visible immediately** (they
  start extruding at zoom ~11.5 and the 3D camera lands above that), and stay
  **below** the route/marker layers so transports, incidents, hospitals, zones,
  and closures remain readable above rooftops. Where building heights are missing
  a modest default is used, so footprints still extrude.

Camera tools: focus epicenter, county overview, rotate, tilt, reset north, zoom.
Simulation and selection state are preserved across mode switches.

## Demo script (~4 minutes at 1×)

| When | What to show |
|---|---|
| Setup | Drag the ✦ or pick **Northridge** — the readout updates (neighborhood, nearest fault, trauma-center distances) and the preview shake footprint reshapes. **Generate scenario.** |
| T+0 | Mainshock: shake effect, MMI zones ripple out, seismograph strip spikes, event feed starts. |
| T+2–T+12 | Incidents spawn near the epicenter; click one — the **Med Control** card explains the assignment; the route hugs real freeway corridors. |
| T+3–T+20 | Hospitals nearest the epicenter take damage / divert / go offline; freeways in strong shaking close. |
| T+30 | Scripted aftershock on a nearby fault; a nearby hospital diverts. |
| Any time | **⚡ Aftershock** for deterministic manual presets; **2D/3D** switch; **Base data & sources**. |
| T+36+ | Stabilization: closures reopen, hospitals recover, remaining transports deliver. |

Also try: click a hospital to see its **real** HCAI/EMSA data (licensed beds, ED
level, trauma designation) alongside its **simulated** live status; **Reset** to
reconfigure; speeds 0.5×–4×; **+1 min** stepping while paused.

## Architecture

```
src/
  data/           REAL BASE DATA layer
    provenance.ts   Source, license, retrieval date per dataset
    baseData.ts     Typed snapshot access + nearest-neighborhood/fault, in-county test
    snapshots/      Checked-in JSON: hospitals, faults, population, county, neighborhoods, roadGeometry
  sim/            Pure-TypeScript simulation core — no DOM, fully unit-tested
    types.ts        Domain model
    rng.ts          Seeded mulberry32 — all randomness is deterministic
    geo.ts          Haversine, destinations, point-in-polygon, organic zone rings
    hazard.ts       Shaking-intensity model + fault-shaped shake zones
    roadNetwork.ts  Hand-traced LA graph (metro core): freeway corridors + arterials
    pathfinding.ts  A* with closure blocking and shake-zone cost multipliers
    facilities.ts   Roster built from real snapshots + derived simulated capacity
    routing.ts      Candidate filtering, weighted scoring, explanation composer
    scenario.ts     Scenario types + default parameters
    scenarioGen.ts  Deterministic procedural scenario generator (epicenter-driven)
    engine.ts       Tick engine: events, walk-in surges, transports, reroutes, metrics
    store.ts        React binding (useSyncExternalStore) + rAF sim loop
  map/            MapLibre GL integration (basemap, 2D/3D, overlays, markers, placement)
  ui/             Panels: setup, top bar, metrics, hospital board, event feed,
                  detail (real vs simulated), map controls, provenance, legend
scripts/
  build-data-snapshots.py   Re-derive base-data snapshots from documented source URLs
  build-road-geometry.py    Re-derive road-following route geometry from OSRM/OSM
```

The sim core never touches the DOM; the UI reads one state snapshot per engine
notification (throttled ~7 Hz for panels) while the map animates transports and
route dashes at full frame rate from the same state.

## Determinism

No `Math.random()`/`Date.now()` in `src/sim/`. All noise is seeded; the scenario
generator is seeded from `(epicenter, magnitude, depth)`; the clock is integer
deci-minutes. Every run of a given configuration is identical, verified by tests
that compare runs with different tick slicings.

## Data & API setup

The demo needs **no keys** and makes **no runtime API calls** for simulation data
— it loads the checked-in snapshots. This keeps it deterministic, offline-capable,
and rate-limit-free.

- **Basemap** is [OpenFreeMap](https://openfreemap.org)'s key-free `dark` style,
  fetched at runtime. If tiles are unreachable, the app falls back to a plain dark
  canvas and all overlays still render.
- **Refreshing base data**: run `scripts/build-data-snapshots.py` against freshly
  downloaded sources (URLs documented in the script header and in
  `src/data/provenance.ts`). The app always ships the snapshot as the fallback.
- **Optional live feeds** (e.g. USGS ShakeMap/catalog) are intentionally not wired
  into the simulation, because live data would break determinism and there is no
  authoritative real-time feed for hospital status. Any key-gated feed added later
  must keep credentials in environment variables (`.env.local`), never in the
  repo, and must fall back to the snapshot when unavailable.

## Checks

```bash
npm test           # Vitest — sim core + hazard + data + scenario generation
npm run typecheck  # strict TypeScript
npm run lint       # ESLint 9 + typescript-eslint
npm run build      # tsc + production Vite build
```

## Map configuration

The default basemap needs no key. To swap `BASEMAP_STYLE_URL` in
`src/map/basemap.ts`:

- **CARTO dark-matter** (also key-free):
  `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json`.
- **MapTiler / Mapbox** — their style URL with your token in `.env.local`
  (`VITE_MAP_TOKEN`); never commit secrets. 3D buildings need an OpenMapTiles
  `building` source layer with `render_height`.

## Assumptions & limitations

- **The shaking model is a demo approximation, not validated.** It is monotonic in
  magnitude/distance/depth and fault-shaped, but not a ground-motion prediction
  equation or a ShakeMap.
- **Crisis outcomes are invented.** Damage, ED occupancy, diversion, closures,
  incidents, and patient counts are simulated for demo readability. ED surge
  capacity/occupancy are derived from real licensed beds and are **not** live
  availability.
- **Trauma designations follow the EMSA sheet** used as the source; a hospital not
  listed there is shown as non-trauma even if it holds a designation from another
  source or date.
- **The routing graph topology is stylized** (~110 hand-placed interchange nodes)
  and covers the **LA metro core**, but each edge is drawn with **real
  road-following geometry** (OSRM/OpenStreetMap, snapshotted), and routes end at
  each hospital along its real access road, so transport routes hug real streets
  rather than cutting across blocks. Travel **times/ETAs are a simulated
  post-quake model** (edge lengths × reduced speeds × shake/closure penalties),
  **not** OSRM durations, so routing decisions stay tuned and deterministic.
  Path choices are corridor-level, not turn-by-turn navigation-grade; epicenters
  far outside the metro (e.g. the Antelope Valley) still produce valid base-data
  readouts and shaking, but incident routing snaps to the nearest graphed corridor.
- **`helipad` is a derived heuristic** (trauma centers), not an authoritative feed.
- No persistence, auth, dispatch/hospital integrations, or mobile layout
  (desktop-first; rails collapse below ~1000px). Feed/panel updates are throttled
  to ~7 Hz by design; the map animates at full frame rate.

## Attribution

Base data: California HCAI · California EMSA · U.S. Geological Survey · U.S. Census
Bureau · County of Los Angeles · OpenFreeMap · OpenMapTiles · © OpenStreetMap
contributors. Built with MapLibre GL JS, React, Vite, and Vitest.
