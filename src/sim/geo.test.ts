import { describe, expect, test } from 'vitest'
import {
  destination,
  haversineKm,
  organicPolygon,
  pathLengthKm,
  pointAlong,
  pointInPolygon,
} from './geo'
import type { LngLat } from './types'

const DTLA: LngLat = [-118.25, 34.05]
const SANTA_MONICA: LngLat = [-118.491, 34.011]

describe('haversineKm', () => {
  test('DTLA to Santa Monica is roughly 22.5 km', () => {
    const d = haversineKm(DTLA, SANTA_MONICA)
    expect(d).toBeGreaterThan(21.5)
    expect(d).toBeLessThan(23.5)
  })

  test('zero distance for identical points', () => {
    expect(haversineKm(DTLA, DTLA)).toBe(0)
  })
})

describe('destination', () => {
  test('round-trips distance', () => {
    const p = destination(DTLA, 10, 90)
    expect(haversineKm(DTLA, p)).toBeCloseTo(10, 1)
  })

  test('bearing 0 goes north', () => {
    const p = destination(DTLA, 5, 0)
    expect(p[1]).toBeGreaterThan(DTLA[1])
    expect(p[0]).toBeCloseTo(DTLA[0], 3)
  })
})

describe('pointInPolygon', () => {
  const square: LngLat[] = [
    [-118.3, 34.0],
    [-118.2, 34.0],
    [-118.2, 34.1],
    [-118.3, 34.1],
    [-118.3, 34.0],
  ]

  test('detects inside point', () => {
    expect(pointInPolygon([-118.25, 34.05], square)).toBe(true)
  })

  test('detects outside point', () => {
    expect(pointInPolygon([-118.5, 34.05], square)).toBe(false)
  })
})

describe('organicPolygon', () => {
  test('is deterministic for the same seed', () => {
    const a = organicPolygon(DTLA, 6, { seed: 7, elongation: 1.3, bearingDeg: 115 })
    const b = organicPolygon(DTLA, 6, { seed: 7, elongation: 1.3, bearingDeg: 115 })
    expect(a).toEqual(b)
  })

  test('differs for different seeds', () => {
    const a = organicPolygon(DTLA, 6, { seed: 1 })
    const b = organicPolygon(DTLA, 6, { seed: 2 })
    expect(a).not.toEqual(b)
  })

  test('forms a closed ring around the center at roughly the radius', () => {
    const r = 6
    const ring = organicPolygon(DTLA, r, { seed: 3, elongation: 1.4, bearingDeg: 100 })
    expect(ring.length).toBeGreaterThan(24)
    expect(ring[0]).toEqual(ring[ring.length - 1])
    for (const v of ring.slice(0, -1)) {
      const d = haversineKm(DTLA, v)
      expect(d).toBeGreaterThan(r * 0.5)
      expect(d).toBeLessThan(r * 1.4 * 1.5)
    }
    expect(pointInPolygon(DTLA, ring)).toBe(true)
  })
})

describe('pointAlong', () => {
  const line: LngLat[] = [
    [-118.3, 34.0],
    [-118.2, 34.0],
  ]

  test('fraction 0 returns the start', () => {
    expect(pointAlong(line, 0)).toEqual(line[0])
  })

  test('fraction 1 returns the end', () => {
    expect(pointAlong(line, 1)).toEqual(line[1])
  })

  test('fraction 0.5 returns roughly the midpoint', () => {
    const mid = pointAlong(line, 0.5)
    expect(mid[0]).toBeCloseTo(-118.25, 3)
    expect(mid[1]).toBeCloseTo(34.0, 5)
  })
})

describe('pathLengthKm', () => {
  test('two-point path equals haversine distance', () => {
    expect(pathLengthKm([DTLA, SANTA_MONICA])).toBeCloseTo(
      haversineKm(DTLA, SANTA_MONICA),
      6,
    )
  })
})
