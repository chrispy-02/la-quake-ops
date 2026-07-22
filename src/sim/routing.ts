import { FACILITY_BY_ID, availableBeds, facilityStatus, occupancyPct, waitEstimate } from './facilities'
import { haversineKm, pointInPolygon } from './geo'
import { findPath, type PathResult } from './pathfinding'
import type { RoadNetwork } from './roadNetwork'
import type { Capability, Facility, FacilityState, Incident, ShakeZone } from './types'

export interface AssignmentContext {
  net: RoadNetwork
  facilities: Facility[]
  states: Record<string, FacilityState>
  closedEdgeIds: Set<string>
  zones: ShakeZone[]
}

export interface AssignmentResult {
  facilityId: string
  path: PathResult
  etaMin: number
  score: number
  explanation: string
  rejectedNearer: { facilityId: string; reason: string }[]
}

export function capabilityOk(f: Facility, cap: Capability): boolean {
  if (f.kind === 'clinic') return cap === 'minor-care'
  if (cap === 'trauma') return f.traumaLevel === 'I' || f.traumaLevel === 'II'
  return true
}

export function facilityDescriptor(f: Facility): string {
  if (f.traumaLevel === 'I') return 'Level I trauma center'
  if (f.traumaLevel === 'II') return 'Level II trauma center'
  if (f.traumaLevel === 'ped') return 'pediatric trauma center'
  if (f.kind === 'clinic') return 'urgent-care clinic'
  return 'community hospital ED'
}

interface Candidate {
  f: Facility
  path: PathResult
  eta: number
  score: number
  waitMin: number
  projOcc: number
}

interface Rejection {
  facilityId: string
  reason: string
  refKm: number
}

/**
 * Pick the best facility for an incident. Considers operational status,
 * capability, projected occupancy (incl. inbound patients), wait time, damage,
 * travel time under closures and shake-zone slowdowns. Returns a
 * human-readable explanation naming nearer facilities that were rejected.
 */
export function assignIncident(
  incident: Incident,
  ctx: AssignmentContext,
): AssignmentResult | null {
  const load = incident.patients.critical + incident.patients.serious + incident.patients.minor
  const severeZones = ctx.zones.filter((z) => z.kind === 'severe')

  const strict: Candidate[] = []
  const relaxed: Candidate[] = []
  const rejections: Rejection[] = []

  for (const f of ctx.facilities) {
    if (!capabilityOk(f, incident.requires)) continue
    const s = ctx.states[f.id]
    if (!s) continue
    const refKm = haversineKm(incident.lngLat, f.lngLat)
    const withReason = (text: string) =>
      s.statusReason ? `${text} — ${s.statusReason.toLowerCase()}` : text

    if (s.offline) {
      rejections.push({ facilityId: f.id, reason: withReason('is offline'), refKm })
      continue
    }
    if (!s.accessible) {
      rejections.push({ facilityId: f.id, reason: withReason('is inaccessible'), refKm })
      continue
    }
    const hospNodeId = `hosp:${f.id}`
    const path = findPath(ctx.net, incident.lngLat, f.lngLat, {
      closedEdgeIds: ctx.closedEdgeIds,
      zones: ctx.zones,
      // Hospitals have a real access-road node; clinics fall back to nearest node.
      goalNodeId: ctx.net.nodes.has(hospNodeId) ? hospNodeId : undefined,
    })
    if (!path) {
      rejections.push({ facilityId: f.id, reason: 'is cut off by road closures', refKm })
      continue
    }

    const eta = path.minutes
    const waitMin = waitEstimate(f, s)
    const projOcc = (s.occupied + s.incomingPatients + load) / f.edCapacity
    let score =
      eta +
      waitMin * 0.35 +
      Math.max(0, projOcc - 0.8) * 60 +
      (s.damage === 'moderate' ? 12 : s.damage === 'minor' ? 3 : 0)
    if (incident.requires === 'pediatric') score += f.traumaLevel === 'ped' ? -8 : 6
    if (incident.requires === 'minor-care') score += f.kind === 'clinic' ? -6 : 4
    if (incident.requires === 'trauma' && incident.patients.critical > 0 && f.traumaLevel === 'II') {
      score += 3
    }
    if (severeZones.some((z) => pointInPolygon(f.lngLat, z.polygon))) score += 8

    const cand: Candidate = { f, path, eta, score, waitMin, projOcc }
    const status = facilityStatus(f, s)
    if (status === 'diverting') {
      rejections.push({
        facilityId: f.id,
        reason: s.divertingManual
          ? withReason('is on ED diversion')
          : `is auto-diverting at ${occupancyPct(f, s)}% occupancy`,
        refKm,
      })
      relaxed.push({ ...cand, score: score + 45 })
      continue
    }
    if (projOcc > 1.02) {
      rejections.push({
        facilityId: f.id,
        reason: 'is at capacity — no ED beds free',
        refKm,
      })
      relaxed.push({ ...cand, score: score + 80 })
      continue
    }
    strict.push(cand)
  }

  const override = strict.length === 0
  const pool = override ? relaxed : strict
  if (pool.length === 0) return null
  pool.sort((a, b) => a.score - b.score || (a.f.id < b.f.id ? -1 : 1))
  const chosen = pool[0]
  const chosenState = ctx.states[chosen.f.id]

  // If an eligible facility was meaningfully closer but lost on load, say so.
  const fastestEligible = [...pool].sort(
    (a, b) => a.eta - b.eta || (a.f.id < b.f.id ? -1 : 1),
  )[0]
  if (fastestEligible.f.id !== chosen.f.id && fastestEligible.eta < chosen.eta - 0.5) {
    const s = ctx.states[fastestEligible.f.id]
    const parts = [`${occupancyPct(fastestEligible.f, s)}% occupancy`]
    if (s.incomingPatients > 0) parts.push(`${s.incomingPatients} patients inbound`)
    if (waitEstimate(fastestEligible.f, s) >= 25) parts.push(`~${waitEstimate(fastestEligible.f, s)} min wait`)
    rejections.push({
      facilityId: fastestEligible.f.id,
      reason: `was bypassed (${parts.join(', ')})`,
      refKm: haversineKm(incident.lngLat, fastestEligible.f.lngLat),
    })
  }

  const chosenKm = haversineKm(incident.lngLat, chosen.f.lngLat)
  const rejectedNearer = rejections
    .filter((r) => r.refKm < chosenKm - 0.05)
    .sort((a, b) => a.refKm - b.refKm)
    .slice(0, 2)
    .map(({ facilityId, reason }) => ({ facilityId, reason }))

  const sentences: string[] = []
  if (override) {
    sentences.push('All eligible facilities are saturated or diverting — med-control override applied.')
  }
  if (rejectedNearer.length > 0) {
    const names = rejectedNearer
      .map((r) => `${FACILITY_BY_ID.get(r.facilityId)!.name} ${r.reason}`)
      .join('; ')
    sentences.push(`Nearer option${rejectedNearer.length > 1 ? 's' : ''} unavailable: ${names}.`)
  }
  const via =
    chosen.path.viaNames.length > 0
      ? `via ${chosen.path.viaNames.slice(0, 2).join(' & ')}`
      : 'via local streets'
  const opener = rejectedNearer.length > 0 || override ? 'Assigned to' : 'Nearest appropriate facility:'
  sentences.push(
    `${opener} ${chosen.f.name} — ${rejectedNearer.length > 0 ? 'closest accessible ' : ''}${facilityDescriptor(chosen.f)} with ${availableBeds(chosen.f, chosenState)} ED beds open, ETA ${Math.max(1, Math.round(chosen.eta))} min ${via}.`,
  )

  return {
    facilityId: chosen.f.id,
    path: chosen.path,
    etaMin: Math.max(1, Math.round(chosen.eta)),
    score: chosen.score,
    explanation: sentences.join(' '),
    rejectedNearer,
  }
}
