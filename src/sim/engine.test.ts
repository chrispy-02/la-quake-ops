import { describe, expect, test } from 'vitest'
import { SimulationEngine } from './engine'
import { FACILITIES } from './facilities'

function runTo(engine: SimulationEngine, t: number, quantum = 0.5) {
  while (engine.state.simMin < t - 1e-9) {
    engine.advance(Math.min(quantum, t - engine.state.simMin))
  }
}

function started(t = 0): SimulationEngine {
  const e = new SimulationEngine()
  e.start()
  if (t > 0) runTo(e, t)
  return e
}

/** Everything that should be identical between deterministic runs. */
function comparable(e: SimulationEngine) {
  const { version, speed, ...rest } = e.state
  void version
  void speed
  return JSON.parse(JSON.stringify(rest))
}

describe('initial state', () => {
  test('starts idle with baseline capacity and nothing happening', () => {
    const e = new SimulationEngine()
    expect(e.state.phase).toBe('idle')
    expect(e.state.simMin).toBe(0)
    expect(e.state.incidents).toHaveLength(0)
    expect(e.state.zones).toHaveLength(0)
    expect(e.state.quakes).toHaveLength(0)
    const expectedBeds = FACILITIES.reduce(
      (sum, f) => sum + (f.edCapacity - f.baselineOccupied),
      0,
    )
    expect(e.state.metrics.bedsAvailable).toBe(expectedBeds)
  })
})

describe('mainshock', () => {
  test('start() applies the T+0 quake immediately', () => {
    const e = started()
    expect(e.state.phase).toBe('running')
    expect(e.state.quakes).toHaveLength(1)
    expect(e.state.zones.length).toBeGreaterThanOrEqual(4)
    expect(e.state.banner).not.toBeNull()
    expect(e.state.feed.some((f) => f.category === 'seismic')).toBe(true)
  })
})

describe('incidents and assignment', () => {
  test('incidents appear and get routed with explanations', () => {
    const e = started(8)
    expect(e.state.incidents.length).toBeGreaterThanOrEqual(2)
    for (const inc of e.state.incidents) {
      expect(inc.assignedFacilityId).not.toBeNull()
      expect(inc.explanation.length).toBeGreaterThan(10)
      expect(inc.etaMin).toBeGreaterThan(0)
      expect(inc.routeCoords!.length).toBeGreaterThan(1)
    }
  })

  test('transports depart after triage and eventually deliver', () => {
    const e = started(8)
    const inc = e.state.incidents[0]
    expect(inc.departT).not.toBeNull()
    expect(inc.arriveT).not.toBeNull()
    runTo(e, inc.departT! + 0.5)
    expect(e.state.incidents.find((i) => i.id === inc.id)!.status).not.toBe('waiting')
    // May reroute mid-transit (re-setting arriveT); run to the end to confirm delivery.
    runTo(e, 95)
    expect(e.state.incidents.find((i) => i.id === inc.id)!.status).toBe('delivered')
  })
})

describe('closures and damage', () => {
  test('road closures activate on schedule', () => {
    const e = started(10)
    expect(e.state.closures.length).toBeGreaterThanOrEqual(2)
    expect(e.state.metrics.activeClosures).toBeGreaterThanOrEqual(2)
  })

  test('a hospital goes offline and its patients are rerouted', () => {
    const e = started(14)
    const offlineIds = Object.entries(e.state.facilityStates)
      .filter(([, s]) => s.offline)
      .map(([id]) => id)
    expect(offlineIds.length).toBeGreaterThanOrEqual(1)
    expect(e.state.rerouteTotal).toBeGreaterThanOrEqual(1)
    const rerouted = e.state.incidents.filter((i) => i.rerouteCount > 0)
    expect(rerouted.length).toBeGreaterThanOrEqual(1)
    for (const inc of rerouted.filter((i) => i.status !== 'delivered')) {
      expect(offlineIds).not.toContain(inc.assignedFacilityId)
    }
    expect(e.state.feed.some((f) => f.category === 'routing' && /rerout/i.test(f.msg))).toBe(true)
  })

  test('active routes never traverse closed edges', () => {
    const e = started(25)
    const closed = new Set(
      e.state.closures.filter((c) => !c.reopened).flatMap((c) => c.edgeIds),
    )
    for (const inc of e.state.incidents.filter(
      (i) => i.status === 'assigned' || i.status === 'in-transit',
    )) {
      for (const edgeId of inc.routeEdgeIds ?? []) {
        expect(closed.has(edgeId), `${inc.id} uses closed edge ${edgeId}`).toBe(false)
      }
    }
  })
})

describe('aftershock', () => {
  test('scripted aftershock hits around T+30 and impairs a nearby hospital', () => {
    const e = started(32)
    expect(e.state.quakes.length).toBeGreaterThanOrEqual(2)
    const after = e.state.quakes.find((q) => q.kind === 'aftershock')!
    expect(after.magnitude).toBeGreaterThanOrEqual(4)
    expect(after.magnitude).toBeLessThan(e.state.quakes[0].magnitude)
    // The hospital nearest the aftershock epicenter is diverting or damaged.
    const nearest = [...FACILITIES]
      .filter((f) => f.kind === 'hospital')
      .sort(
        (a, b) =>
          (a.lngLat[0] - after.epicenter[0]) ** 2 + (a.lngLat[1] - after.epicenter[1]) ** 2 -
          ((b.lngLat[0] - after.epicenter[0]) ** 2 + (b.lngLat[1] - after.epicenter[1]) ** 2),
      )[0]
    const s = e.state.facilityStates[nearest.id]
    expect(s.divertingManual || s.damage !== 'none').toBe(true)
  })

  test('manual trigger applies deterministic presets', () => {
    const a = started(20)
    const b = started(20)
    a.triggerAftershock()
    b.triggerAftershock()
    expect(a.state.manualAftershocks).toBe(1)
    expect(a.state.quakes.length).toBeGreaterThanOrEqual(2)
    expect(comparable(a)).toEqual(comparable(b))
  })
})

describe('controls', () => {
  test('pause halts and step advances exactly one minute', () => {
    const e = started(5)
    e.pause()
    expect(e.state.phase).toBe('paused')
    const t = e.state.simMin
    e.advance(10)
    expect(e.state.simMin).toBe(t)
    e.step()
    expect(e.state.simMin).toBeCloseTo(t + 1, 9)
    e.resume()
    expect(e.state.phase).toBe('running')
  })

  test('reset returns to the pristine initial state', () => {
    const e = started(40)
    e.triggerAftershock()
    e.reset()
    expect(comparable(e)).toEqual(comparable(new SimulationEngine()))
  })

  test('speed is stored for the run loop', () => {
    const e = started()
    e.setSpeed(4)
    expect(e.state.speed).toBe(4)
  })
})

describe('full run', () => {
  test('reroutes accumulate and the scenario completes with all patients delivered', () => {
    const e = started(40)
    expect(e.state.rerouteTotal).toBeGreaterThanOrEqual(2)
    runTo(e, 95)
    expect(e.state.phase).toBe('complete')
    const m = e.state.metrics
    expect(m.patientsDelivered).toBe(m.totalPatients)
    expect(m.patientsInTransit).toBe(0)
    expect(m.patientsWaiting).toBe(0)
    expect(m.totalPatients).toBeGreaterThan(80)
  })

  test('deliveries consume beds at destination hospitals', () => {
    const fresh = new SimulationEngine()
    const before = fresh.state.metrics.bedsAvailable
    const e = started(95)
    expect(e.state.metrics.bedsAvailable).toBeLessThan(before)
  })

  test('stabilization is reported', () => {
    const e = started(50)
    expect(e.state.stabilizing).toBe(true)
  })
})

describe('determinism', () => {
  test('identical runs produce identical states regardless of quantum slicing', () => {
    const a = new SimulationEngine()
    a.start()
    runTo(a, 35, 0.7)
    const b = new SimulationEngine()
    b.start()
    runTo(b, 35, 5)
    expect(comparable(a)).toEqual(comparable(b))
  })
})

describe('configurable epicenter', () => {
  const NORTHRIDGE = { epicenter: [-118.5301, 34.2381] as [number, number], magnitude: 6.7, depthKm: 11 }
  const LONGBEACH = { epicenter: [-118.1937, 33.7701] as [number, number], magnitude: 6.7, depthKm: 11 }

  function assignedFacilities(params: typeof NORTHRIDGE): Set<string> {
    const e = new SimulationEngine()
    e.setScenarioParams(params)
    e.start()
    runTo(e, 20)
    return new Set(
      e.state.incidents.map((i) => i.assignedFacilityId).filter((id): id is string => id !== null),
    )
  }

  test('a different epicenter routes patients to a different set of hospitals', () => {
    const north = assignedFacilities(NORTHRIDGE)
    const south = assignedFacilities(LONGBEACH)
    expect(north.size).toBeGreaterThan(0)
    expect(south.size).toBeGreaterThan(0)
    // Valley hospitals for Northridge; South Bay / Long Beach hospitals otherwise.
    const identical = north.size === south.size && [...north].every((id) => south.has(id))
    expect(identical).toBe(false)
  })

  test('setScenarioParams keeps runs deterministic', () => {
    const a = new SimulationEngine()
    a.setScenarioParams(NORTHRIDGE)
    a.start()
    runTo(a, 25, 0.7)
    const b = new SimulationEngine()
    b.setScenarioParams(NORTHRIDGE)
    b.start()
    runTo(b, 25, 5)
    expect(comparable(a)).toEqual(comparable(b))
  })

  test('restoreDefault returns to the Puente Hills defaults', () => {
    const e = new SimulationEngine()
    e.setScenarioParams(NORTHRIDGE)
    expect(e.getParams().epicenter).toEqual(NORTHRIDGE.epicenter)
    e.restoreDefault()
    expect(e.getParams().epicenter).toEqual([-118.23, 34.005])
    expect(e.state.phase).toBe('idle')
  })
})
