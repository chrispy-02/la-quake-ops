import { describe, expect, test } from 'vitest'
import { organicPolygon } from './geo'
import { findPath } from './pathfinding'
import { buildRoadNetwork } from './roadNetwork'
import type { LngLat, ShakeZone } from './types'

const net = buildRoadNetwork()
const SM: LngLat = [-118.4855, 34.0295] // Santa Monica
const USC_MED: LngLat = [-118.2097, 34.0616] // LAC+USC, Boyle Heights

describe('findPath', () => {
  test('routes Santa Monica to LAC+USC along I-10 in a plausible time', () => {
    const r = findPath(net, SM, USC_MED)
    expect(r).not.toBeNull()
    expect(r!.minutes).toBeGreaterThan(12)
    expect(r!.minutes).toBeLessThan(50)
    expect(r!.coords.length).toBeGreaterThan(10)
    expect(r!.edgeIds.length).toBeGreaterThan(0)
    expect(r!.viaNames.join(' ')).toContain('I-10')
  })

  test('is deterministic', () => {
    const a = findPath(net, SM, USC_MED)
    const b = findPath(net, SM, USC_MED)
    expect(a).toEqual(b)
  })

  test('detours around closed edges and takes longer', () => {
    const base = findPath(net, SM, USC_MED)!
    const closed = new Set(base.edgeIds)
    const detour = findPath(net, SM, USC_MED, { closedEdgeIds: closed })
    expect(detour).not.toBeNull()
    for (const id of detour!.edgeIds) {
      expect(closed.has(id)).toBe(false)
    }
    expect(detour!.minutes).toBeGreaterThan(base.minutes)
  })

  test('returns null when the whole network is closed', () => {
    const all = new Set([...net.edges.keys()])
    expect(findPath(net, SM, USC_MED, { closedEdgeIds: all })).toBeNull()
  })

  test('severe shaking zones increase traversal cost', () => {
    const zone: ShakeZone = {
      id: 'z',
      kind: 'severe',
      label: 'MMI VIII+',
      center: [-118.25, 34.04],
      polygon: organicPolygon([-118.25, 34.04], 8, { seed: 5 }),
    }
    const base = findPath(net, SM, USC_MED)!
    const slowed = findPath(net, SM, USC_MED, { zones: [zone] })!
    expect(slowed.minutes).toBeGreaterThan(base.minutes)
  })
})
