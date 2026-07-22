import { describe, expect, test } from 'vitest'
import {
  COUNTY_BBOX,
  FAULTS,
  HOSPITAL_RECORDS,
  NEIGHBORHOODS,
  POPULATION_POINTS,
  isInLACounty,
  nearestFault,
  nearestNeighborhood,
} from './baseData'
import type { LngLat } from '../sim/types'

const DTLA: LngLat = [-118.2437, 34.0522]

describe('snapshots load', () => {
  test('hospitals have real identifying data', () => {
    expect(HOSPITAL_RECORDS.length).toBeGreaterThanOrEqual(20)
    for (const h of HOSPITAL_RECORDS) {
      expect(h.oshpdId).toMatch(/^\d+$/)
      expect(h.licensedBeds).toBeGreaterThan(0)
      expect(h.lngLat[0]).toBeLessThan(-117)
      expect(h.lngLat[1]).toBeGreaterThan(33)
    }
    // LA General is a real Level I adult / Level II peds trauma center.
    const lag = HOSPITAL_RECORDS.find((h) => h.id === 'lacusc')!
    expect(lag.traumaAdult).toBe('I')
    expect(lag.licensedBeds).toBeGreaterThan(400)
  })

  test('faults, neighborhoods, and population are present', () => {
    expect(FAULTS.length).toBeGreaterThanOrEqual(8)
    expect(NEIGHBORHOODS.length).toBeGreaterThanOrEqual(100)
    expect(POPULATION_POINTS.length).toBeGreaterThanOrEqual(1000)
    const totalPop = POPULATION_POINTS.reduce((a, p) => a + p.pop, 0)
    expect(totalPop).toBeGreaterThan(5_000_000)
  })
})

describe('isInLACounty', () => {
  test('accepts points inside the county', () => {
    expect(isInLACounty(DTLA)).toBe(true)
    expect(isInLACounty([-118.4912, 34.0195])).toBe(true) // Santa Monica
    expect(isInLACounty([-118.1937, 33.7701])).toBe(true) // Long Beach
  })

  test('rejects points outside the county', () => {
    expect(isInLACounty([-119.7, 34.42])).toBe(false) // Santa Barbara
    expect(isInLACounty([-117.16, 32.72])).toBe(false) // San Diego
    expect(isInLACounty([-119.5, 32.5])).toBe(false) // open ocean
  })

  test('COUNTY_BBOX contains DTLA', () => {
    expect(DTLA[0]).toBeGreaterThan(COUNTY_BBOX.minLng)
    expect(DTLA[0]).toBeLessThan(COUNTY_BBOX.maxLng)
    expect(DTLA[1]).toBeGreaterThan(COUNTY_BBOX.minLat)
    expect(DTLA[1]).toBeLessThan(COUNTY_BBOX.maxLat)
  })
})

describe('nearestNeighborhood', () => {
  test('returns a plausible community name for DTLA', () => {
    const name = nearestNeighborhood(DTLA)
    expect(name.length).toBeGreaterThan(0)
    expect(name.toLowerCase()).toContain('los angeles')
  })
})

describe('nearestFault', () => {
  test('returns a real named fault with distance and strike', () => {
    const f = nearestFault(DTLA)
    expect(f).not.toBeNull()
    expect(f!.name.length).toBeGreaterThan(0)
    expect(f!.distanceKm).toBeGreaterThanOrEqual(0)
    expect(f!.strikeDeg).toBeGreaterThanOrEqual(0)
    expect(f!.strikeDeg).toBeLessThanOrEqual(180)
  })

  test('is deterministic', () => {
    expect(nearestFault(DTLA)).toEqual(nearestFault(DTLA))
  })
})
