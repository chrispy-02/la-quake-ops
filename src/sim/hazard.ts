/**
 * Simplified, deterministic ground-shaking model.
 *
 * NOT scientifically validated. This is a demo approximation, not a USGS
 * ShakeMap. Intensity follows a monotonic magnitude/distance attenuation of the
 * form used by intensity-prediction equations (higher magnitude → stronger and
 * broader shaking; greater hypocentral distance and greater depth → weaker
 * surface shaking), calibrated to produce a plausible MMI footprint for the LA
 * basin. Real fault geometry is used only to *shape* zones (elongation along the
 * nearest mapped fault's strike) so footprints are not identical circles.
 *
 * The same model drives shake zones, hospital impacts, incident concentration,
 * and road closures, so changing the epicenter, magnitude, or depth changes all
 * of them coherently.
 */
import { nearestFault } from '../data/baseData'
import { haversineKm, organicPolygon } from './geo'
import type { LngLat, Quake, ShakeZone } from './types'

/** MMI = C0 + C1·M − C2·ln(R_hypo). Coefficients tuned for a plausible basin footprint. */
const C0 = 4.0
const C1 = 1.8
const C2 = 3.2
/** Distance floor (km) so intensity stays finite at the epicenter. */
const R_FLOOR = 1.2

export interface ZoneBand {
  kind: ShakeZone['kind']
  label: string
  /** MMI threshold this band's outer edge traces. */
  mmi: number
}

/** Bands from strongest (inner) to weakest (outer). */
export const ZONE_BANDS: ZoneBand[] = [
  { kind: 'severe', label: 'MMI VIII+ · Severe', mmi: 8 },
  { kind: 'strong', label: 'MMI VII · Very strong', mmi: 7 },
  { kind: 'moderate', label: 'MMI VI · Strong', mmi: 6 },
  { kind: 'light', label: 'MMI V · Moderate', mmi: 5 },
]

/** Hypocentral distance (km) from an epicenter+depth to a surface point. */
export function hypocentralKm(epicenter: LngLat, depthKm: number, point: LngLat): number {
  const epi = haversineKm(epicenter, point)
  return Math.sqrt(epi * epi + depthKm * depthKm)
}

/** Modified Mercalli Intensity at a surface point (clamped to [1, 10]). */
export function mmiAt(
  epicenter: LngLat,
  magnitude: number,
  depthKm: number,
  point: LngLat,
): number {
  const r = Math.max(R_FLOOR, hypocentralKm(epicenter, depthKm, point))
  const mmi = C0 + C1 * magnitude - C2 * Math.log(r)
  return Math.max(1, Math.min(10, mmi))
}

/**
 * Epicentral radius (km) at which surface MMI drops to `mmi`. Closed-form
 * inverse of the attenuation. Returns 0 when the threshold is never reached
 * (e.g. a small/deep quake whose epicentral intensity is already below `mmi`).
 */
export function epicentralRadiusForMMI(magnitude: number, depthKm: number, mmi: number): number {
  const rHypo = Math.exp((C0 + C1 * magnitude - mmi) / C2)
  const d2 = rHypo * rHypo - depthKm * depthKm
  return d2 > 0 ? Math.sqrt(d2) : 0
}

function seedFromId(id: string): number {
  let s = 0
  for (const ch of id) s = (s * 31 + ch.charCodeAt(0)) >>> 0
  return s
}

/**
 * Shake zones for a quake: concentric MMI bands sized by the attenuation model
 * and elongated along the nearest mapped fault's strike, so footprints reflect
 * magnitude, depth, and fault orientation rather than fixed circles.
 */
export function zonesForQuake(quake: Quake): ShakeZone[] {
  const seedBase = seedFromId(quake.id)
  const fault = nearestFault(quake.epicenter)
  // Elongate along fault strike; aftershocks slightly rounder.
  const bearingDeg = fault ? fault.strikeDeg : 115
  const baseElong = quake.kind === 'mainshock' ? 1.34 : 1.22
  const zones: ShakeZone[] = []
  ZONE_BANDS.forEach((band, idx) => {
    const radiusKm = epicentralRadiusForMMI(quake.magnitude, quake.depthKm, band.mmi)
    if (radiusKm < 0.4) return
    zones.push({
      id: `${quake.id}-${band.kind}`,
      kind: band.kind,
      label: band.label,
      center: quake.epicenter,
      polygon: organicPolygon(quake.epicenter, radiusKm, {
        seed: (seedBase + idx * 97) % 100000,
        elongation: baseElong - idx * 0.03,
        bearingDeg,
        roughness: 0.09,
      }),
    })
  })
  return zones
}
