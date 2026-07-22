/**
 * Deterministic procedural scenario generator.
 *
 * Given an epicenter, magnitude, and depth, this produces the full scripted
 * timeline — mainshock, mass-casualty incidents, hospital damage/diversion/
 * outages, road closures, walk-in surges, a scripted aftershock, and
 * stabilization — arranged around the chosen location. Every value is derived
 * from the parameters through the seeded PRNG and the shaking model, so a given
 * (epicenter, magnitude, depth) always yields exactly the same scenario, while
 * moving the epicenter regenerates all of it.
 *
 * Real base data used: population (Census tract centroids) weights where
 * incidents concentrate; the road graph supplies real closure edges; nearest
 * fault/neighborhood name the event. The CRISIS itself is SIMULATED.
 */
import {
  FAULTS,
  POPULATION_POINTS,
  nearestFault,
  nearestNeighborhood,
} from '../data/baseData'
import { FACILITIES } from './facilities'
import { haversineKm } from './geo'
import { epicentralRadiusForMMI, mmiAt } from './hazard'
import { buildRoadNetwork, nearestNode, type RoadEdge } from './roadNetwork'
import { mulberry32 } from './rng'
import {
  DEFAULT_PARAMS,
  type AftershockPresetResult,
  type Scenario,
  type ScenarioAction,
  type ScenarioEvent,
  type ScenarioParams,
} from './scenario'
import type { Capability, IncidentSpec, LngLat } from './types'

// ── deterministic seed ─────────────────────────────────────────────────────
function seedFor(p: ScenarioParams): number {
  const parts = [
    Math.round(p.epicenter[0] * 1000),
    Math.round(p.epicenter[1] * 1000),
    Math.round(p.magnitude * 10),
    Math.round(p.depthKm * 10),
  ]
  let s = 0x811c9dc5 >>> 0
  for (const n of parts) {
    s = (s ^ (n & 0xffff)) >>> 0
    s = Math.imul(s, 0x01000193) >>> 0
  }
  return s >>> 0
}

// ── incident vocabulary ────────────────────────────────────────────────────
interface IncidentType {
  icon: string
  caps: Capability[]
  names: string[]
  triage: [number, number]
  weight: number
}
const INCIDENT_TYPES: IncidentType[] = [
  { icon: 'collapse', caps: ['trauma', 'general'], weight: 3, triage: [4, 7],
    names: ['Parking structure collapse', 'Mid-rise partial collapse', 'Retail block collapse', 'Brick storefront collapse', 'Apartment building collapse'] },
  { icon: 'fire', caps: ['trauma', 'general'], weight: 2, triage: [3, 6],
    names: ['Gas main explosion', 'Apartment tower fire', 'Structure fire with entrapment', 'Electrical fire — mixed-use block'] },
  { icon: 'building', caps: ['general', 'trauma'], weight: 3, triage: [3, 5],
    names: ['Senior center structural injuries', 'Office tower facade failure', 'Hotel stairwell collapse', 'Church roof collapse'] },
  { icon: 'industry', caps: ['trauma'], weight: 1.4, triage: [5, 7],
    names: ['Warehouse rack collapse', 'Industrial pipe rupture', 'Container stack collapse'] },
  { icon: 'school', caps: ['pediatric', 'general'], weight: 1.1, triage: [3, 5],
    names: ['School gym ceiling failure', 'School wing evacuation injuries'] },
]

const CLOSURE_DETAILS: Record<RoadEdge['kind'], string[]> = {
  freeway: ['Overpass collapse — both directions blocked', 'Buckled deck — closed for emergency inspection', 'Bridge column failure — impassable'],
  highway: ['Viaduct closed pending inspection', 'Rockslide and pavement failure', 'Retaining-wall failure'],
  arterial: ['Downed structures across roadway', 'Pavement buckling — closed to traffic', 'Fallen debris — blocked'],
}

// ── generic helpers ─────────────────────────────────────────────────────────
const ev = (t: number, action: ScenarioAction): ScenarioEvent => ({ t, action })

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))]
}

/** Deterministic weighted sample without replacement. */
function weightedSample<T>(rng: () => number, items: { item: T; weight: number }[], k: number): T[] {
  const pool = items.filter((x) => x.weight > 0).map((x) => ({ ...x }))
  const out: T[] = []
  for (let n = 0; n < k && pool.length > 0; n += 1) {
    let total = 0
    for (const x of pool) total += x.weight
    let r = rng() * total
    let idx = 0
    for (; idx < pool.length; idx += 1) {
      r -= pool[idx].weight
      if (r <= 0) break
    }
    idx = Math.min(idx, pool.length - 1)
    out.push(pool[idx].item)
    pool.splice(idx, 1)
  }
  return out
}

function shortHood(p: LngLat): string {
  return nearestNeighborhood(p).replace(/^City of /, '').replace(/^Los Angeles - /, '')
}

/** Walk a fault's polylines to a point ~targetKm from `from` (for aftershock siting). */
function pointAlongNearestFault(from: LngLat, targetKm: number, fallbackBearing: number): LngLat {
  const nf = nearestFault(from)
  if (nf) {
    const record = FAULTS.find((x) => x.name === nf.name)
    for (const line of record?.lines ?? []) {
      for (const c of line) {
        if (Math.abs(haversineKm(from, c) - targetKm) < targetKm * 0.4) return c
      }
    }
  }
  // Fallback: offset along the fault strike (or a default bearing).
  const bearing = (nf ? nf.strikeDeg : fallbackBearing) * (Math.PI / 180)
  const dLat = (targetKm / 111) * Math.cos(bearing)
  const dLng = (targetKm / (111 * Math.cos((from[1] * Math.PI) / 180))) * Math.sin(bearing)
  return [from[0] + dLng, from[1] + dLat]
}

// ── incidents ───────────────────────────────────────────────────────────────
function generateIncidents(
  rng: () => number,
  p: ScenarioParams,
): { spec: IncidentSpec; t: number; mmi: number }[] {
  const affectedR = Math.max(9, epicentralRadiusForMMI(p.magnitude, p.depthKm, 5) || 9)
  const candidates = POPULATION_POINTS.filter(
    (pt) => haversineKm(p.epicenter, pt.lngLat) <= affectedR,
  ).map((pt) => {
    const mmi = mmiAt(p.epicenter, p.magnitude, p.depthKm, pt.lngLat)
    const shaking = Math.max(0.05, mmi - 4) ** 2
    return { item: pt, weight: pt.pop * shaking }
  })
  const k = Math.max(6, Math.min(20, Math.round((p.magnitude - 5.4) * 8)))
  const chosen = weightedSample(rng, candidates, k)
  const net = buildRoadNetwork()

  const built = chosen.map((pt, i) => {
    // small deterministic jitter off the centroid
    let loc: LngLat = [
      pt.lngLat[0] + (rng() - 0.5) * 0.01,
      pt.lngLat[1] + (rng() - 0.5) * 0.008,
    ]
    // Keep the scene near a real road so the ambulance's on-scene → road leg is
    // a short connector, not a long straight line across blocks. Pull tracts
    // that sit far from the graph toward their nearest through-road node.
    const MAX_SPUR_KM = 0.6
    const node = nearestNode(net, loc)
    const spur = haversineKm(loc, node.lngLat)
    if (spur > MAX_SPUR_KM) {
      const f = 1 - MAX_SPUR_KM / spur
      loc = [
        loc[0] + (node.lngLat[0] - loc[0]) * f,
        loc[1] + (node.lngLat[1] - loc[1]) * f,
      ]
    }
    const mmi = mmiAt(p.epicenter, p.magnitude, p.depthKm, loc)
    const type = pick(rng, INCIDENT_TYPES)
    const severity = Math.max(0.15, Math.min(1.4, (mmi - 4.2) / 4))
    const magBoost = Math.max(0.2, Math.min(1.2, (p.magnitude - 5.5) / 2 + 0.3))
    const scale = severity * magBoost * 1.6
    const critical = Math.max(0, Math.round((0.4 + rng() * 2.4) * scale))
    const serious = Math.round((1.4 + rng() * 3.4) * scale)
    let minor = Math.round((1.4 + rng() * 3.4) * scale)
    if (critical + serious + minor < 3) minor += 3
    let requires: Capability = pick(rng, type.caps)
    if (critical === 0 && serious <= 1 && rng() < 0.6) requires = 'minor-care'
    const triageMin = Math.round(type.triage[0] + rng() * (type.triage[1] - type.triage[0]))
    const spec: IncidentSpec = {
      id: `inc-${i}`,
      name: pick(rng, type.names),
      icon: type.icon,
      lngLat: loc,
      neighborhood: shortHood(loc),
      patients: { critical, serious, minor },
      requires,
      triageMin,
    }
    return { spec, mmi }
  })

  // Worst-hit first, spread across the response window.
  built.sort((a, b) => b.mmi - a.mmi)
  const step = 26 / Math.max(1, built.length)
  return built.map((b, i) => ({ ...b, t: +(2 + i * step + rng() * 0.6).toFixed(2) }))
}

// ── hospital impacts ─────────────────────────────────────────────────────────
interface HospImpact {
  id: string
  mmi: number
  offline: boolean
  damage: 'none' | 'minor' | 'moderate' | 'severe'
  divert: boolean
  walkIn: number
  name: string
}
function generateHospitalImpacts(rng: () => number, p: ScenarioParams): HospImpact[] {
  const impacts: HospImpact[] = []
  for (const f of FACILITIES) {
    if (f.kind !== 'hospital') continue
    const mmi = mmiAt(p.epicenter, p.magnitude, p.depthKm, f.lngLat)
    const r = rng()
    let offline = false
    let damage: HospImpact['damage'] = 'none'
    let divert = false
    let walkIn = 0
    if (mmi >= 8.3 && r < 0.5) {
      offline = true
      damage = 'severe'
    } else if (mmi >= 7.6 && r < 0.62) {
      damage = 'moderate'
      divert = true
    } else if (mmi >= 6.8 && r < 0.6) {
      damage = r < 0.22 ? 'moderate' : 'minor'
      divert = damage === 'moderate'
    } else if (mmi >= 6.0) {
      damage = r < 0.25 ? 'minor' : 'none'
    }
    if (mmi >= 5.2) walkIn = +Math.min(0.6, Math.max(0.08, 0.12 * (mmi - 4.4))).toFixed(2)
    impacts.push({ id: f.id, mmi, offline, damage, divert, walkIn, name: f.name })
  }
  // Cap outages so the scenario stays playable: at most 2 red-tagged hospitals.
  const offlineSorted = impacts.filter((h) => h.offline).sort((a, b) => b.mmi - a.mmi)
  offlineSorted.slice(2).forEach((h) => {
    h.offline = false
    h.damage = 'moderate'
    h.divert = true
  })
  return impacts.sort((a, b) => b.mmi - a.mmi)
}

// ── closures ─────────────────────────────────────────────────────────────────
function generateClosures(rng: () => number, p: ScenarioParams) {
  const net = buildRoadNetwork()
  const cands: { edge: RoadEdge; mmi: number }[] = []
  for (const edge of net.edges.values()) {
    const mid = edge.coords[Math.floor(edge.coords.length / 2)]
    const mmi = mmiAt(p.epicenter, p.magnitude, p.depthKm, mid)
    if (mmi >= 6.9 && edge.kind !== 'arterial') cands.push({ edge, mmi })
    else if (mmi >= 7.6) cands.push({ edge, mmi })
  }
  cands.sort((a, b) => b.mmi - a.mmi)
  const perCorridor = new Map<string, number>()
  const chosen: { edge: RoadEdge; mmi: number }[] = []
  for (const c of cands) {
    const corridor = c.edge.id.split(':')[0]
    const used = perCorridor.get(corridor) ?? 0
    if (used >= 2) continue
    perCorridor.set(corridor, used + 1)
    chosen.push(c)
    if (chosen.length >= 5) break
  }
  return chosen.map((c, i) => ({
    id: `cl-${i}`,
    edgeIds: [c.edge.id],
    name: c.edge.name,
    detail: pick(rng, CLOSURE_DETAILS[c.edge.kind]),
    t: +(5 + i * 3.5 + rng()).toFixed(2),
  }))
}

// ── mainshock scenario ───────────────────────────────────────────────────────
export function buildScenario(params: ScenarioParams): Scenario {
  const rng = mulberry32(seedFor(params))
  const { epicenter, magnitude, depthKm } = params
  const fault = nearestFault(epicenter)
  const faultName = fault ? fault.name : 'an unnamed fault'
  const hood = shortHood(epicenter)
  const mag = magnitude.toFixed(1)
  const events: ScenarioEvent[] = []

  events.push(
    ev(0, { type: 'quake', quake: {
      id: 'mainshock', name: `${faultName} — near ${hood}`,
      magnitude, epicenter, depthKm, t: 0, kind: 'mainshock',
    } }),
    ev(0, { type: 'banner', severity: 'critical',
      title: `M${mag} EARTHQUAKE — ${faultName.toUpperCase()}`,
      sub: `Epicenter: ${hood} · Depth ${Math.round(depthKm)} km · SIMULATED` }),
    ev(0, { type: 'feed', severity: 'critical', category: 'seismic',
      msg: `ShakeAlert (simulated): M${mag} earthquake — ${faultName} near ${hood}. Strong shaking across the region.` }),
    ev(0.3, { type: 'feed', severity: 'info', category: 'system',
      msg: 'County EOC activated — Level 1 (full activation). Regional disaster protocols in effect.' }),
    ev(0.8, { type: 'feed', severity: 'info', category: 'hospital',
      msg: 'All hospitals: HICS disaster protocols activated. EDs clearing non-urgent patients.' }),
    ev(1.5, { type: 'feed', severity: 'warning', category: 'seismic',
      msg: 'USGS (simulated): elevated chance of a strong aftershock within 24 hours.' }),
  )

  // Incidents
  const incidents = generateIncidents(rng, params)
  for (const it of incidents) events.push(ev(it.t, { type: 'incident', spec: it.spec }))

  // Hospital impacts (staggered)
  const impacts = generateHospitalImpacts(rng, params)
  impacts.forEach((h, i) => {
    const t = +(3 + i * 0.5).toFixed(2)
    if (h.offline) {
      events.push(ev(t, { type: 'facility', facilityId: h.id,
        patch: { offline: true, damage: 'severe', walkInRate: 0, statusReason: 'Red-tagged — structural failure in ED wing' },
        feedMsg: `${h.name} OFFLINE — structural red tag. All patients diverting.`, severity: 'critical' }))
      events.push(ev(t, { type: 'banner', severity: 'critical',
        title: `HOSPITAL OFFLINE — ${h.name.toUpperCase()}`, sub: 'Structural red tag · inbound patients rerouting' }))
    } else if (h.damage === 'moderate') {
      events.push(ev(t, { type: 'facility', facilityId: h.id,
        patch: { damage: 'moderate', divertingManual: h.divert, walkInRate: h.walkIn,
          statusReason: h.divert ? 'Structural damage — ED diversion declared' : 'Moderate structural damage — reduced ED capacity' },
        feedMsg: `${h.name} reports moderate structural damage${h.divert ? ' — diverting' : ''}.`, severity: 'warning' }))
    } else if (h.damage === 'minor') {
      events.push(ev(t, { type: 'facility', facilityId: h.id,
        patch: { damage: 'minor', walkInRate: h.walkIn, statusReason: 'Minor damage — fully operational' },
        feedMsg: `${h.name}: minor damage, remains operational.`, severity: 'info' }))
    } else if (h.walkIn > 0) {
      events.push(ev(t, { type: 'facility', facilityId: h.id, patch: { walkInRate: h.walkIn } }))
    }
  })

  // Closures
  const closures = generateClosures(rng, params)
  closures.forEach((c) => {
    events.push(ev(c.t, { type: 'closure', closure: { id: c.id, edgeIds: c.edgeIds, name: c.name, detail: c.detail } }))
  })
  if (closures[0]) {
    events.push(ev(closures[0].t, { type: 'banner', severity: 'warning',
      title: `${closures[0].name.toUpperCase()} CLOSED`, sub: closures[0].detail }))
  }

  // Scripted aftershock (~T+30) on a nearby fault
  const aShockEpi = pointAlongNearestFault(epicenter, 14, fault ? fault.strikeDeg : 115)
  const aMag = +Math.max(3.8, magnitude - (1.3 + rng() * 0.5)).toFixed(1)
  const aHood = shortHood(aShockEpi)
  const aFault = nearestFault(aShockEpi)
  events.push(
    ev(30, { type: 'quake', quake: {
      id: 'aftershock-1', name: `${aFault ? aFault.name : 'aftershock'} — ${aHood}`,
      magnitude: aMag, epicenter: aShockEpi, depthKm: Math.max(5, depthKm - 3), t: 30, kind: 'aftershock' } }),
    ev(30, { type: 'banner', severity: 'critical', title: `M${aMag.toFixed(1)} AFTERSHOCK — ${aHood.toUpperCase()}`, sub: 'New damage reports inbound · SIMULATED' }),
    ev(30, { type: 'feed', severity: 'critical', category: 'seismic', msg: `M${aMag.toFixed(1)} aftershock near ${aHood}. Renewed strong shaking.` }),
  )
  // nearest hospital to the aftershock diverts
  const nearestHosp = [...FACILITIES]
    .filter((f) => f.kind === 'hospital')
    .sort((a, b) => haversineKm(aShockEpi, a.lngLat) - haversineKm(aShockEpi, b.lngLat))[0]
  if (nearestHosp) {
    events.push(ev(30.4, { type: 'facility', facilityId: nearestHosp.id,
      patch: { damage: 'moderate', divertingManual: true, statusReason: 'Aftershock damage — ED diversion declared' },
      feedMsg: `${nearestHosp.name} diverting after aftershock damage`, severity: 'critical' }))
  }

  // Stabilization + recovery
  events.push(
    ev(36, { type: 'stabilize' }),
    ev(36, { type: 'feed', severity: 'success', category: 'system', msg: 'Region entering stabilization — mutual-aid ambulance strike teams arriving.' }),
  )
  if (closures[0]) {
    events.push(ev(38, { type: 'reopen', closureId: closures[0].id, feedMsg: `${closures[0].name}: lanes reopened to emergency traffic` }))
  }
  if (nearestHosp) {
    events.push(ev(42, { type: 'facility', facilityId: nearestHosp.id,
      patch: { divertingManual: false, statusReason: 'Accepting ambulances — damage contained' },
      feedMsg: `${nearestHosp.name} accepting ambulances again`, severity: 'success' }))
  }
  events.push(ev(45, { type: 'feed', severity: 'info', category: 'system', msg: 'USAR teams (simulated) completing primary search of collapse sites.' }))

  events.sort((a, b) => a.t - b.t)
  return {
    name: `M${mag} · ${hood}`,
    description: `Simulated M${mag} earthquake on ${faultName} near ${hood}, with hospital damage, freeway closures, mass-casualty incidents, an aftershock, and gradual stabilization. Real geography; simulated crisis.`,
    durationMin: 75,
    events,
  }
}

/** Convenience: the default (Puente Hills M6.9) scenario. */
export function buildDefaultScenario(): Scenario {
  return buildScenario(DEFAULT_PARAMS)
}

// ── manual aftershocks ───────────────────────────────────────────────────────
/**
 * Deterministic manual-aftershock generator, cycled by trigger count (1-based).
 * Places successively smaller aftershocks on faults near the current epicenter.
 */
export function generateAftershock(params: ScenarioParams, n: number): AftershockPresetResult {
  const rng = mulberry32((seedFor(params) ^ Math.imul(n, 0x9e3779b1)) >>> 0)
  const mags = [5.1, 4.8, 4.3]
  const dists = [10, 16, 6]
  const idx = (n - 1) % 3
  const mag = Math.min(mags[idx], +Math.max(3.9, params.magnitude - 1.6).toFixed(1))
  const epi = pointAlongNearestFault(params.epicenter, dists[idx] + rng() * 3, 115 + idx * 40)
  const hood = shortHood(epi)
  const fault = nearestFault(epi)
  const nearestHosp = [...FACILITIES]
    .filter((f) => f.kind === 'hospital')
    .sort((a, b) => haversineKm(epi, a.lngLat) - haversineKm(epi, b.lngLat))[0]
  const events: ScenarioAction[] = [
    { type: 'banner', severity: 'critical', title: `M${mag.toFixed(1)} AFTERSHOCK — ${hood.toUpperCase()}`, sub: 'Renewed shaking · SIMULATED' },
    { type: 'feed', severity: 'critical', category: 'seismic', msg: `M${mag.toFixed(1)} aftershock near ${hood}${fault ? ` (${fault.name})` : ''}. Facilities reporting.` },
  ]
  if (nearestHosp) {
    events.push({
      type: 'facility', facilityId: nearestHosp.id,
      patch: { damage: 'minor', divertingManual: true, statusReason: 'Aftershock — precautionary ED diversion' },
      feedMsg: `${nearestHosp.name} diverting after aftershock (precautionary)`, severity: 'warning',
    })
  }
  return {
    quake: { id: `manual-${hood.toLowerCase().replace(/\W+/g, '-')}`, name: `${fault ? fault.name : 'Aftershock'} — ${hood}`, magnitude: mag, epicenter: epi, depthKm: 8, t: 0, kind: 'aftershock' },
    events,
  }
}
