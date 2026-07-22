import { describe, expect, test } from 'vitest'
import { isInLACounty } from '../data/baseData'
import { FACILITIES } from './facilities'
import { haversineKm } from './geo'
import { buildRoadNetwork } from './roadNetwork'
import { DEFAULT_PARAMS, type ScenarioParams } from './scenario'
import { buildDefaultScenario, buildScenario, generateAftershock } from './scenarioGen'

const net = buildRoadNetwork()
const facilityIds = new Set(FACILITIES.map((f) => f.id))
const scenario = buildDefaultScenario()

const PRESETS: Record<string, ScenarioParams> = {
  dtla: { epicenter: [-118.2437, 34.0522], magnitude: 6.8, depthKm: 10 },
  santamonica: { epicenter: [-118.4912, 34.0195], magnitude: 6.6, depthKm: 9 },
  longbeach: { epicenter: [-118.1937, 33.7701], magnitude: 6.7, depthKm: 12 },
  northridge: { epicenter: [-118.5301, 34.2381], magnitude: 6.7, depthKm: 11 },
  pasadena: { epicenter: [-118.1445, 34.1478], magnitude: 6.4, depthKm: 8 },
}

describe('buildScenario (default)', () => {
  test('events are time-sorted and start with the mainshock at t=0', () => {
    for (let i = 1; i < scenario.events.length; i += 1) {
      expect(scenario.events[i].t).toBeGreaterThanOrEqual(scenario.events[i - 1].t)
    }
    const first = scenario.events[0]
    expect(first.t).toBe(0)
    expect(first.action.type).toBe('quake')
    if (first.action.type === 'quake') {
      expect(first.action.quake.kind).toBe('mainshock')
      expect(first.action.quake.epicenter).toEqual(DEFAULT_PARAMS.epicenter)
      expect(first.action.quake.magnitude).toBe(DEFAULT_PARAMS.magnitude)
    }
  })

  test('spawns a broad set of incidents with unique ids and valid triage counts', () => {
    const incidents = scenario.events.filter((e) => e.action.type === 'incident')
    expect(incidents.length).toBeGreaterThanOrEqual(8)
    const ids = incidents.map((e) => (e.action.type === 'incident' ? e.action.spec.id : ''))
    expect(new Set(ids).size).toBe(ids.length)
    for (const e of incidents) {
      if (e.action.type !== 'incident') continue
      const p = e.action.spec.patients
      expect(p.critical + p.serious + p.minor).toBeGreaterThan(0)
      expect(isInLACounty(e.action.spec.lngLat)).toBe(true)
    }
  })

  test('closes real road edges and reopens at least one later', () => {
    const closures = scenario.events.filter((e) => e.action.type === 'closure')
    expect(closures.length).toBeGreaterThanOrEqual(3)
    for (const e of closures) {
      if (e.action.type !== 'closure') continue
      for (const edgeId of e.action.closure.edgeIds) {
        expect(net.edges.has(edgeId), `closure references unknown edge ${edgeId}`).toBe(true)
      }
    }
    expect(scenario.events.some((e) => e.action.type === 'reopen')).toBe(true)
  })

  test('damages facilities, takes at least one offline, and later stabilizes', () => {
    const patches = scenario.events.filter((e) => e.action.type === 'facility')
    for (const e of patches) {
      if (e.action.type !== 'facility') continue
      expect(facilityIds.has(e.action.facilityId), `unknown facility ${e.action.facilityId}`).toBe(true)
    }
    expect(patches.some((e) => e.action.type === 'facility' && e.action.patch.offline === true)).toBe(true)
    const stabilize = scenario.events.find((e) => e.action.type === 'stabilize')
    expect(stabilize).toBeTruthy()
    expect(stabilize!.t).toBeGreaterThanOrEqual(35)
  })

  test('includes a scripted aftershock around T+30', () => {
    const aftershocks = scenario.events.filter(
      (e) => e.action.type === 'quake' && e.action.quake.kind === 'aftershock',
    )
    expect(aftershocks.length).toBeGreaterThanOrEqual(1)
    expect(aftershocks[0].t).toBeGreaterThanOrEqual(25)
    expect(aftershocks[0].t).toBeLessThanOrEqual(35)
  })

  test('is deterministic', () => {
    expect(buildScenario(DEFAULT_PARAMS)).toEqual(buildScenario(DEFAULT_PARAMS))
  })
})

describe('buildScenario (arbitrary epicenter)', () => {
  test('every preset produces a valid, deterministic scenario', () => {
    for (const [, params] of Object.entries(PRESETS)) {
      const a = buildScenario(params)
      const b = buildScenario(params)
      expect(a).toEqual(b)
      expect(a.events[0].action.type).toBe('quake')
      const incidents = a.events.filter((e) => e.action.type === 'incident')
      expect(incidents.length).toBeGreaterThanOrEqual(4)
      // Incidents concentrate near the chosen epicenter.
      const near = incidents.filter(
        (e) => e.action.type === 'incident' && haversineKm(params.epicenter, e.action.spec.lngLat) < 30,
      )
      expect(near.length).toBe(incidents.length)
    }
  })

  test('moving the epicenter changes which hospitals are impacted', () => {
    const impacted = (params: ScenarioParams) =>
      new Set(
        buildScenario(params).events.flatMap((e) =>
          e.action.type === 'facility' &&
          (e.action.patch.offline || e.action.patch.damage === 'moderate')
            ? [e.action.facilityId]
            : [],
        ),
      )
    const dtla = impacted(PRESETS.dtla)
    const northridge = impacted(PRESETS.northridge)
    // The damaged-hospital sets differ between distant epicenters.
    const same = [...dtla].every((id) => northridge.has(id)) && dtla.size === northridge.size
    expect(same).toBe(false)
  })

  test('closures cluster near the epicenter and reference real edges', () => {
    const s = buildScenario(PRESETS.northridge)
    const closures = s.events.filter((e) => e.action.type === 'closure')
    for (const e of closures) {
      if (e.action.type !== 'closure') continue
      for (const id of e.action.closure.edgeIds) {
        expect(net.edges.has(id)).toBe(true)
      }
    }
  })

  test('bigger magnitude spawns at least as many incidents', () => {
    const small = buildScenario({ ...PRESETS.dtla, magnitude: 6.0 })
    const big = buildScenario({ ...PRESETS.dtla, magnitude: 7.3 })
    const count = (s: ReturnType<typeof buildScenario>) =>
      s.events.filter((e) => e.action.type === 'incident').length
    expect(count(big)).toBeGreaterThanOrEqual(count(small))
  })
})

describe('generateAftershock', () => {
  test('provides deterministic, decreasing aftershocks near the epicenter', () => {
    for (let n = 1; n <= 3; n += 1) {
      const p = generateAftershock(DEFAULT_PARAMS, n)
      expect(p.quake.kind).toBe('aftershock')
      expect(p.quake.magnitude).toBeLessThan(DEFAULT_PARAMS.magnitude)
      expect(p.events.length).toBeGreaterThanOrEqual(1)
      expect(generateAftershock(DEFAULT_PARAMS, n)).toEqual(p)
    }
  })
})
