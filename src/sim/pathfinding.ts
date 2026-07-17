import { haversineKm } from './geo'
import { nearestNode, type RoadEdge, type RoadNetwork } from './roadNetwork'
import type { LngLat, ShakeZone } from './types'

export interface PathOptions {
  closedEdgeIds?: Set<string>
  zones?: ShakeZone[]
}

export interface PathResult {
  nodeIds: string[]
  edgeIds: string[]
  coords: LngLat[]
  minutes: number
  km: number
  /** Major road names along the route, longest stretch first. */
  viaNames: string[]
}

/** Post-quake average speeds, km/h. */
const SPEED_KMH: Record<RoadEdge['kind'], number> = {
  freeway: 72,
  highway: 52,
  arterial: 36,
}
/** Local-street spur between a raw point and its snap node. */
const SPUR_KMH = 26
const FASTEST_KMH = SPEED_KMH.freeway

const ZONE_MULTIPLIER: Partial<Record<ShakeZone['kind'], number>> = {
  severe: 1.6,
  strong: 1.25,
}

/** Per-edge slowdown from shake zones, memoized per zones-array identity. */
const zoneCostCache = new WeakMap<ShakeZone[], Map<string, number>>()

function edgeMultiplier(edge: RoadEdge, zones: ShakeZone[]): number {
  if (zones.length === 0) return 1
  let cache = zoneCostCache.get(zones)
  if (!cache) {
    cache = new Map()
    zoneCostCache.set(zones, cache)
  }
  const hit = cache.get(edge.id)
  if (hit !== undefined) return hit
  const mid = edge.coords[Math.floor(edge.coords.length / 2)]
  let mult = 1
  for (const zone of zones) {
    const zm = ZONE_MULTIPLIER[zone.kind]
    if (!zm || zm <= mult) continue
    if (pointInZone(mid, zone)) mult = zm
  }
  cache.set(edge.id, mult)
  return mult
}

function pointInZone(p: LngLat, zone: ShakeZone): boolean {
  // Cheap bounding pre-check via center distance is skipped: rings are small.
  const poly = zone.polygon
  const [x, y] = p
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function edgeMinutes(edge: RoadEdge, zones: ShakeZone[]): number {
  return (edge.lengthKm / SPEED_KMH[edge.kind]) * 60 * edgeMultiplier(edge, zones)
}

interface HeapItem {
  f: number
  id: string
}

/** Binary min-heap with deterministic (f, id) ordering. */
class MinHeap {
  private items: HeapItem[] = []

  get size(): number {
    return this.items.length
  }

  push(item: HeapItem): void {
    const items = this.items
    items.push(item)
    let i = items.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.less(items[i], items[parent])) {
        ;[items[i], items[parent]] = [items[parent], items[i]]
        i = parent
      } else break
    }
  }

  pop(): HeapItem | undefined {
    const items = this.items
    if (items.length === 0) return undefined
    const top = items[0]
    const last = items.pop()!
    if (items.length > 0) {
      items[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let smallest = i
        if (l < items.length && this.less(items[l], items[smallest])) smallest = l
        if (r < items.length && this.less(items[r], items[smallest])) smallest = r
        if (smallest === i) break
        ;[items[i], items[smallest]] = [items[smallest], items[i]]
        i = smallest
      }
    }
    return top
  }

  private less(a: HeapItem, b: HeapItem): boolean {
    return a.f < b.f || (a.f === b.f && a.id < b.id)
  }
}

export function findPath(
  net: RoadNetwork,
  from: LngLat,
  to: LngLat,
  options: PathOptions = {},
): PathResult | null {
  const closed = options.closedEdgeIds
  const zones = options.zones ?? []
  const start = nearestNode(net, from)
  const goal = nearestNode(net, to)

  const spurStartKm = haversineKm(from, start.lngLat)
  const spurEndKm = haversineKm(goal.lngLat, to)
  const spurMinutes = ((spurStartKm + spurEndKm) / SPUR_KMH) * 60

  if (start.id === goal.id) {
    const coords: LngLat[] = [from, start.lngLat, to]
    return {
      nodeIds: [start.id],
      edgeIds: [],
      coords,
      minutes: spurMinutes,
      km: spurStartKm + spurEndKm,
      viaNames: [],
    }
  }

  const g = new Map<string, number>()
  const cameFrom = new Map<string, { node: string; edgeId: string }>()
  const done = new Set<string>()
  const heap = new MinHeap()
  const h = (id: string) =>
    (haversineKm(net.nodes.get(id)!.lngLat, goal.lngLat) / FASTEST_KMH) * 60
  g.set(start.id, 0)
  heap.push({ f: h(start.id), id: start.id })

  while (heap.size > 0) {
    const cur = heap.pop()!
    if (done.has(cur.id)) continue
    done.add(cur.id)
    if (cur.id === goal.id) break
    const curG = g.get(cur.id)!
    for (const { edgeId, to: next } of net.adj.get(cur.id) ?? []) {
      if (closed?.has(edgeId) || done.has(next)) continue
      const edge = net.edges.get(edgeId)!
      const tentative = curG + edgeMinutes(edge, zones)
      const known = g.get(next)
      if (known === undefined || tentative < known - 1e-12) {
        g.set(next, tentative)
        cameFrom.set(next, { node: cur.id, edgeId })
        heap.push({ f: tentative + h(next), id: next })
      }
    }
  }

  if (!done.has(goal.id)) return null

  // Reconstruct.
  const nodeIds: string[] = [goal.id]
  const edgeIds: string[] = []
  let cursor = goal.id
  while (cursor !== start.id) {
    const step = cameFrom.get(cursor)!
    edgeIds.push(step.edgeId)
    cursor = step.node
    nodeIds.push(cursor)
  }
  nodeIds.reverse()
  edgeIds.reverse()

  const coords: LngLat[] = [from]
  let km = spurStartKm + spurEndKm
  const nameKm = new Map<string, number>()
  for (let i = 0; i < edgeIds.length; i += 1) {
    const edge = net.edges.get(edgeIds[i])!
    const forward = edge.a === nodeIds[i]
    const seg = forward ? edge.coords : [...edge.coords].reverse()
    for (const c of i === 0 ? seg : seg.slice(1)) coords.push(c)
    km += edge.lengthKm
    if (edge.kind !== 'arterial') {
      nameKm.set(edge.name, (nameKm.get(edge.name) ?? 0) + edge.lengthKm)
    }
  }
  coords.push(to)

  const viaNames = [...nameKm.entries()]
    .filter(([, len]) => len > 0.8)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, 3)
    .map(([name]) => name)

  return {
    nodeIds,
    edgeIds,
    coords,
    minutes: g.get(goal.id)! + spurMinutes,
    km,
    viaNames,
  }
}
