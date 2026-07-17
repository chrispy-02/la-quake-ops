import { mulberry32 } from './rng'
import type { LngLat } from './types'

const EARTH_RADIUS_KM = 6371
const DEG = Math.PI / 180

export interface OrganicPolygonOptions {
  seed?: number
  points?: number
  /** Stretch factor along `bearingDeg` (1 = circle). */
  elongation?: number
  /** Direction of the major axis, degrees clockwise from north. */
  bearingDeg?: number
  /** Relative amplitude of the organic wobble. */
  roughness?: number
}

export function haversineKm(a: LngLat, b: LngLat): number {
  const dLat = (b[1] - a[1]) * DEG
  const dLng = (b[0] - a[0]) * DEG
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * DEG) * Math.cos(b[1] * DEG) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(s)))
}

export function destination(origin: LngLat, distKm: number, bearingDeg: number): LngLat {
  const delta = distKm / EARTH_RADIUS_KM
  const theta = bearingDeg * DEG
  const phi1 = origin[1] * DEG
  const lambda1 = origin[0] * DEG
  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta),
  )
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2),
    )
  return [lambda2 / DEG, phi2 / DEG]
}

export function pointInPolygon(p: LngLat, polygon: LngLat[]): boolean {
  const [x, y] = p
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Deterministic, irregular "shake zone" ring: an ellipse with smooth
 * low-frequency wobble, closed for GeoJSON use.
 */
export function organicPolygon(
  center: LngLat,
  radiusKm: number,
  options: OrganicPolygonOptions = {},
): LngLat[] {
  const {
    seed = 1,
    points = 48,
    elongation = 1,
    bearingDeg = 0,
    roughness = 0.07,
  } = options
  const rng = mulberry32(seed)
  const harmonics = [2, 3, 4].map((k) => ({
    k,
    amp: roughness * (0.4 + rng() * 0.6),
    phase: rng() * Math.PI * 2,
  }))
  const a = radiusKm * elongation
  const b = radiusKm
  const bearingRad = bearingDeg * DEG
  const ring: LngLat[] = []
  for (let i = 0; i < points; i += 1) {
    const theta = (i / points) * Math.PI * 2
    const delta = theta - bearingRad
    const ellipseR =
      (a * b) / Math.sqrt((b * Math.cos(delta)) ** 2 + (a * Math.sin(delta)) ** 2)
    let wobble = 0
    for (const h of harmonics) wobble += h.amp * Math.sin(h.k * theta + h.phase)
    ring.push(destination(center, ellipseR * (1 + wobble), theta / DEG))
  }
  ring.push([...ring[0]] as LngLat)
  return ring
}

export function pathLengthKm(coords: LngLat[]): number {
  let total = 0
  for (let i = 1; i < coords.length; i += 1) {
    total += haversineKm(coords[i - 1], coords[i])
  }
  return total
}

/** Point at `fraction` (0..1) of the way along a polyline, by distance. */
export function pointAlong(coords: LngLat[], fraction: number): LngLat {
  if (coords.length === 0) return [0, 0]
  if (fraction <= 0) return [...coords[0]] as LngLat
  if (fraction >= 1) return [...coords[coords.length - 1]] as LngLat
  const total = pathLengthKm(coords)
  if (total === 0) return [...coords[0]] as LngLat
  let target = total * fraction
  for (let i = 1; i < coords.length; i += 1) {
    const seg = haversineKm(coords[i - 1], coords[i])
    if (seg >= target && seg > 0) {
      const f = target / seg
      return [
        coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * f,
        coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * f,
      ]
    }
    target -= seg
  }
  return [...coords[coords.length - 1]] as LngLat
}
