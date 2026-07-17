import { haversineKm, pathLengthKm } from './geo'
import type { LngLat } from './types'

export interface RoadNode {
  id: string
  lngLat: LngLat
}

export type RoadKind = 'freeway' | 'highway' | 'arterial'

export interface RoadEdge {
  id: string
  a: string
  b: string
  kind: RoadKind
  name: string
  coords: LngLat[]
  lengthKm: number
}

export interface RoadNetwork {
  nodes: Map<string, RoadNode>
  edges: Map<string, RoadEdge>
  adj: Map<string, { edgeId: string; to: string }[]>
}

/**
 * Named vertices of the stylized LA road graph. Coordinates are hand-traced
 * approximations of real interchanges/corridors — close enough to hug the
 * basemap's freeways at metro zoom, not navigation-grade.
 */
const NODES: Record<string, LngLat> = {
  // Westside / Santa Monica
  'sm-downtown': [-118.489, 34.029],
  'i10-sm': [-118.493, 34.021],
  cloverfield10: [-118.468, 34.023],
  i10x405: [-118.443, 34.03],
  culver10: [-118.411, 34.032],
  lacienega10: [-118.376, 34.0345],
  crenshaw10: [-118.335, 34.035],
  western10: [-118.309, 34.0355],
  i10x110: [-118.274, 34.0365],
  central10: [-118.254, 34.033],
  eastla: [-118.217, 34.023],
  i10x710: [-118.168, 34.0555],
  alhambra10: [-118.155, 34.064],
  sangabriel10: [-118.106, 34.07],
  elmonte10: [-118.048, 34.07],
  // US-101 Hollywood Fwy
  fourlevel: [-118.2495, 34.0577],
  echopark101: [-118.263, 34.076],
  vermont101: [-118.292, 34.089],
  western101: [-118.309, 34.091],
  cahuenga101: [-118.329, 34.104],
  hollywoodsplit: [-118.362, 34.14],
  studiocity101: [-118.396, 34.144],
  vannuys101: [-118.449, 34.155],
  i405x101: [-118.469, 34.1555],
  encino101: [-118.521, 34.16],
  woodlandhills101: [-118.606, 34.168],
  // I-110 / SR-110
  sanpedro110: [-118.29, 33.777],
  carson110: [-118.287, 33.83],
  i405x110: [-118.287, 33.8555],
  i91x110: [-118.28, 33.873],
  i105x110: [-118.281, 33.9285],
  century110: [-118.28, 33.945],
  slauson110: [-118.279, 33.989],
  solano110: [-118.233, 34.079],
  highlandpark110: [-118.193, 34.111],
  southpas110: [-118.159, 34.121],
  pasadena110: [-118.149, 34.133],
  // I-5
  norwalk5: [-118.066, 33.913],
  i5x710: [-118.166, 33.994],
  'i5-mission': [-118.223, 34.066],
  elysian5: [-118.236, 34.08],
  losfeliz5: [-118.257, 34.12],
  i5x134: [-118.276, 34.153],
  burbank5: [-118.309, 34.175],
  sunvalley5: [-118.37, 34.217],
  i5x405: [-118.469, 34.272],
  sylmar5: [-118.488, 34.319],
  // I-405
  i405x710lb: [-118.215, 33.8095],
  torrance405: [-118.33, 33.873],
  i405x105: [-118.3705, 33.93],
  lax405: [-118.396, 33.948],
  westwood405: [-118.448, 34.053],
  getty405: [-118.475, 34.079],
  seppass405: [-118.478, 34.108],
  mulholland405: [-118.47, 34.129],
  victory405: [-118.47, 34.187],
  nordhoff405: [-118.47, 34.235],
  // I-105
  'lax-imperial': [-118.401, 33.93],
  hawthorne105: [-118.326, 33.928],
  central105: [-118.254, 33.928],
  i105x710: [-118.185, 33.912],
  norwalk105: [-118.103, 33.908],
  // I-710
  eastla710: [-118.172, 34.023],
  southgate710: [-118.181, 33.945],
  i91x710: [-118.204, 33.873],
  lb710: [-118.211, 33.775],
  // I-210 / SR-134
  sanfernando210: [-118.423, 34.287],
  lakeview210: [-118.367, 34.272],
  sunland210: [-118.32, 34.251],
  lacrescenta210: [-118.248, 34.224],
  lacanada210: [-118.206, 34.209],
  arroyo210: [-118.167, 34.185],
  i134x210: [-118.156, 34.1505],
  lake210: [-118.131, 34.148],
  arcadia210: [-118.048, 34.134],
  bv134: [-118.33, 34.151],
  glendale134: [-118.247, 34.151],
  eaglerock134: [-118.211, 34.145],
  // Wilshire corridor + connected arterials
  'wilshire-westwood': [-118.443, 34.059],
  'wilshire-labrea': [-118.344, 34.062],
  'wilshire-western': [-118.309, 34.0617],
  'vermont-wilshire': [-118.2915, 34.062],
  'wilshire-westlake': [-118.279, 34.0575],
  'wilshire-dtla': [-118.256, 34.05],
  'vermont-exposition': [-118.291, 34.018],
  'vermont-slauson': [-118.2915, 33.989],
  'vermont-century': [-118.2915, 33.945],
  'cedars-lacienega': [-118.376, 34.076],
  weho: [-118.364, 34.083],
  'sunset-highland': [-118.339, 34.098],
  'venice-lincoln': [-118.462, 33.988],
  'culver-downtown': [-118.396, 34.023],
  'central-vernon': [-118.247, 34.004],
  'central-watts': [-118.243, 33.943],
  'fairoaks-southpas': [-118.151, 34.111],
  'tor-hawthorne': [-118.35, 33.81],
  'northridge-reseda': [-118.529, 34.228],
  'vn-civic': [-118.448, 34.186],
  'vn-north': [-118.448, 34.221],
  'willow-lb': [-118.185, 33.808],
  'atlantic-lb': [-118.187, 33.78],
}

interface CorridorSpec {
  slug: string
  name: string
  kind: RoadKind
  /** Node ids interleaved with raw shape coordinates. */
  path: (string | LngLat)[]
}

const CORRIDORS: CorridorSpec[] = [
  {
    slug: 'i10w',
    name: 'I-10 Santa Monica Fwy',
    kind: 'freeway',
    path: [
      'i10-sm',
      'cloverfield10',
      'i10x405',
      'culver10',
      'lacienega10',
      'crenshaw10',
      'western10',
      'i10x110',
      'central10',
      [-118.235, 34.028],
      'eastla',
    ],
  },
  {
    slug: 'i10e',
    name: 'I-10 San Bernardino Fwy',
    kind: 'freeway',
    path: ['eastla', [-118.185, 34.048], 'i10x710', 'alhambra10', 'sangabriel10', 'elmonte10'],
  },
  {
    slug: 'us101h',
    name: 'US-101 Hollywood Fwy',
    kind: 'freeway',
    path: [
      'fourlevel',
      'echopark101',
      'vermont101',
      'western101',
      'cahuenga101',
      [-118.339, 34.118],
      'hollywoodsplit',
      'studiocity101',
      'vannuys101',
      'i405x101',
      'encino101',
      'woodlandhills101',
    ],
  },
  {
    slug: 'us101sa',
    name: 'US-101 Santa Ana Fwy',
    kind: 'freeway',
    path: ['fourlevel', [-118.234, 34.051], 'eastla'],
  },
  {
    slug: 'i110',
    name: 'I-110 Harbor Fwy',
    kind: 'freeway',
    path: [
      'sanpedro110',
      'carson110',
      'i405x110',
      'i91x110',
      'i105x110',
      'century110',
      'slauson110',
      [-118.278, 34.018],
      'i10x110',
      [-118.266, 34.047],
      'fourlevel',
    ],
  },
  {
    slug: 'sr110',
    name: 'SR-110 Arroyo Seco Pkwy',
    kind: 'highway',
    path: ['fourlevel', 'solano110', [-118.205, 34.098], 'highlandpark110', 'southpas110', 'pasadena110'],
  },
  {
    slug: 'i5',
    name: 'I-5 Golden State Fwy',
    kind: 'freeway',
    path: [
      'norwalk5',
      [-118.12, 33.95],
      'i5x710',
      'eastla',
      'i5-mission',
      'elysian5',
      'losfeliz5',
      'i5x134',
      'burbank5',
      [-118.347, 34.193],
      'sunvalley5',
      [-118.427, 34.246],
      'i5x405',
      'sylmar5',
    ],
  },
  {
    slug: 'i405',
    name: 'I-405 San Diego Fwy',
    kind: 'freeway',
    path: [
      'i405x710lb',
      'i405x110',
      'torrance405',
      'i405x105',
      'lax405',
      [-118.43, 33.985],
      'i10x405',
      'westwood405',
      'getty405',
      'seppass405',
      'mulholland405',
      'i405x101',
      'victory405',
      'nordhoff405',
      'i5x405',
    ],
  },
  {
    slug: 'i105',
    name: 'I-105 Century Fwy',
    kind: 'freeway',
    path: ['lax-imperial', 'i405x105', 'hawthorne105', 'i105x110', 'central105', 'i105x710', 'norwalk105'],
  },
  {
    slug: 'i710',
    name: 'I-710 Long Beach Fwy',
    kind: 'freeway',
    path: ['i10x710', 'eastla710', 'i5x710', 'southgate710', 'i105x710', 'i91x710', 'i405x710lb', 'lb710'],
  },
  {
    slug: 'sr91',
    name: 'SR-91 Artesia Fwy',
    kind: 'freeway',
    path: ['i91x110', 'i91x710'],
  },
  {
    slug: 'i210',
    name: 'I-210 Foothill Fwy',
    kind: 'freeway',
    path: [
      'sylmar5',
      'sanfernando210',
      'lakeview210',
      'sunland210',
      'lacrescenta210',
      'lacanada210',
      'arroyo210',
      'i134x210',
      'lake210',
      'arcadia210',
    ],
  },
  {
    slug: 'sr134',
    name: 'SR-134 Ventura Fwy',
    kind: 'freeway',
    path: ['hollywoodsplit', 'bv134', 'i5x134', 'glendale134', 'eaglerock134', 'i134x210'],
  },
  // Arterials
  {
    slug: 'wilshire',
    name: 'Wilshire Blvd',
    kind: 'arterial',
    path: [
      'sm-downtown',
      'westwood405',
      'wilshire-westwood',
      'wilshire-labrea',
      'wilshire-western',
      'vermont-wilshire',
      'wilshire-westlake',
      'wilshire-dtla',
    ],
  },
  {
    slug: 'lincoln',
    name: 'Lincoln Blvd',
    kind: 'arterial',
    path: ['sm-downtown', 'i10-sm', [-118.478, 34.005], 'venice-lincoln', 'lax-imperial'],
  },
  {
    slug: 'grand',
    name: 'Grand Ave',
    kind: 'arterial',
    path: ['fourlevel', 'wilshire-dtla', 'i10x110'],
  },
  {
    slug: 'lacienega',
    name: 'La Cienega Blvd',
    kind: 'arterial',
    path: ['lacienega10', 'cedars-lacienega', 'weho'],
  },
  {
    slug: 'sunset',
    name: 'Sunset Blvd',
    kind: 'arterial',
    path: ['weho', 'sunset-highland', 'cahuenga101'],
  },
  {
    slug: 'labrea',
    name: 'La Brea Ave',
    kind: 'arterial',
    path: ['crenshaw10', 'wilshire-labrea', 'sunset-highland'],
  },
  {
    slug: 'western',
    name: 'Western Ave',
    kind: 'arterial',
    path: ['western10', 'wilshire-western', 'western101'],
  },
  {
    slug: 'vermont',
    name: 'Vermont Ave',
    kind: 'arterial',
    path: [
      'vermont101',
      'vermont-wilshire',
      'vermont-exposition',
      'vermont-slauson',
      'vermont-century',
      [-118.286, 33.933],
      'i105x110',
    ],
  },
  {
    slug: 'central',
    name: 'Central Ave',
    kind: 'arterial',
    path: ['central10', 'central-vernon', 'central-watts', 'central105'],
  },
  {
    slug: 'venice',
    name: 'Venice Blvd',
    kind: 'arterial',
    path: ['culver10', 'culver-downtown'],
  },
  {
    slug: 'fairoaks',
    name: 'Fair Oaks Ave',
    kind: 'arterial',
    path: ['alhambra10', 'fairoaks-southpas', 'southpas110'],
  },
  {
    slug: 'hawthorneblvd',
    name: 'Hawthorne Blvd',
    kind: 'arterial',
    path: ['torrance405', 'tor-hawthorne'],
  },
  {
    slug: 'nordhoff',
    name: 'Nordhoff St',
    kind: 'arterial',
    path: ['nordhoff405', 'northridge-reseda'],
  },
  {
    slug: 'vannuysblvd',
    name: 'Van Nuys Blvd',
    kind: 'arterial',
    path: ['vannuys101', 'vn-civic', 'vn-north'],
  },
  {
    slug: 'victory',
    name: 'Victory Blvd',
    kind: 'arterial',
    path: ['vn-civic', 'victory405'],
  },
  {
    slug: 'roscoe',
    name: 'Roscoe Blvd',
    kind: 'arterial',
    path: ['vn-north', 'nordhoff405'],
  },
  {
    slug: 'willow',
    name: 'Willow St',
    kind: 'arterial',
    path: ['i405x710lb', 'willow-lb'],
  },
  {
    slug: 'atlantic',
    name: 'Atlantic Ave',
    kind: 'arterial',
    path: ['willow-lb', 'atlantic-lb'],
  },
  {
    slug: 'broadway-lb',
    name: 'Broadway (Long Beach)',
    kind: 'arterial',
    path: ['atlantic-lb', 'lb710'],
  },
]

let cached: RoadNetwork | null = null

export function buildRoadNetwork(): RoadNetwork {
  if (cached) return cached
  const nodes = new Map<string, RoadNode>()
  for (const [id, lngLat] of Object.entries(NODES)) {
    nodes.set(id, { id, lngLat })
  }
  const edges = new Map<string, RoadEdge>()
  const adj = new Map<string, { edgeId: string; to: string }[]>()
  const link = (from: string, entry: { edgeId: string; to: string }) => {
    const list = adj.get(from)
    if (list) list.push(entry)
    else adj.set(from, [entry])
  }
  for (const corridor of CORRIDORS) {
    let prevNode: string | null = null
    let shape: LngLat[] = []
    for (const step of corridor.path) {
      if (typeof step !== 'string') {
        shape.push(step)
        continue
      }
      const node = nodes.get(step)
      if (!node) throw new Error(`corridor ${corridor.slug} references unknown node ${step}`)
      if (prevNode !== null) {
        const a = nodes.get(prevNode)!
        const coords: LngLat[] = [a.lngLat, ...shape, node.lngLat]
        const id = `${corridor.slug}:${prevNode}-${step}`
        edges.set(id, {
          id,
          a: prevNode,
          b: step,
          kind: corridor.kind,
          name: corridor.name,
          coords,
          lengthKm: pathLengthKm(coords),
        })
        link(prevNode, { edgeId: id, to: step })
        link(step, { edgeId: id, to: prevNode })
      }
      prevNode = step
      shape = []
    }
  }
  cached = { nodes, edges, adj }
  return cached
}

export function nearestNode(net: RoadNetwork, p: LngLat): RoadNode {
  let best: RoadNode | null = null
  let bestD = Infinity
  for (const node of net.nodes.values()) {
    const d = haversineKm(p, node.lngLat)
    if (d < bestD || (d === bestD && best && node.id < best.id)) {
      bestD = d
      best = node
    }
  }
  if (!best) throw new Error('empty road network')
  return best
}
