import { describe, expect, test } from 'vitest'
import {
  ZONE_BANDS,
  epicentralRadiusForMMI,
  hypocentralKm,
  mmiAt,
  zonesForQuake,
} from './hazard'
import type { LngLat, Quake } from './types'

const DTLA: LngLat = [-118.2437, 34.0522]

describe('mmiAt', () => {
  test('is highest at the epicenter and decreases monotonically with distance', () => {
    const at0 = mmiAt(DTLA, 6.9, 10, DTLA)
    const at10 = mmiAt(DTLA, 6.9, 10, [-118.13, 34.05])
    const at30 = mmiAt(DTLA, 6.9, 10, [-117.92, 34.05])
    expect(at0).toBeGreaterThan(at10)
    expect(at10).toBeGreaterThan(at30)
    expect(at0).toBeLessThanOrEqual(10)
    expect(at30).toBeGreaterThanOrEqual(1)
  })

  test('greater depth lowers surface intensity at the epicenter', () => {
    const shallow = mmiAt(DTLA, 6.9, 6, DTLA)
    const deep = mmiAt(DTLA, 6.9, 20, DTLA)
    expect(shallow).toBeGreaterThan(deep)
  })

  test('greater magnitude raises intensity everywhere', () => {
    const p: LngLat = [-118.1, 34.05]
    expect(mmiAt(DTLA, 7.4, 10, p)).toBeGreaterThan(mmiAt(DTLA, 6.2, 10, p))
  })

  test('a strong shallow quake produces severe shaking near the epicenter', () => {
    expect(mmiAt(DTLA, 6.9, 10, DTLA)).toBeGreaterThanOrEqual(8)
  })
})

describe('hypocentralKm', () => {
  test('equals depth directly above the epicenter', () => {
    expect(hypocentralKm(DTLA, 12, DTLA)).toBeCloseTo(12, 5)
  })
})

describe('epicentralRadiusForMMI', () => {
  test('inverts mmiAt: MMI at the returned radius equals the threshold', () => {
    const r = epicentralRadiusForMMI(6.9, 10, 6)
    expect(r).toBeGreaterThan(0)
    const point: LngLat = [DTLA[0] + r / (111.32 * Math.cos((DTLA[1] * Math.PI) / 180)), DTLA[1]]
    expect(mmiAt(DTLA, 6.9, 10, point)).toBeCloseTo(6, 1)
  })

  test('inner bands are smaller than outer bands', () => {
    const severe = epicentralRadiusForMMI(6.9, 10, 8)
    const light = epicentralRadiusForMMI(6.9, 10, 5)
    expect(severe).toBeLessThan(light)
  })

  test('larger magnitude yields a larger footprint at every band', () => {
    for (const band of ZONE_BANDS) {
      expect(epicentralRadiusForMMI(7.3, 10, band.mmi)).toBeGreaterThan(
        epicentralRadiusForMMI(6.3, 10, band.mmi),
      )
    }
  })

  test('returns 0 when a band threshold is never reached', () => {
    // A small, deep quake need not reach MMI VIII anywhere on the surface.
    expect(epicentralRadiusForMMI(4.3, 12, 8)).toBe(0)
  })
})

describe('zonesForQuake', () => {
  const quake: Quake = {
    id: 'q1',
    name: 'test',
    magnitude: 6.9,
    epicenter: DTLA,
    depthKm: 10,
    t: 0,
    kind: 'mainshock',
  }

  test('builds nested MMI bands with closed polygons', () => {
    const zones = zonesForQuake(quake)
    expect(zones.length).toBeGreaterThanOrEqual(3)
    for (const z of zones) {
      expect(z.polygon.length).toBeGreaterThan(8)
      expect(z.polygon[0]).toEqual(z.polygon[z.polygon.length - 1])
    }
  })

  test('is deterministic', () => {
    expect(zonesForQuake(quake)).toEqual(zonesForQuake(quake))
  })

  test('zones are non-circular (elongated along fault strike)', () => {
    const zones = zonesForQuake(quake)
    const outer = zones[zones.length - 1]
    const c = outer.center
    let min = Infinity
    let max = -Infinity
    for (const p of outer.polygon) {
      const d = hypocentralKm(c, 0, p)
      if (d < min) min = d
      if (d > max) max = d
    }
    // A meaningfully elongated ring: max radius well above min radius.
    expect(max).toBeGreaterThan(min * 1.2)
  })

  test('a bigger magnitude produces a larger severe zone', () => {
    const big = zonesForQuake({ ...quake, id: 'q2', magnitude: 7.4 })
    const small = zonesForQuake({ ...quake, id: 'q3', magnitude: 6.2 })
    const severeArea = (zs: ReturnType<typeof zonesForQuake>) => {
      const z = zs.find((x) => x.kind === 'severe')
      if (!z) return 0
      let a = 0
      for (let i = 0; i < z.polygon.length - 1; i += 1) {
        a += z.polygon[i][0] * z.polygon[i + 1][1] - z.polygon[i + 1][0] * z.polygon[i][1]
      }
      return Math.abs(a)
    }
    expect(severeArea(big)).toBeGreaterThan(severeArea(small))
  })
})
