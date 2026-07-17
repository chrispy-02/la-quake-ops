import { describe, expect, test } from 'vitest'
import { FACILITIES } from './facilities'
import { haversineKm } from './geo'
import { buildRoadNetwork, nearestNode } from './roadNetwork'
import type { LngLat } from './types'

const net = buildRoadNetwork()

describe('buildRoadNetwork', () => {
  test('has a substantial metro-scale graph', () => {
    expect(net.nodes.size).toBeGreaterThan(60)
    expect(net.edges.size).toBeGreaterThan(70)
  })

  test('edge endpoints all exist as nodes and geometry matches them', () => {
    for (const e of net.edges.values()) {
      const a = net.nodes.get(e.a)
      const b = net.nodes.get(e.b)
      expect(a, `edge ${e.id} endpoint a`).toBeTruthy()
      expect(b, `edge ${e.id} endpoint b`).toBeTruthy()
      expect(e.lengthKm).toBeGreaterThan(0)
      expect(e.coords.length).toBeGreaterThanOrEqual(2)
      expect(haversineKm(e.coords[0], a!.lngLat)).toBeLessThan(0.05)
      expect(haversineKm(e.coords[e.coords.length - 1], b!.lngLat)).toBeLessThan(0.05)
    }
  })

  test('graph is essentially fully connected', () => {
    const start = nearestNode(net, [-118.25, 34.05]).id
    const seen = new Set<string>([start])
    const queue = [start]
    while (queue.length > 0) {
      const cur = queue.pop()!
      for (const { to } of net.adj.get(cur) ?? []) {
        if (!seen.has(to)) {
          seen.add(to)
          queue.push(to)
        }
      }
    }
    expect(seen.size / net.nodes.size).toBeGreaterThan(0.95)
  })

  test('includes named LA freeways', () => {
    const names = new Set([...net.edges.values()].map((e) => e.name))
    for (const fw of ['I-10', 'I-405', 'US-101', 'I-110', 'I-5', 'I-210', 'I-105', 'I-710']) {
      expect([...names].some((n) => n.includes(fw)), `expected ${fw}`).toBe(true)
    }
  })
})

describe('nearestNode', () => {
  test('finds a node near LAX', () => {
    const lax: LngLat = [-118.4, 33.945]
    const n = nearestNode(net, lax)
    expect(haversineKm(lax, n.lngLat)).toBeLessThan(5)
  })
})

describe('facility coverage', () => {
  test('every facility is within 6 km of the road graph', () => {
    for (const f of FACILITIES) {
      const n = nearestNode(net, f.lngLat)
      expect(
        haversineKm(f.lngLat, n.lngLat),
        `${f.id} too far from graph`,
      ).toBeLessThan(6)
    }
  })
})
