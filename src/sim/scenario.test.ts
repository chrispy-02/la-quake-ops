import { describe, expect, test } from 'vitest'
import { FACILITIES } from './facilities'
import { buildRoadNetwork } from './roadNetwork'
import { aftershockPreset, buildMainScenario } from './scenario'

const scenario = buildMainScenario()
const facilityIds = new Set(FACILITIES.map((f) => f.id))
const net = buildRoadNetwork()

describe('buildMainScenario', () => {
  test('events are time-sorted and start with the mainshock at t=0', () => {
    for (let i = 1; i < scenario.events.length; i += 1) {
      expect(scenario.events[i].t).toBeGreaterThanOrEqual(scenario.events[i - 1].t)
    }
    const first = scenario.events[0]
    expect(first.t).toBe(0)
    expect(first.action.type).toBe('quake')
    if (first.action.type === 'quake') {
      expect(first.action.quake.kind).toBe('mainshock')
      expect(first.action.quake.magnitude).toBeGreaterThanOrEqual(6.5)
      expect(first.action.quake.magnitude).toBeLessThanOrEqual(7.2)
    }
  })

  test('spawns a broad set of incidents across LA', () => {
    const incidents = scenario.events.filter((e) => e.action.type === 'incident')
    expect(incidents.length).toBeGreaterThanOrEqual(12)
    const hoods = new Set(
      incidents.map((e) => (e.action.type === 'incident' ? e.action.spec.neighborhood : '')),
    )
    expect(hoods.size).toBeGreaterThanOrEqual(9)
    const ids = incidents.map((e) => (e.action.type === 'incident' ? e.action.spec.id : ''))
    expect(new Set(ids).size).toBe(ids.length)
    for (const e of incidents) {
      if (e.action.type !== 'incident') continue
      const [lng, lat] = e.action.spec.lngLat
      expect(lng).toBeGreaterThan(-118.75)
      expect(lng).toBeLessThan(-117.9)
      expect(lat).toBeGreaterThan(33.7)
      expect(lat).toBeLessThan(34.4)
    }
  })

  test('closes real road edges and reopens at least one later', () => {
    const closures = scenario.events.filter((e) => e.action.type === 'closure')
    expect(closures.length).toBeGreaterThanOrEqual(4)
    for (const e of closures) {
      if (e.action.type !== 'closure') continue
      for (const edgeId of e.action.closure.edgeIds) {
        expect(net.edges.has(edgeId), `closure references unknown edge ${edgeId}`).toBe(true)
      }
    }
    expect(scenario.events.some((e) => e.action.type === 'reopen')).toBe(true)
  })

  test('damages facilities, takes one offline, and later stabilizes', () => {
    const patches = scenario.events.filter((e) => e.action.type === 'facility')
    expect(patches.length).toBeGreaterThanOrEqual(5)
    for (const e of patches) {
      if (e.action.type !== 'facility') continue
      expect(facilityIds.has(e.action.facilityId), `unknown facility ${e.action.facilityId}`).toBe(true)
    }
    expect(
      patches.some((e) => e.action.type === 'facility' && e.action.patch.offline === true),
    ).toBe(true)
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

  test('runs long enough to show stabilization', () => {
    expect(scenario.durationMin).toBeGreaterThanOrEqual(60)
  })
})

describe('aftershockPreset', () => {
  test('provides at least three deterministic presets', () => {
    const seen = new Set<string>()
    for (let n = 1; n <= 3; n += 1) {
      const p = aftershockPreset(n)
      expect(p.quake.kind).toBe('aftershock')
      expect(p.quake.magnitude).toBeGreaterThanOrEqual(4)
      expect(p.quake.magnitude).toBeLessThanOrEqual(5.8)
      expect(p.events.length).toBeGreaterThanOrEqual(1)
      seen.add(JSON.stringify(p.quake.epicenter))
    }
    expect(seen.size).toBeGreaterThanOrEqual(2)
    expect(aftershockPreset(1)).toEqual(aftershockPreset(1))
  })
})
