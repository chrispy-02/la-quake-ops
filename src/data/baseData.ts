/**
 * Typed access to the REAL BASE DATA snapshots plus small geographic lookups
 * (nearest neighborhood, nearest fault + strike, in-county test, population
 * weighting). All values here are real; nothing in this module is simulated.
 */
import { haversineKm } from '../sim/geo'
import type { LngLat } from '../sim/types'
import countyRaw from './snapshots/county.json'
import faultsRaw from './snapshots/faults.json'
import hospitalsRaw from './snapshots/hospitals.json'
import neighborhoodsRaw from './snapshots/neighborhoods.json'
import populationRaw from './snapshots/population.json'

export type ErLevel = 'comprehensive' | 'basic' | 'standby' | 'none'
export type TraumaAdult = 'I' | 'II' | 'III' | 'IV' | null
export type TraumaPeds = 'I' | 'II' | null

/** Real hospital record from the HCAI + EMSA snapshots. */
export interface HospitalRecord {
  id: string
  name: string
  short: string
  oshpdId: string
  lngLat: LngLat
  city: string
  licensedBeds: number
  erLevel: ErLevel
  traumaAdult: TraumaAdult
  traumaPeds: TraumaPeds
}

export interface FaultRecord {
  name: string
  slipRate: string | null
  lines: LngLat[][]
}

export interface NeighborhoodPoint {
  lngLat: LngLat
  name: string
}

export interface PopulationPoint {
  lngLat: LngLat
  pop: number
}

export const HOSPITAL_RECORDS: HospitalRecord[] = (hospitalsRaw as unknown[]).map(
  (h) => h as HospitalRecord,
)

export const FAULTS: FaultRecord[] = faultsRaw as unknown as FaultRecord[]

export const NEIGHBORHOODS: NeighborhoodPoint[] = (
  neighborhoodsRaw as [number, number, string][]
).map(([lng, lat, name]) => ({ lngLat: [lng, lat], name }))

export const POPULATION_POINTS: PopulationPoint[] = (
  (populationRaw as unknown as { points: [number, number, number][] }).points
).map(([lng, lat, pop]) => ({ lngLat: [lng, lat], pop }))

export const COUNTY_RINGS: LngLat[][] = (countyRaw as { rings: LngLat[][] }).rings

/** Bounding box of the county (mainland + islands), for camera/overview use. */
export const COUNTY_BBOX = (() => {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  for (const ring of COUNTY_RINGS) {
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng
      if (lat < minLat) minLat = lat
      if (lng > maxLng) maxLng = lng
      if (lat > maxLat) maxLat = lat
    }
  }
  return { minLng, minLat, maxLng, maxLat }
})()

function pointInRing(p: LngLat, ring: LngLat[]): boolean {
  const [x, y] = p
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/** True if the point falls inside the (real) LA County boundary. */
export function isInLACounty(p: LngLat): boolean {
  return COUNTY_RINGS.some((ring) => pointInRing(p, ring))
}

/** Nearest neighborhood/community name to a point (by centroid distance). */
export function nearestNeighborhood(p: LngLat): string {
  let best = NEIGHBORHOODS[0]
  let bestD = Infinity
  for (const n of NEIGHBORHOODS) {
    const d = haversineKm(p, n.lngLat)
    if (d < bestD) {
      bestD = d
      best = n
    }
  }
  return best.name
}

export interface NearestFault {
  name: string
  slipRate: string | null
  distanceKm: number
  /** Local strike of the nearest fault segment, degrees clockwise from north (0–180). */
  strikeDeg: number
}

function segStrikeDeg(a: LngLat, b: LngLat): number {
  const dLng = (b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180))
  const dLat = b[1] - a[1]
  let deg = (Math.atan2(dLng, dLat) * 180) / Math.PI
  deg = ((deg % 180) + 180) % 180
  return deg
}

/**
 * Nearest mapped fault to a point, with the local strike of the closest
 * segment (used to elongate shake zones along the fault). Returns null only if
 * the fault snapshot is empty.
 */
export function nearestFault(p: LngLat): NearestFault | null {
  let best: NearestFault | null = null
  for (const fault of FAULTS) {
    for (const line of fault.lines) {
      for (let i = 1; i < line.length; i += 1) {
        const a = line[i - 1]
        const b = line[i]
        const d = pointToSegmentKm(p, a, b)
        if (!best || d < best.distanceKm) {
          best = {
            name: fault.name,
            slipRate: fault.slipRate,
            distanceKm: d,
            strikeDeg: segStrikeDeg(a, b),
          }
        }
      }
    }
  }
  return best
}

function pointToSegmentKm(p: LngLat, a: LngLat, b: LngLat): number {
  // Project in a local equirectangular frame (km), clamp to the segment.
  const latRef = (p[1] * Math.PI) / 180
  const kx = 111.32 * Math.cos(latRef)
  const ky = 110.57
  const px = p[0] * kx
  const py = p[1] * ky
  const ax = a[0] * kx
  const ay = a[1] * ky
  const bx = b[0] * kx
  const by = b[1] * ky
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}
