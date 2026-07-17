import { describe, expect, test } from 'vitest'
import { FACILITIES, initialFacilityState } from './facilities'
import { buildRoadNetwork } from './roadNetwork'
import { assignIncident, capabilityOk, type AssignmentContext } from './routing'
import type { Capability, FacilityState, Incident, LngLat } from './types'

const net = buildRoadNetwork()

function freshStates(): Record<string, FacilityState> {
  const out: Record<string, FacilityState> = {}
  for (const f of FACILITIES) out[f.id] = initialFacilityState(f)
  return out
}

function makeCtx(states = freshStates()): AssignmentContext {
  return { net, facilities: FACILITIES, states, closedEdgeIds: new Set(), zones: [] }
}

let seq = 0
function makeIncident(lngLat: LngLat, requires: Capability, critical = 2): Incident {
  seq += 1
  return {
    id: `t-${seq}`,
    name: 'Test incident',
    icon: 'building',
    lngLat,
    neighborhood: 'Test',
    patients: { critical, serious: 2, minor: 1 },
    requires,
    triageMin: 3,
    tSpawn: 0,
    status: 'waiting',
    assignedFacilityId: null,
    explanation: '',
    rerouteCount: 0,
    etaMin: null,
    departT: null,
    arriveT: null,
    routeCoords: null,
    routeEdgeIds: null,
    viaNames: [],
    log: [],
  }
}

const facility = (id: string) => FACILITIES.find((f) => f.id === id)!

describe('capabilityOk', () => {
  const clinic = FACILITIES.find((f) => f.kind === 'clinic')!
  const levelOne = FACILITIES.find((f) => f.traumaLevel === 'I')!
  const community = FACILITIES.find((f) => f.kind === 'hospital' && f.traumaLevel === null)!

  test('clinics only accept minor-care', () => {
    expect(capabilityOk(clinic, 'minor-care')).toBe(true)
    expect(capabilityOk(clinic, 'trauma')).toBe(false)
    expect(capabilityOk(clinic, 'general')).toBe(false)
    expect(capabilityOk(clinic, 'pediatric')).toBe(false)
  })

  test('trauma requires a designated trauma center', () => {
    expect(capabilityOk(levelOne, 'trauma')).toBe(true)
    expect(capabilityOk(community, 'trauma')).toBe(false)
  })

  test('hospitals take general and pediatric patients', () => {
    expect(capabilityOk(community, 'general')).toBe(true)
    expect(capabilityOk(community, 'pediatric')).toBe(true)
  })
})

describe('assignIncident', () => {
  test('assigns the obvious nearby hospital in calm conditions', () => {
    // Westwood — effectively on the Ronald Reagan UCLA campus.
    const r = assignIncident(makeIncident([-118.445, 34.066], 'general'), makeCtx())
    expect(r).not.toBeNull()
    expect(r!.facilityId).toBe('ucla')
    expect(r!.etaMin).toBeGreaterThan(0)
    expect(r!.explanation.length).toBeGreaterThan(10)
  })

  test('never sends trauma to a clinic even when one is next door', () => {
    // Adjacent to the fictional Echo Park clinic.
    const r = assignIncident(makeIncident([-118.26, 34.078], 'trauma'), makeCtx())
    expect(r).not.toBeNull()
    const chosen = facility(r!.facilityId)
    expect(chosen.kind).toBe('hospital')
    expect(['I', 'II']).toContain(chosen.traumaLevel)
  })

  test('sends walking-wounded to a nearby clinic to offload hospitals', () => {
    const clinic = FACILITIES.find((f) => f.kind === 'clinic')!
    const r = assignIncident(makeIncident(clinic.lngLat, 'minor-care', 0), makeCtx())
    expect(r).not.toBeNull()
    expect(facility(r!.facilityId).kind).toBe('clinic')
  })

  test('routes pediatric patients to the pediatric trauma center', () => {
    const r = assignIncident(makeIncident([-118.243, 34.081], 'pediatric'), makeCtx())
    expect(r).not.toBeNull()
    expect(r!.facilityId).toBe('chla')
  })

  test('skips the nearest hospital when it is offline and explains why', () => {
    const states = freshStates()
    states.california.offline = true
    states.california.statusReason = 'Red-tagged after structural inspection'
    // South Park / Fashion District — California Hospital is the close option.
    const r = assignIncident(makeIncident([-118.255, 34.037], 'general'), makeCtx(states))
    expect(r).not.toBeNull()
    expect(r!.facilityId).not.toBe('california')
    expect(r!.explanation).toMatch(/California Hospital/)
    expect(r!.explanation).toMatch(/offline/i)
    expect(r!.rejectedNearer.some((x) => x.facilityId === 'california')).toBe(true)
  })

  test('skips a hospital with no beds left when an alternative exists', () => {
    const states = freshStates()
    states.goodsam.occupied = facility('goodsam').edCapacity + 2
    const r = assignIncident(makeIncident([-118.2665, 34.052], 'general'), makeCtx(states))
    expect(r).not.toBeNull()
    expect(r!.facilityId).not.toBe('goodsam')
    expect(r!.explanation).toMatch(/capacity|beds|full/i)
  })

  test('avoids diverting hospitals when alternatives exist', () => {
    const states = freshStates()
    states.whitemem.divertingManual = true
    states.whitemem.statusReason = 'ED diversion declared'
    const r = assignIncident(makeIncident([-118.2199, 34.049], 'general'), makeCtx(states))
    expect(r).not.toBeNull()
    expect(r!.facilityId).not.toBe('whitemem')
  })

  test('overrides diversion when every candidate is diverting, and says so', () => {
    const states = freshStates()
    for (const f of FACILITIES) states[f.id].divertingManual = true
    const r = assignIncident(makeIncident([-118.25, 34.05], 'general'), makeCtx(states))
    expect(r).not.toBeNull()
    expect(r!.explanation).toMatch(/divert/i)
  })

  test('returns null when nothing is reachable', () => {
    const ctx = makeCtx()
    ctx.closedEdgeIds = new Set([...net.edges.keys()])
    // 91/110 interchange: no facility shares this snap node, so with every
    // edge closed there is genuinely no way to reach any facility.
    expect(assignIncident(makeIncident([-118.28, 33.873], 'general'), ctx)).toBeNull()
  })

  test('routes around closures without changing eligibility', () => {
    const base = assignIncident(makeIncident([-118.25, 34.05], 'trauma'), makeCtx())!
    const ctx = makeCtx()
    ctx.closedEdgeIds = new Set(base.path.edgeIds.slice(0, 2))
    const detour = assignIncident(makeIncident([-118.25, 34.05], 'trauma'), ctx)
    expect(detour).not.toBeNull()
    for (const id of detour!.path.edgeIds) {
      expect(ctx.closedEdgeIds.has(id)).toBe(false)
    }
  })

  test('is deterministic', () => {
    const a = assignIncident(makeIncident([-118.31, 34.06], 'trauma'), makeCtx())
    const b = assignIncident(makeIncident([-118.31, 34.06], 'trauma'), makeCtx())
    expect(JSON.parse(JSON.stringify(a))).toEqual(JSON.parse(JSON.stringify(b)))
  })
})
