/**
 * Provenance for every REAL BASE DATA source the app ships.
 *
 * Each entry documents where the data came from, when it was retrieved, and its
 * license, and points at the checked-in snapshot the app actually loads (the
 * "fallback snapshot"). The demo runs entirely from these snapshots — no network
 * calls, no API keys — so it is deterministic and works offline. The snapshots
 * are re-derivable from the source URLs via `scripts/build-data-snapshots.py`.
 *
 * CRISIS conditions (shaking, damage, closures, incidents, ED occupancy,
 * diversion) are SIMULATED and are never sourced from these feeds — see README.
 */

export type DataClass = 'real' | 'simulated'

export interface Provenance {
  id: string
  label: string
  /** What this dataset provides in the app. */
  provides: string
  source: string
  url: string
  /** ISO date the snapshot was retrieved from source. */
  retrieved: string
  license: string
  /** REAL base data, or a SIMULATED baseline derived from real data. */
  klass: DataClass
  note?: string
}

/** Date the shipped snapshots were retrieved from their sources. */
export const SNAPSHOT_AS_OF = '2026-07-20'

export const PROVENANCE: Provenance[] = [
  {
    id: 'hcai-facilities',
    label: 'Hospital roster, locations & licensed beds',
    provides: 'Real facility names, coordinates, licensed bed counts, and ED service levels',
    source: 'California Dept. of Health Care Access and Information (HCAI)',
    url: 'https://data.chhs.ca.gov/dataset/licensed-healthcare-facility-listing',
    retrieved: SNAPSHOT_AS_OF,
    license: 'California open data (CHHS Open Data Portal terms of use)',
    klass: 'real',
    note: 'Current Licensed Healthcare Facility Listing. Licensed bed counts are total facility beds — NOT live available ED beds.',
  },
  {
    id: 'emsa-trauma',
    label: 'Trauma-center designations',
    provides: 'Real adult & pediatric trauma-center levels for LA County hospitals',
    source: 'California Emergency Medical Services Authority (EMSA)',
    url: 'https://emsa.ca.gov/trauma/',
    retrieved: SNAPSHOT_AS_OF,
    license: 'California public record',
    klass: 'real',
    note: 'EMSA "Designated Trauma Centers" (LA County / Southwest region), updated 8/25/2025. LEMSAs designate levels; EMSA compiles.',
  },
  {
    id: 'usgs-qfaults',
    label: 'Quaternary faults',
    provides: 'Real mapped fault traces used for nearest-fault readout and shake-zone shaping',
    source: 'U.S. Geological Survey — Quaternary Fault and Fold Database',
    url: 'https://earthquake.usgs.gov/arcgis/rest/services/haz/Qfaults/MapServer',
    retrieved: SNAPSHOT_AS_OF,
    license: 'Public domain (U.S. Government)',
    klass: 'real',
    note: 'Generalized traces for named faults intersecting the LA metro. Fault geometry is real; rupture on a given fault is SIMULATED.',
  },
  {
    id: 'census-pop',
    label: 'Population (tract centers of population)',
    provides: 'Real population weighting for where simulated incidents concentrate',
    source: 'U.S. Census Bureau — 2020 Centers of Population',
    url: 'https://www.census.gov/geographies/reference-files/time-series/geo/centers-population.html',
    retrieved: SNAPSHOT_AS_OF,
    license: 'Public domain (U.S. Government)',
    klass: 'real',
    note: 'Census tract population-weighted centroids, LA County (FIPS 06037).',
  },
  {
    id: 'census-county',
    label: 'LA County boundary',
    provides: 'Real county outline for epicenter validation and the county overview',
    source: 'U.S. Census Bureau — TIGER/Line (TIGERweb)',
    url: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer',
    retrieved: SNAPSHOT_AS_OF,
    license: 'Public domain (U.S. Government)',
    klass: 'real',
    note: 'Generalized boundary of Los Angeles County (GEOID 06037).',
  },
  {
    id: 'lacounty-csa',
    label: 'Neighborhoods',
    provides: 'Real community/neighborhood names for the nearest-neighborhood readout',
    source: 'County of Los Angeles — Countywide Statistical Areas (eGIS)',
    url: 'https://egis-lacounty.hub.arcgis.com/',
    retrieved: SNAPSHOT_AS_OF,
    license: 'LA County open data',
    klass: 'real',
    note: 'Countywide Statistical Area community centroids and labels.',
  },
  {
    id: 'osm-basemap',
    label: 'Basemap, roads & building footprints',
    provides: 'Real street map, freeway shapes, and 3D building footprints',
    source: 'OpenFreeMap · OpenMapTiles · © OpenStreetMap contributors',
    url: 'https://openfreemap.org',
    retrieved: SNAPSHOT_AS_OF,
    license: 'ODbL (OpenStreetMap) · OpenMapTiles schema',
    klass: 'real',
    note: 'Fetched at runtime, key-free. The routing graph is a stylized hand-traced subset (see README).',
  },
  {
    id: 'osrm-roads',
    label: 'Route geometry (road-following polylines)',
    provides: 'Real driving polylines for each graph edge and hospital access road',
    source: 'OSRM (router.project-osrm.org) · © OpenStreetMap contributors',
    url: 'https://project-osrm.org',
    retrieved: SNAPSHOT_AS_OF,
    license: 'ODbL (OpenStreetMap)',
    klass: 'real',
    note: 'Snapshotted geometry so displayed routes hug real streets. Travel times/ETAs remain a SIMULATED post-quake model, not OSRM durations.',
  },
  {
    id: 'sim-conditions',
    label: 'Crisis conditions (shaking, damage, ED status, incidents)',
    provides: 'ED occupancy, available beds, damage, diversion, closures, incidents, aftershocks',
    source: 'Simulated by this app',
    url: '',
    retrieved: SNAPSHOT_AS_OF,
    license: '—',
    klass: 'simulated',
    note: 'No authoritative public real-time feed exists for these. Baselines are derived from real licensed capacity and labeled SIMULATED; they are not live data.',
  },
]

export const PROVENANCE_BY_ID: ReadonlyMap<string, Provenance> = new Map(
  PROVENANCE.map((p) => [p.id, p]),
)
