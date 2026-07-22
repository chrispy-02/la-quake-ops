import { HOSPITAL_RECORDS, type HospitalRecord, nearestNeighborhood } from '../data/baseData'
import type { Facility, FacilityState, FacilityStatus, TraumaLevel } from './types'

/**
 * REAL BASE DATA — names, coordinates, licensed beds, ED service levels (HCAI)
 * and trauma designations (EMSA) come straight from the checked-in snapshots
 * (see `src/data/provenance.ts`). The neighborhood is the nearest real LA County
 * community centroid.
 *
 * SIMULATED — ED surge capacity and baseline occupancy are derived from the real
 * licensed bed count purely to give the demo plausible ED sizes. They are NOT
 * live bed availability. Clinics are entirely fictional.
 */

/** Routing-canonical trauma level from real EMSA adult/pediatric designations. */
function traumaLevelOf(r: HospitalRecord): TraumaLevel {
  if (r.traumaAdult === 'I') return 'I'
  if (r.traumaAdult === 'II') return 'II'
  if (r.traumaPeds) return 'ped'
  return null
}

/** SIMULATED ED surge capacity, derived from real licensed beds (~11%, clamped). */
function derivedEdCapacity(licensedBeds: number): number {
  return Math.max(16, Math.min(90, Math.round(licensedBeds * 0.11)))
}

function hospitalFacility(r: HospitalRecord): Facility {
  const edCapacity = derivedEdCapacity(r.licensedBeds)
  return {
    id: r.id,
    name: r.name,
    short: r.short,
    kind: 'hospital',
    lngLat: r.lngLat,
    neighborhood: nearestNeighborhood(r.lngLat).replace(/^City of /, '').replace(/^Los Angeles - /, ''),
    city: r.city,
    oshpdId: r.oshpdId,
    licensedBeds: r.licensedBeds,
    erLevel: r.erLevel,
    traumaLevel: traumaLevelOf(r),
    traumaAdult: r.traumaAdult,
    traumaPeds: r.traumaPeds,
    edCapacity,
    baselineOccupied: Math.round(edCapacity * 0.72),
    helipad: r.traumaAdult === 'I' || r.traumaAdult === 'II' || r.traumaPeds === 'I',
  }
}

const CLINICS: Facility[] = [
  { id: 'clin-echopark', name: 'Echo Park Community Urgent Care', short: 'Echo Park UC', kind: 'clinic', lngLat: [-118.26, 34.078], neighborhood: 'Echo Park', traumaLevel: null, edCapacity: 14, baselineOccupied: 6, fictional: true },
  { id: 'clin-vermont', name: 'Vermont-Slauson Urgent Care', short: 'Vermont UC', kind: 'clinic', lngLat: [-118.2915, 33.989], neighborhood: 'South LA', traumaLevel: null, edCapacity: 14, baselineOccupied: 5, fictional: true },
  { id: 'clin-venice', name: 'Venice Family Urgent Care', short: 'Venice UC', kind: 'clinic', lngLat: [-118.462, 33.988], neighborhood: 'Venice', traumaLevel: null, edCapacity: 12, baselineOccupied: 5, fictional: true },
  { id: 'clin-eaglerock', name: 'Eagle Rock Urgent Care', short: 'Eagle Rock UC', kind: 'clinic', lngLat: [-118.211, 34.139], neighborhood: 'Eagle Rock', traumaLevel: null, edCapacity: 12, baselineOccupied: 4, fictional: true },
  { id: 'clin-vannuys', name: 'Van Nuys Community Urgent Care', short: 'Van Nuys UC', kind: 'clinic', lngLat: [-118.448, 34.186], neighborhood: 'Van Nuys', traumaLevel: null, edCapacity: 14, baselineOccupied: 6, fictional: true },
]

export const FACILITIES: Facility[] = [...HOSPITAL_RECORDS.map(hospitalFacility), ...CLINICS]

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
