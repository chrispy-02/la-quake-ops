import type { Facility, FacilityState, FacilityStatus } from './types'

/**
 * Real facility names/locations are used for geographic realism; every
 * capacity, occupancy and condition value is FICTIONAL simulation data.
 * Clinics are entirely fictional.
 */
export const FACILITIES: Facility[] = [
  { id: 'lacusc', name: 'LAC+USC Medical Center', short: 'LAC+USC', kind: 'hospital', lngLat: [-118.2097, 34.0616], neighborhood: 'Boyle Heights', traumaLevel: 'I', edCapacity: 85, baselineOccupied: 60, helipad: true },
  { id: 'cedars', name: 'Cedars-Sinai Medical Center', short: 'Cedars', kind: 'hospital', lngLat: [-118.3803, 34.0752], neighborhood: 'Beverly Grove', traumaLevel: 'I', edCapacity: 78, baselineOccupied: 55, helipad: true },
  { id: 'ucla', name: 'Ronald Reagan UCLA Medical Center', short: 'UCLA', kind: 'hospital', lngLat: [-118.4452, 34.0658], neighborhood: 'Westwood', traumaLevel: 'I', edCapacity: 64, baselineOccupied: 45, helipad: true },
  { id: 'harbor', name: 'Harbor-UCLA Medical Center', short: 'Harbor-UCLA', kind: 'hospital', lngLat: [-118.2923, 33.8296], neighborhood: 'West Carson', traumaLevel: 'I', edCapacity: 58, baselineOccupied: 40, helipad: true },
  { id: 'chla', name: "Children's Hospital Los Angeles", short: 'CHLA', kind: 'hospital', lngLat: [-118.2907, 34.0977], neighborhood: 'East Hollywood', traumaLevel: 'ped', edCapacity: 46, baselineOccupied: 30, helipad: true },
  { id: 'california', name: 'California Hospital Medical Center', short: 'California', kind: 'hospital', lngLat: [-118.2665, 34.0332], neighborhood: 'South Park (DTLA)', traumaLevel: 'II', edCapacity: 46, baselineOccupied: 34 },
  { id: 'goodsam', name: 'PIH Health Good Samaritan Hospital', short: 'Good Sam', kind: 'hospital', lngLat: [-118.2668, 34.0528], neighborhood: 'Westlake', traumaLevel: null, edCapacity: 42, baselineOccupied: 31 },
  { id: 'whitemem', name: 'Adventist Health White Memorial', short: 'White Mem.', kind: 'hospital', lngLat: [-118.2199, 34.049], neighborhood: 'Boyle Heights', traumaLevel: null, edCapacity: 44, baselineOccupied: 31 },
  { id: 'hollywoodpres', name: 'CHA Hollywood Presbyterian', short: 'Hlwd Pres.', kind: 'hospital', lngLat: [-118.2973, 34.0899], neighborhood: 'East Hollywood', traumaLevel: null, edCapacity: 40, baselineOccupied: 29 },
  { id: 'kaiserla', name: 'Kaiser Permanente LA Medical Center', short: 'Kaiser LA', kind: 'hospital', lngLat: [-118.2953, 34.0974], neighborhood: 'East Hollywood', traumaLevel: null, edCapacity: 50, baselineOccupied: 36 },
  { id: 'huntington', name: 'Huntington Health', short: 'Huntington', kind: 'hospital', lngLat: [-118.1526, 34.133], neighborhood: 'Pasadena', traumaLevel: 'II', edCapacity: 55, baselineOccupied: 38, helipad: true },
  { id: 'glendaleadv', name: 'Adventist Health Glendale', short: 'Glendale Adv.', kind: 'hospital', lngLat: [-118.241, 34.149], neighborhood: 'Glendale', traumaLevel: null, edCapacity: 42, baselineOccupied: 30 },
  { id: 'stjoseph', name: 'Providence Saint Joseph', short: 'St. Joseph', kind: 'hospital', lngLat: [-118.325, 34.156], neighborhood: 'Burbank', traumaLevel: null, edCapacity: 46, baselineOccupied: 32 },
  { id: 'valleypres', name: 'Valley Presbyterian Hospital', short: 'Valley Pres.', kind: 'hospital', lngLat: [-118.4485, 34.2011], neighborhood: 'Van Nuys', traumaLevel: null, edCapacity: 42, baselineOccupied: 30 },
  { id: 'northridge', name: 'Dignity Health Northridge', short: 'Northridge', kind: 'hospital', lngLat: [-118.5276, 34.2262], neighborhood: 'Northridge', traumaLevel: 'II', edCapacity: 48, baselineOccupied: 33 },
  { id: 'holycross', name: 'Providence Holy Cross', short: 'Holy Cross', kind: 'hospital', lngLat: [-118.4677, 34.266], neighborhood: 'Mission Hills', traumaLevel: 'II', edCapacity: 44, baselineOccupied: 30, helipad: true },
  { id: 'oliveview', name: 'Olive View-UCLA Medical Center', short: 'Olive View', kind: 'hospital', lngLat: [-118.447, 34.3235], neighborhood: 'Sylmar', traumaLevel: null, edCapacity: 38, baselineOccupied: 26 },
  { id: 'mlk', name: 'MLK Jr. Community Hospital', short: 'MLK Community', kind: 'hospital', lngLat: [-118.2426, 33.9236], neighborhood: 'Willowbrook', traumaLevel: null, edCapacity: 32, baselineOccupied: 25 },
  { id: 'stfrancis', name: 'St. Francis Medical Center', short: 'St. Francis', kind: 'hospital', lngLat: [-118.211, 33.9313], neighborhood: 'Lynwood', traumaLevel: 'II', edCapacity: 50, baselineOccupied: 36, helipad: true },
  { id: 'lbmemorial', name: 'Long Beach Memorial Medical Center', short: 'LB Memorial', kind: 'hospital', lngLat: [-118.1855, 33.8062], neighborhood: 'Long Beach', traumaLevel: 'II', edCapacity: 62, baselineOccupied: 43, helipad: true },
  { id: 'stmary', name: 'Dignity Health St. Mary', short: 'St. Mary', kind: 'hospital', lngLat: [-118.1878, 33.7809], neighborhood: 'Long Beach', traumaLevel: 'II', edCapacity: 40, baselineOccupied: 28 },
  { id: 'torrance', name: 'Torrance Memorial Medical Center', short: 'Torrance Mem.', kind: 'hospital', lngLat: [-118.3467, 33.8123], neighborhood: 'Torrance', traumaLevel: 'II', edCapacity: 46, baselineOccupied: 32 },
  { id: 'smucla', name: 'UCLA Santa Monica Medical Center', short: 'UCLA SM', kind: 'hospital', lngLat: [-118.4855, 34.0295], neighborhood: 'Santa Monica', traumaLevel: null, edCapacity: 40, baselineOccupied: 28 },
  { id: 'stjohns', name: "Providence Saint John's", short: "St. John's", kind: 'hospital', lngLat: [-118.4796, 34.0328], neighborhood: 'Santa Monica', traumaLevel: null, edCapacity: 38, baselineOccupied: 27 },
  // Fictional urgent-care clinics (minor injuries only).
  { id: 'clin-echopark', name: 'Echo Park Community Urgent Care', short: 'Echo Park UC', kind: 'clinic', lngLat: [-118.26, 34.078], neighborhood: 'Echo Park', traumaLevel: null, edCapacity: 14, baselineOccupied: 6, fictional: true },
  { id: 'clin-vermont', name: 'Vermont-Slauson Urgent Care', short: 'Vermont UC', kind: 'clinic', lngLat: [-118.2915, 33.989], neighborhood: 'South LA', traumaLevel: null, edCapacity: 14, baselineOccupied: 5, fictional: true },
  { id: 'clin-venice', name: 'Venice Family Urgent Care', short: 'Venice UC', kind: 'clinic', lngLat: [-118.462, 33.988], neighborhood: 'Venice', traumaLevel: null, edCapacity: 12, baselineOccupied: 5, fictional: true },
  { id: 'clin-eaglerock', name: 'Eagle Rock Urgent Care', short: 'Eagle Rock UC', kind: 'clinic', lngLat: [-118.211, 34.139], neighborhood: 'Eagle Rock', traumaLevel: null, edCapacity: 12, baselineOccupied: 4, fictional: true },
  { id: 'clin-vannuys', name: 'Van Nuys Community Urgent Care', short: 'Van Nuys UC', kind: 'clinic', lngLat: [-118.448, 34.186], neighborhood: 'Van Nuys', traumaLevel: null, edCapacity: 14, baselineOccupied: 6, fictional: true },
]

export const FACILITY_BY_ID: ReadonlyMap<string, Facility> = new Map(
  FACILITIES.map((f) => [f.id, f]),
)

export function initialFacilityState(f: Facility): FacilityState {
  return {
    occupied: f.baselineOccupied,
    incomingPatients: 0,
    damage: 'none',
    accessible: true,
    divertingManual: false,
    offline: false,
    statusReason: null,
    walkInRate: 0,
    walkInAcc: 0,
  }
}

export function occupancyPct(f: Facility, s: FacilityState): number {
  return Math.round((s.occupied / f.edCapacity) * 100)
}

export function availableBeds(f: Facility, s: FacilityState): number {
  return Math.max(0, f.edCapacity - s.occupied)
}

/** Status precedence: offline > inaccessible > damage > diversion > occupancy bands. */
export function facilityStatus(f: Facility, s: FacilityState): FacilityStatus {
  if (s.offline) return 'offline'
  if (!s.accessible) return 'inaccessible'
  if (s.damage === 'moderate' || s.damage === 'severe') return 'partially-damaged'
  const occ = s.occupied / f.edCapacity
  if (s.divertingManual || occ >= 1.02) return 'diverting'
  if (occ >= 0.95) return 'near-capacity'
  if (occ >= 0.8) return 'high-occupancy'
  return 'operational'
}

/** Rough door-to-doctor wait estimate in minutes (simulated). */
export function waitEstimate(f: Facility, s: FacilityState): number {
  const occPct = (s.occupied / f.edCapacity) * 100
  let wait = 8 + Math.max(0, occPct - 55) * 0.6 + s.incomingPatients * 3.5
  if (s.damage === 'minor') wait += 5
  else if (s.damage === 'moderate') wait += 18
  else if (s.damage === 'severe') wait += 30
  return Math.round(wait)
}
