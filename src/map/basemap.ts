import type { Map as MlMap, StyleSpecification } from 'maplibre-gl'

/** OpenFreeMap dark style — no API key required. */
export const BASEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark'

/** Minimal offline fallback so overlays still render if tiles are unreachable. */
export const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  name: 'offline-fallback',
  sources: {},
  layers: [
    {
      id: 'bg',
      type: 'background',
      paint: { 'background-color': '#0a1016' },
    },
  ],
}

export function firstLineLayerId(map: MlMap): string | undefined {
  return map.getStyle().layers?.find((l) => l.type === 'line')?.id
}

export function firstSymbolLayerId(map: MlMap): string | undefined {
  return map.getStyle().layers?.find((l) => l.type === 'symbol')?.id
}

/** Extrude OpenMapTiles building footprints for 2.5D city context. */
export function add3DBuildings(map: MlMap): void {
  if (map.getLayer('sim-3d-buildings') || !map.getSource('openmaptiles')) return
  map.addLayer(
    {
      id: 'sim-3d-buildings',
      type: 'fill-extrusion',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 12.5,
      paint: {
        'fill-extrusion-color': '#1f2c3d',
        'fill-extrusion-opacity': 0.82,
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 14],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      },
    },
    firstSymbolLayerId(map),
  )
}
