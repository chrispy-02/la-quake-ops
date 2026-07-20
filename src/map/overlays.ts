import type { Feature, FeatureCollection, LineString, MultiLineString, Point, Polygon } from 'geojson'
import { pointAlong } from '../sim/geo'
import type { RoadNetwork } from '../sim/roadNetwork'
import type { Incident, LngLat, RoadClosure, ShakeZone } from '../sim/types'

export function zonesFC(zones: ShakeZone[]): FeatureCollection<Polygon> {
  return {
    type: 'FeatureCollection',
    features: zones.map(
      (z): Feature<Polygon> => ({
        type: 'Feature',
        properties: { kind: z.kind, label: z.label },
        geometry: { type: 'Polygon', coordinates: [z.polygon] },
      }),
    ),
  }
}

export function closuresFC(closures: RoadClosure[], net: RoadNetwork): FeatureCollection<MultiLineString> {
  return {
    type: 'FeatureCollection',
    features: closures.map(
      (c): Feature<MultiLineString> => ({
        type: 'Feature',
        properties: { reopened: c.reopened === true },
        geometry: {
          type: 'MultiLineString',
          coordinates: c.edgeIds
            .map((id) => net.edges.get(id)?.coords)
            .filter((coords): coords is LngLat[] => coords !== undefined),
        },
      }),
    ),
  }
}

export function closureMidpoint(closure: RoadClosure, net: RoadNetwork): LngLat | null {
  const coords = net.edges.get(closure.edgeIds[0])?.coords
  if (!coords) return null
  return pointAlong(coords, 0.5)
}

const ACTIVE_ROUTE_STATUSES = new Set(['assigned', 'in-transit'])

export function routesFC(incidents: Incident[], selectedId: string | null): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: incidents
      .filter((i) => ACTIVE_ROUTE_STATUSES.has(i.status) && i.routeCoords && i.routeCoords.length > 1)
      .map(
        (i): Feature<LineString> => ({
          type: 'Feature',
          properties: { id: i.id, sel: i.id === selectedId },
          geometry: { type: 'LineString', coordinates: i.routeCoords! },
        }),
      ),
  }
}

export function transportsFC(incidents: Incident[], simMin: number, selectedId: string | null): FeatureCollection<Point> {
  const features: Feature<Point>[] = []
  for (const i of incidents) {
    if (i.status !== 'in-transit' || !i.routeCoords || i.departT === null || i.arriveT === null) continue
    if (i.arriveT <= i.departT) continue
    const progress = Math.min(1, Math.max(0, (simMin - i.departT) / (i.arriveT - i.departT)))
    features.push({
      type: 'Feature',
      properties: { id: i.id, sel: i.id === selectedId },
      geometry: { type: 'Point', coordinates: pointAlong(i.routeCoords, progress) },
    })
  }
  return { type: 'FeatureCollection', features }
}

export const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] }
