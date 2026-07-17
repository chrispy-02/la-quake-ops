# LA Earthquake Hospital-Routing Simulation — Design

**Date:** 2026-07-16 · **Status:** Approved via `/goal` directive (autonomous build; spec supplied by user)

## Purpose

A polished, meeting-ready visual prototype: an emergency-operations style dashboard showing the
aftermath of a major Los Angeles earthquake — hospitals under stress, mass-casualty incidents,
and *explainable* patient routing that visibly reroutes as hospitals fail, fill, or divert and
roads close. **Simulated data only; not a clinical or emergency-management system.**

## Stack decision

| Option | Verdict |
|---|---|
| Google Maps JS API | Rejected: requires per-viewer API key + billing; styling/3D control weaker for a dark ops aesthetic. |
| Leaflet + raster tiles | Rejected: no smooth WebGL animation, no 3D buildings, dated look. |
| **MapLibre GL JS + OpenFreeMap `dark` vector style** | **Chosen**: zero API key, dark ops-room basemap with LA freeways/street/neighborhood labels, OpenMapTiles `building` layer → custom `fill-extrusion` 3D buildings, buttery WebGL. CARTO dark-matter documented as fallback. |

App shell: **Vite + React 19 + TypeScript (strict)**. State: tiny custom store on
`useSyncExternalStore` (no state library). Tests: **Vitest**. Lint: ESLint 9 flat + typescript-eslint.
Font: self-hosted Inter via `@fontsource-variable/inter` (no runtime CDN besides map tiles).

## Architecture

```
src/
  sim/            pure TypeScript, no DOM — fully unit-testable
    types.ts        shared domain types
    rng.ts          seeded mulberry32 (determinism)
    geo.ts          haversine, bearings, deterministic organic polygons (shake zones)
    roadNetwork.ts  hand-traced LA corridor graph: freeway polylines + arterials → nodes/edges
    pathfinding.ts  A* over graph; closures block edges; damage zones multiply edge cost
    facilities.ts   ~20 real-name hospitals + fictional clinics (all conditions simulated)
    scenario.ts     scripted deterministic timeline + aftershock presets + incident templates
    routing.ts      candidate filtering + weighted scoring + human-readable explanations
    engine.ts       SimulationEngine: clock, event application, transports, reroutes, metrics, feed
    store.ts        engine ↔ React binding (useSyncExternalStore), sim loop (rAF)
  map/            MapLibre integration
    basemap.ts      style URL, offline fallback style, 3D building extrusion layer
    overlays.ts     GeoJSON builders: zones, epicenter, routes, closures, transports
    MapView.tsx     map lifecycle + imperative sync of sources/layers/markers
    markers.tsx     DOM markers for facilities & incidents (status glyph + % + pulse)
  ui/             panels: TopBar (controls/clock), MetricsPanel, EventFeed, DetailPanel,
                  Legend, LayerToggles, AlertBanner, IntroOverlay (disclaimer)
```

Data flow: `engine.tick(simMinutes)` mutates one immutable-ish snapshot → store notifies React →
panels re-render; `MapView` diffs snapshot → updates GeoJSON sources & markers imperatively.
Determinism: all randomness seeded at init; sim logic advances on fixed 0.1-min quanta; scripted
events fire at fixed sim-times, so every run is identical.

## Domain model (summary)

- **Facility**: id, name, kind (hospital/clinic), lngLat, neighborhood, traumaLevel (I/II/ped/null),
  edCapacity, baselineOccupied · **state**: occupied, incoming[], waitMin, damage
  (none/minor/moderate/severe), accessible, derived status
  `operational | high-occupancy | near-capacity | diverting | partially-damaged | inaccessible | offline`, statusReason.
- **Incident**: id, name, lngLat, tSpawn, patients {critical, serious, minor}, requires
  (trauma/general/pediatric/minor-care), status `waiting → assigned → in-transit → delivered`,
  assignedFacilityId, route (node path + geometry), etaMin, explanation, rerouteCount, log[].
- **Road graph**: freeway polylines with named vertices → auto-generated edges (geometry sliced
  from the polyline, so drawn routes hug real corridors); arterial connectors; per-edge kind/speed.
  Closure = blocked edge (both directions) with human-readable name.

## Routing

Filter: exclude offline/inaccessible/unreachable; capability match (clinics take minor-care only;
trauma requires Level I/II; pediatric prefers the pediatric center). Score = ETA
+ 0.35·waitMin + occupancy pressure (projected occupancy incl. incoming & this load, steep past 80%,
hard penalty past 100%) + damage penalty + capability-mismatch penalty + severe-zone-facility penalty.
Diverting facilities are excluded unless literally no alternative (explanation says so).
Lowest score wins; ties broken deterministically. **Nearest is often not chosen** — the explanation
names the nearer facilities that were rejected and why, and cites the chosen facility's strengths
("closest accessible Level I trauma center, 12 ED beds open, ETA 14 min via I-110").

Reroute triggers: assigned facility goes offline/inaccessible/diverting/full → re-assign;
a closure lands on the active path → re-path (possibly same destination, "route diverted around…").
In-transit units re-path from their current position. Every reroute increments metrics + feed entry.

## Scenario (deterministic)

M6.9 mainshock on the Puente Hills thrust beneath Vernon/DTLA at T+0. Concentric-but-organic
MMI zones (severe/strong/moderate/light). ~16 incidents across DTLA, Boyle Heights, Koreatown,
Hollywood, South LA, Westlake, Van Nuys, Santa Monica, Long Beach, Watts, Highland Park, Pasadena…
Facility damage wave (one DTLA hospital red-tagged **offline** at T+10 → visible mass reroute),
freeway closures (I-10 @ La Cienega, I-110 viaduct, US-101 Hollywood, I-405 Sepulveda Pass),
occupancy surges → diverting; **M5.4 Pasadena aftershock at T+30** (Huntington damaged → diverting,
SR-110 closed, new incident); stabilization from ~T+38 (reopenings, capacity restored, discharges).
Manual "Trigger aftershock" applies a deterministic preset sequence (Santa Monica → Sylmar → minor).

## UI

Full-bleed map; left rail = quake card + live metrics + hospital summary + layer toggles;
right rail = event feed + selection detail; top bar = title, disclaimer chip, clock (T+),
transport controls (start/pause/step/reset/speed/aftershock). Legend overlay bottom-left;
persistent "PROTOTYPE — SIMULATED DATA" pill; intro overlay with scenario summary + disclaimer.
Dark ops aesthetic: near-black basemap, cyan routes, amber/red statuses, Inter + tabular numerals.
Status is never color-only: every state pairs color with a glyph + text label.

## Testing & checks

Vitest on the pure `sim/` core: pathfinding (detours on closure, unreachability), routing
(capability filters, nearest-rejected explanations, diverting exclusion, determinism), engine
(timeline application, reroute on offline, metrics consistency, reset). `tsc --noEmit`, ESLint,
`vite build` all wired as npm scripts.

## Limitations (by design)

Stylized road graph (not navigable-grade), straight-spur snapping, simulated capacities/conditions,
no persistence/auth/integrations, English-only, desktop-first.
