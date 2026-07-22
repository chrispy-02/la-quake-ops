import maplibregl, { Map as MlMap, Marker } from 'maplibre-gl'
import type { GeoJSONSource } from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'
import { FACILITIES } from '../sim/facilities'
import { buildRoadNetwork } from '../sim/roadNetwork'
import type { LngLat, Quake } from '../sim/types'
import { engine, useSim, type Selection } from '../store'
import { BASEMAP_STYLE_URL, FALLBACK_STYLE, add3DBuildings, firstLineLayerId } from './basemap'
import {
  closureMarkerHtml,
  closureTooltipHtml,
  facilityMarkerHtml,
  facilityMarkerKey,
  facilityTooltipHtml,
  incidentMarkerHtml,
  incidentMarkerKey,
  incidentTooltipHtml,
  quakeMarkerHtml,
} from './markers'
import { EMPTY_FC, closureMidpoint, closuresFC, routesFC, transportsFC, zonesFC } from './overlays'
import { zonesForQuake } from '../sim/hazard'

export interface LayersState {
  hospitals: boolean
  clinics: boolean
  incidents: boolean
  routes: boolean
  zones: boolean
  closures: boolean
}

export type MapMode = '2d' | '3d'

/** Pending earthquake config while the operator is placing an epicenter (idle). */
export interface Placement {
  epicenter: LngLat
  magnitude: number
  depthKm: number
}

interface Props {
  selection: Selection | null
  onSelect: (sel: Selection | null) => void
  layers: LayersState
  mode: MapMode
  /** Non-null while configuring the scenario (idle): shows a draggable epicenter + preview zones. */
  placement: Placement | null
  onPlaceEpicenter: (lngLat: LngLat) => void
  /** Receives the MapLibre instance once the style has loaded (for camera controls). */
  onReady?: (map: MlMap) => void
}

/** Small pixel offsets to declutter facility pairs that nearly share a location. */
const MARKER_OFFSET: Record<string, [number, number]> = {
  kaiserla: [-9, -7],
  chla: [9, -5],
  hollywoodpres: [-7, 9],
  smucla: [-7, 7],
  stjohns: [7, -7],
}

const DASH_PATTERNS: number[][] = [
  [0, 4, 3],
  [1, 4, 2],
  [2, 4, 1],
  [3, 4, 0],
]

const net = buildRoadNetwork()

export function MapView({ selection, onSelect, layers, mode, placement, onPlaceEpicenter, onReady }: Props) {
  const state = useSim()
  const hostRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const [ready, setReady] = useState(0)

  const selectionRef = useRef(selection)
  selectionRef.current = selection
  const layersRef = useRef(layers)
  layersRef.current = layers
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady
  const placementRef = useRef(placement)
  placementRef.current = placement
  const onPlaceRef = useRef(onPlaceEpicenter)
  onPlaceRef.current = onPlaceEpicenter
  const modeRef = useRef(mode)
  modeRef.current = mode
  const epicenterMarker = useRef<Marker | null>(null)

  const facMarkers = useRef(new Map<string, { m: Marker; key: string }>())
  const incMarkers = useRef(new Map<string, { m: Marker; key: string }>())
  const quakeMarkers = useRef(new Map<string, Marker>())
  const closureMarkers = useRef(new Map<string, { m: Marker; key: string }>())
  const prevQuakeCount = useRef(0)

  const showTooltip = (anchor: HTMLElement, html: string) => {
    const tip = tooltipRef.current
    const host = hostRef.current
    if (!tip || !host) return
    tip.innerHTML = html
    tip.style.display = 'block'
    const hostRect = host.getBoundingClientRect()
    const rect = anchor.getBoundingClientRect()
    let left = rect.right - hostRect.left + 10
    if (left + 260 > hostRect.width) left = rect.left - hostRect.left - 260
    let top = rect.top - hostRect.top - 10
    top = Math.max(60, Math.min(top, hostRect.height - tip.offsetHeight - 50))
    tip.style.left = `${Math.max(6, left)}px`
    tip.style.top = `${top}px`
  }
  const hideTooltip = () => {
    if (tooltipRef.current) tooltipRef.current.style.display = 'none'
  }

  // ── map lifecycle ──────────────────────────────────────────────────
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const fMarkers = facMarkers.current
    const iMarkers = incMarkers.current
    const qMarkers = quakeMarkers.current
    const cMarkers = closureMarkers.current
    const map = new maplibregl.Map({
      container: host,
      style: BASEMAP_STYLE_URL,
      center: [-118.33, 34.02],
      zoom: 9.3,
      pitch: 0,
      bearing: 0,
      minZoom: 8,
      maxZoom: 17.5,
      maxPitch: 68,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    // Handy for demos & QA (drive the camera from the console).
    ;(window as unknown as { __map?: MlMap }).__map = map
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')

    let styleLoaded = false
    const fallbackTimer = window.setTimeout(() => {
      if (!styleLoaded) map.setStyle(FALLBACK_STYLE)
    }, 7000)
    map.on('style.load', () => {
      styleLoaded = true
      ensureLayers(map)
      setReady((r) => r + 1)
      onReadyRef.current?.(map)
    })
    map.on('click', (e) => {
      // While configuring the scenario, a map click places the epicenter.
      if (placementRef.current) {
        onPlaceRef.current([+e.lngLat.lng.toFixed(4), +e.lngLat.lat.toFixed(4)])
        return
      }
      onSelectRef.current(null)
    })

    return () => {
      window.clearTimeout(fallbackTimer)
      fMarkers.clear()
      iMarkers.clear()
      qMarkers.clear()
      cMarkers.clear()
      map.remove()
      mapRef.current = null
    }
  }, [])

  function ensureLayers(map: MlMap) {
    for (const id of ['sim-zones', 'preview-zones', 'sim-closures', 'sim-routes', 'sim-transports']) {
      if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: EMPTY_FC })
    }
    const beforeLines = firstLineLayerId(map)
    const zoneColor: maplibregl.ExpressionSpecification = [
      'match',
      ['get', 'kind'],
      'severe',
      '#d93025',
      'strong',
      '#f0731d',
      'moderate',
      '#f5b31c',
      '#ffe08a',
    ]
    if (!map.getLayer('sim-zones-fill')) {
      map.addLayer(
        {
          id: 'sim-zones-fill',
          type: 'fill',
          source: 'sim-zones',
          paint: {
            'fill-color': zoneColor,
            'fill-opacity': ['match', ['get', 'kind'], 'severe', 0.17, 'strong', 0.115, 'moderate', 0.075, 0.045],
          },
        },
        beforeLines,
      )
      map.addLayer(
        {
          id: 'sim-zones-line',
          type: 'line',
          source: 'sim-zones',
          paint: {
            'line-color': zoneColor,
            'line-opacity': 0.5,
            'line-width': ['match', ['get', 'kind'], 'severe', 1.9, 'strong', 1.5, 1.1],
            'line-dasharray': [2.4, 2.2],
          },
        },
        beforeLines,
      )
    }
    if (!map.getLayer('preview-zones-fill')) {
      map.addLayer(
        {
          id: 'preview-zones-fill',
          type: 'fill',
          source: 'preview-zones',
          paint: {
            'fill-color': zoneColor,
            'fill-opacity': ['match', ['get', 'kind'], 'severe', 0.16, 'strong', 0.1, 'moderate', 0.06, 0.035],
          },
        },
        beforeLines,
      )
      map.addLayer(
        {
          id: 'preview-zones-line',
          type: 'line',
          source: 'preview-zones',
          paint: {
            'line-color': zoneColor,
            'line-opacity': 0.7,
            'line-width': ['match', ['get', 'kind'], 'severe', 2, 'strong', 1.5, 1.1],
            'line-dasharray': [1.5, 1.6],
          },
        },
        beforeLines,
      )
    }
    if (!map.getLayer('sim-closures-line')) {
      map.addLayer({
        id: 'sim-closures-case',
        type: 'line',
        source: 'sim-closures',
        layout: { 'line-cap': 'round' },
        paint: { 'line-color': '#1a0505', 'line-width': 6.5, 'line-opacity': ['case', ['get', 'reopened'], 0.2, 0.65] },
      })
      map.addLayer({
        id: 'sim-closures-line',
        type: 'line',
        source: 'sim-closures',
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': ['case', ['get', 'reopened'], '#2dd4a7', '#ff5252'],
          'line-width': ['case', ['get', 'reopened'], 2, 3.4],
          'line-opacity': ['case', ['get', 'reopened'], 0.4, 0.95],
          'line-dasharray': [1.1, 1.6],
        },
      })
    }
    if (!map.getLayer('sim-routes-line')) {
      map.addLayer({
        id: 'sim-routes-case',
        type: 'line',
        source: 'sim-routes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#03202c',
          'line-width': ['case', ['get', 'sel'], 6, 4.4],
          'line-opacity': 0.85,
        },
      })
      map.addLayer({
        id: 'sim-routes-line',
        type: 'line',
        source: 'sim-routes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['case', ['get', 'sel'], '#7ce4fb', '#38d6f5'],
          'line-width': ['case', ['get', 'sel'], 3.4, 2.3],
          'line-opacity': ['case', ['get', 'sel'], 1, 0.82],
        },
      })
      map.addLayer({
        id: 'sim-routes-flow',
        type: 'line',
        source: 'sim-routes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#e6fbff',
          'line-width': ['case', ['get', 'sel'], 2.4, 1.6],
          'line-opacity': 0.9,
          'line-dasharray': DASH_PATTERNS[0],
        },
      })
    }
    if (!map.getLayer('sim-transports-dot')) {
      map.addLayer({
        id: 'sim-transports-halo',
        type: 'circle',
        source: 'sim-transports',
        paint: {
          'circle-radius': ['case', ['get', 'sel'], 14, 10],
          'circle-color': '#38d6f5',
          'circle-opacity': 0.2,
          'circle-blur': 0.4,
        },
      })
      map.addLayer({
        id: 'sim-transports-dot',
        type: 'circle',
        source: 'sim-transports',
        paint: {
          'circle-radius': ['case', ['get', 'sel'], 6.2, 4.6],
          'circle-color': '#c3f2ff',
          'circle-stroke-color': '#06232f',
          'circle-stroke-width': 2,
        },
      })
    }
    add3DBuildings(map)
  }

  // ── frame-accurate loop: transports + route dash flow ──────────────
  useEffect(() => {
    let raf = 0
    let dashIdx = 0
    let lastDash = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const map = mapRef.current
      if (!map) return
      const src = map.getSource('sim-transports') as GeoJSONSource | undefined
      if (src) {
        const s = engine.state
        const selId = selectionRef.current?.kind === 'incident' ? selectionRef.current.id : null
        src.setData(transportsFC(s.incidents, s.simMin, selId))
      }
      if (now - lastDash > 110 && map.getLayer('sim-routes-flow')) {
        lastDash = now
        dashIdx = (dashIdx + 1) % DASH_PATTERNS.length
        map.setPaintProperty('sim-routes-flow', 'line-dasharray', DASH_PATTERNS[dashIdx])
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [ready])

  // ── sync overlays & markers on sim/UI changes ──────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || ready === 0) return

    const setData = (id: string, fc: GeoJSON.FeatureCollection) => {
      const src = map.getSource(id) as GeoJSONSource | undefined
      src?.setData(fc)
    }
    setData('sim-zones', zonesFC(state.zones))
    setData('sim-closures', closuresFC(state.closures, net))
    setData(
      'sim-routes',
      routesFC(state.incidents, selection?.kind === 'incident' ? selection.id : null),
    )

    // Facilities
    for (const f of FACILITIES) {
      const visible = f.kind === 'hospital' ? layers.hospitals : layers.clinics
      const s = state.facilityStates[f.id]
      const isSel = selection?.kind === 'facility' && selection.id === f.id
      const key = facilityMarkerKey(f, s, isSel, visible)
      let entry = facMarkers.current.get(f.id)
      if (!entry) {
        const el = document.createElement('div')
        el.className = 'mk'
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          onSelectRef.current({ kind: 'facility', id: f.id })
        })
        el.addEventListener('mouseenter', () =>
          showTooltip(el, facilityTooltipHtml(f, engine.state.facilityStates[f.id])),
        )
        el.addEventListener('mouseleave', hideTooltip)
        const m = new Marker({ element: el, offset: MARKER_OFFSET[f.id] })
          .setLngLat(f.lngLat)
          .addTo(map)
        entry = { m, key: '' }
        facMarkers.current.set(f.id, entry)
      }
      if (entry.key !== key) {
        entry.key = key
        const el = entry.m.getElement()
        // Toggle only our own class — never reassign className, which would drop
        // MapLibre's `maplibregl-marker` class (and its position:absolute), making
        // the marker a full-width static block and shoving the pin off the point.
        el.classList.toggle('sel', isSel)
        el.style.display = visible ? '' : 'none'
        el.innerHTML = facilityMarkerHtml(f, s)
      }
    }

    // Incidents
    for (const inc of state.incidents) {
      const isSel = selection?.kind === 'incident' && selection.id === inc.id
      const key = incidentMarkerKey(inc, isSel, layers.incidents)
      let entry = incMarkers.current.get(inc.id)
      if (!entry) {
        const el = document.createElement('div')
        el.className = 'mk'
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          onSelectRef.current({ kind: 'incident', id: inc.id })
        })
        el.addEventListener('mouseenter', () => {
          const cur = engine.state.incidents.find((i) => i.id === inc.id)
          if (cur) showTooltip(el, incidentTooltipHtml(cur, engine.state.simMin))
        })
        el.addEventListener('mouseleave', hideTooltip)
        const m = new Marker({ element: el }).setLngLat(inc.lngLat).addTo(map)
        entry = { m, key: '' }
        incMarkers.current.set(inc.id, entry)
      }
      if (entry.key !== key) {
        entry.key = key
        const el = entry.m.getElement()
        el.classList.toggle('sel', isSel)
        el.style.display = layers.incidents ? '' : 'none'
        el.innerHTML = incidentMarkerHtml(inc)
      }
    }

    // Epicenters
    for (const q of state.quakes) {
      if (quakeMarkers.current.has(q.id)) continue
      const el = document.createElement('div')
      el.innerHTML = quakeMarkerHtml(q)
      const m = new Marker({ element: el }).setLngLat(q.epicenter).addTo(map)
      quakeMarkers.current.set(q.id, m)
    }

    // Closure badges
    for (const c of state.closures) {
      const key = `${c.reopened === true}|${layers.closures}`
      let entry = closureMarkers.current.get(c.id)
      if (!entry) {
        const mid = closureMidpoint(c, net)
        if (!mid) continue
        const el = document.createElement('div')
        el.addEventListener('mouseenter', () => {
          const cur = engine.state.closures.find((x) => x.id === c.id)
          if (cur) showTooltip(el, closureTooltipHtml(cur))
        })
        el.addEventListener('mouseleave', hideTooltip)
        const m = new Marker({ element: el }).setLngLat(mid).addTo(map)
        entry = { m, key: '' }
        closureMarkers.current.set(c.id, entry)
      }
      if (entry.key !== key) {
        entry.key = key
        const cur = state.closures.find((x) => x.id === c.id) ?? c
        const el = entry.m.getElement()
        el.style.display = layers.closures ? '' : 'none'
        el.innerHTML = closureMarkerHtml(cur)
      }
    }

    // Layer visibility
    const setVis = (id: string, on: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
    }
    setVis('sim-zones-fill', layers.zones)
    setVis('sim-zones-line', layers.zones)
    setVis('sim-closures-case', layers.closures)
    setVis('sim-closures-line', layers.closures)
    setVis('sim-routes-case', layers.routes)
    setVis('sim-routes-line', layers.routes)
    setVis('sim-routes-flow', layers.routes)
    setVis('sim-transports-halo', layers.routes)
    setVis('sim-transports-dot', layers.routes)
    setVis('sim-3d-buildings', mode === '3d')
  }, [state.version, selection, layers, ready, state, mode])

  // ── epicenter placement (configuring) + preview zones ──────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || ready === 0) return
    const previewSrc = map.getSource('preview-zones') as GeoJSONSource | undefined

    if (!placement) {
      epicenterMarker.current?.remove()
      epicenterMarker.current = null
      previewSrc?.setData(EMPTY_FC)
      return
    }

    const previewQuake = (): Quake => ({
      id: 'preview',
      name: 'preview',
      magnitude: placement.magnitude,
      epicenter: placement.epicenter,
      depthKm: placement.depthKm,
      t: 0,
      kind: 'mainshock',
    })

    // Draggable epicenter marker.
    if (!epicenterMarker.current) {
      const el = document.createElement('div')
      el.className = 'epi-marker'
      el.innerHTML = quakeMarkerHtml(previewQuake())
      const m = new Marker({ element: el, draggable: true })
        .setLngLat(placement.epicenter)
        .addTo(map)
      m.on('dragend', () => {
        const ll = m.getLngLat()
        onPlaceRef.current([+ll.lng.toFixed(4), +ll.lat.toFixed(4)])
      })
      epicenterMarker.current = m
    } else {
      epicenterMarker.current.setLngLat(placement.epicenter)
      epicenterMarker.current.getElement().innerHTML = quakeMarkerHtml(previewQuake())
    }

    // Preview shake footprint for the pending parameters.
    previewSrc?.setData(zonesFC(zonesForQuake(previewQuake())))
  }, [placement, ready])

  // ── 2D / 3D mode camera ────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || ready === 0) return
    if (mode === '2d') {
      map.easeTo({ pitch: 0, bearing: 0, duration: 700 })
      return
    }
    // Entering 3D: pitch toward the epicenter / selection / current center and
    // zoom in enough that building extrusions are immediately visible.
    let target: LngLat | undefined
    const p = placementRef.current
    const mainshock = engine.state.quakes.find((q) => q.kind === 'mainshock')
    if (selectionRef.current?.kind === 'facility') {
      target = FACILITIES.find((f) => f.id === selectionRef.current!.id)?.lngLat
    } else if (mainshock) {
      target = mainshock.epicenter
    } else if (p) {
      target = p.epicenter
    }
    map.easeTo({
      center: target ?? map.getCenter(),
      zoom: Math.max(13.4, map.getZoom()),
      pitch: 56,
      bearing: -18,
      duration: 1100,
    })
  }, [mode, ready])

  // ── quake shake ────────────────────────────────────────────────────
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    if (state.quakes.length > prevQuakeCount.current) {
      prevQuakeCount.current = state.quakes.length
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        host.classList.remove('shake')
        void host.offsetWidth
        host.classList.add('shake')
        const t = window.setTimeout(() => host.classList.remove('shake'), 700)
        return () => window.clearTimeout(t)
      }
    }
    prevQuakeCount.current = state.quakes.length
  }, [state.quakes.length])

  // ── ease to selection when it is off-screen ────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selection) return
    let target: LngLat | undefined
    if (selection.kind === 'facility') target = FACILITIES.find((f) => f.id === selection.id)?.lngLat
    else target = engine.state.incidents.find((i) => i.id === selection.id)?.lngLat
    if (!target) return
    const pad = 0.12
    const b = map.getBounds()
    const w = (b.getEast() - b.getWest()) * pad
    const h = (b.getNorth() - b.getSouth()) * pad
    const inside =
      target[0] > b.getWest() + w &&
      target[0] < b.getEast() - w &&
      target[1] > b.getSouth() + h &&
      target[1] < b.getNorth() - h
    if (!inside) {
      map.easeTo({ center: target, zoom: Math.max(map.getZoom(), 10.6), duration: 850 })
    }
  }, [selection])

  return (
    <div ref={hostRef} className="map-host">
      <div ref={tooltipRef} className="map-tooltip" />
    </div>
  )
}
