import { describe, expect, test } from 'vitest'
import {
  availableBeds,
  FACILITIES,
  facilityStatus,
  initialFacilityState,
  occupancyPct,
  waitEstimate,
} from './facilities'
import type { Facility } from './types'

const hospital = (): Facility => FACILITIES.find((f) => f.kind === 'hospital')!

describe('FACILITIES data', () => {
  test('has a metro-scale roster of hospitals and clinics', () => {
    const hospitals = FACILITIES.filter((f) => f.kind === 'hospital')
    const clinics = FACILITIES.filter((f) => f.kind === 'clinic')
    expect(hospitals.length).toBeGreaterThanOrEqual(18)
    expect(clinics.length).toBeGreaterThanOrEqual(4)
  })

  test('has at least four adult Level I trauma centers', () => {
    expect(FACILITIES.filter((f) => f.traumaLevel === 'I').length).toBeGreaterThanOrEqual(4)
  })

  test('has a pediatric trauma center', () => {
    expect(FACILITIES.some((f) => f.traumaLevel === 'ped')).toBe(true)
  })

  test('clinics are fictional and small', () => {
    for (const c of FACILITIES.filter((f) => f.kind === 'clinic')) {
      expect(c.fictional).toBe(true)
      expect(c.edCapacity).toBeLessThanOrEqual(20)
      expect(c.traumaLevel).toBeNull()
    }
  })

  test('ids are unique and coordinates are within the LA metro bbox', () => {
    const ids = new Set(FACILITIES.map((f) => f.id))
    expect(ids.size).toBe(FACILITIES.length)
    for (const f of FACILITIES) {
      expect(f.lngLat[0]).toBeGreaterThan(-118.75)
      expect(f.lngLat[0]).toBeLessThan(-117.9)
      expect(f.lngLat[1]).toBeGreaterThan(33.7)
      expect(f.lngLat[1]).toBeLessThan(34.4)
      expect(f.baselineOccupied).toBeLessThan(f.edCapacity)
    }
  })
})

describe('initialFacilityState', () => {
  test('starts at baseline occupancy, accessible and online', () => {
    const f = hospital()
    const s = initialFacilityState(f)
    expect(s.occupied).toBe(f.baselineOccupied)
    expect(s.accessible).toBe(true)
    expect(s.offline).toBe(false)
    expect(s.damage).toBe('none')
    expect(s.incomingPatients).toBe(0)
  })
})

describe('facilityStatus precedence', () => {
  const f = hospital()

  test('offline wins over everything', () => {
    const s = { ...initialFacilityState(f), offline: true, damage: 'severe' as const, accessible: false }
    expect(facilityStatus(f, s)).toBe('offline')
  })

  test('inaccessible wins over damage', () => {
    const s = { ...initialFacilityState(f), accessible: false, damage: 'moderate' as const }
    expect(facilityStatus(f, s)).toBe('inaccessible')
  })

  test('moderate damage reports partially-damaged even when busy', () => {
    const s = {
      ...initialFacilityState(f),
      damage: 'moderate' as const,
      occupied: Math.round(f.edCapacity * 0.9),
    }
    expect(facilityStatus(f, s)).toBe('partially-damaged')
  })

  test('manual diversion reports diverting', () => {
    const s = { ...initialFacilityState(f), divertingManual: true }
    expect(facilityStatus(f, s)).toBe('diverting')
  })

  test('occupancy at 102%+ auto-diverts', () => {
    const s = { ...initialFacilityState(f), occupied: Math.ceil(f.edCapacity * 1.03) }
    expect(facilityStatus(f, s)).toBe('diverting')
  })

  test('occupancy bands: near-capacity then high-occupancy then operational', () => {
    expect(
      facilityStatus(f, { ...initialFacilityState(f), occupied: Math.ceil(f.edCapacity * 0.96) }),
    ).toBe('near-capacity')
    expect(
      facilityStatus(f, { ...initialFacilityState(f), occupied: Math.ceil(f.edCapacity * 0.85) }),
    ).toBe('high-occupancy')
    expect(
      facilityStatus(f, { ...initialFacilityState(f), occupied: Math.floor(f.edCapacity * 0.5) }),
    ).toBe('operational')
  })

  test('minor damage does not mask occupancy status', () => {
    const s = { ...initialFacilityState(f), damage: 'minor' as const, occupied: Math.floor(f.edCapacity * 0.5) }
    expect(facilityStatus(f, s)).toBe('operational')
  })
})

describe('derived numbers', () => {
  const f = hospital()

  test('occupancyPct and availableBeds', () => {
    const s = { ...initialFacilityState(f), occupied: f.edCapacity }
    expect(occupancyPct(f, s)).toBe(100)
    expect(availableBeds(f, s)).toBe(0)
    const over = { ...s, occupied: f.edCapacity + 5 }
    expect(availableBeds(f, over)).toBe(0)
    expect(occupancyPct(f, over)).toBeGreaterThan(100)
  })

  test('waitEstimate grows with occupancy, incoming load and damage', () => {
    const base = initialFacilityState(f)
    const calm = { ...base, occupied: Math.floor(f.edCapacity * 0.5) }
    const busy = { ...base, occupied: Math.ceil(f.edCapacity * 0.95) }
    expect(waitEstimate(f, busy)).toBeGreaterThan(waitEstimate(f, calm))
    const incoming = { ...busy, incomingPatients: 8 }
    expect(waitEstimate(f, incoming)).toBeGreaterThan(waitEstimate(f, busy))
    const damaged = { ...incoming, damage: 'moderate' as const }
    expect(waitEstimate(f, damaged)).toBeGreaterThan(waitEstimate(f, incoming))
  })
})
