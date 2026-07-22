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

/**
 * Extrude OpenMapTiles building footprints for the 3D city view. Kept BELOW the
 * simulation route/marker layers (inserted before the first basemap symbol
 * layer) so routes, incidents and hospitals stay readable above rooftops.
 *
 * Gracefully degrades: where `render_height` is missing (common outside dense
 * cores) a modest default height is used, so footprints still extrude rather
 * than vanish. Starts extruding at a low zoom so buildings are visible as soon
 * as the 3D camera arrives — no hidden zoom threshold to discover.
 */
export function add3DBuildings(map: MlMap): void {
  if (map.getLayer('sim-3d-buildings') || !map.getSource('openmaptiles')) return
  map.addLayer(
    {
      id: 'sim-3d-buildings',
      type: 'fill-extrusion',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 11.5,
      layout: { visibility: 'none' },
      paint: {
        // Subtle height-graded color so towers read against the dark basemap.
        'fill-extrusion-color': [
          'interpolate',
          ['linear'],
          ['coalesce', ['get', 'render_height'], 12],
          0, '#1c2635',
          40, '#26374d',
          120, '#324a66',
        ],
        'fill-extrusion-opacity': 0.72,
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 12],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      },
    },
    firstSymbolLayerId(map),
  )
}
