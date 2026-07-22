import type { Map as MlMap } from 'maplibre-gl'
import type { RefObject } from 'react'
import { COUNTY_BBOX } from '../data/baseData'
import type { MapMode } from '../map/MapView'
import type { LngLat } from '../sim/types'
import {
  IconCompass,
  IconCrosshair,
  IconCube,
  IconGlobe,
  IconMinus,
  IconPlus,
  IconRotateCcw,
  IconRotateCw,
  IconSquare,
  IconTilt,
} from './icons'

interface Props {
  mapRef: RefObject<MlMap | null>
  mode: MapMode
  onModeChange: (m: MapMode) => void
  /** Epicenter to focus (pending epicenter while idle, or the mainshock). */
  focusTarget: LngLat | null
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export function MapControls({ mapRef, mode, onModeChange, focusTarget }: Props) {
  const map = () => mapRef.current

  const rotate = (delta: number) => map()?.easeTo({ bearing: (map()!.getBearing() + delta), duration: 350 })
  const tilt = (delta: number) =>
    map()?.easeTo({ pitch: clamp(map()!.getPitch() + delta, 0, 68), duration: 350 })
  const zoom = (delta: number) => map()?.easeTo({ zoom: map()!.getZoom() + delta, duration: 300 })
  const resetNorth = () => map()?.easeTo({ bearing: 0, duration: 400 })

  const focusEpicenter = () => {
    const m = map()
    if (!m || !focusTarget) return
    m.easeTo({
      center: focusTarget,
      zoom: Math.max(13.6, m.getZoom()),
      pitch: mode === '3d' ? 56 : 0,
      duration: 900,
    })
  }

  const countyOverview = () => {
    const m = map()
    if (!m) return
    onModeChange('2d')
    m.fitBounds(
      [
        [COUNTY_BBOX.minLng, COUNTY_BBOX.minLat],
        [COUNTY_BBOX.maxLng, COUNTY_BBOX.maxLat],
      ],
      { padding: 60, pitch: 0, bearing: 0, duration: 900, maxZoom: 11 },
    )
  }

  return (
    <div className="map-controls" role="group" aria-label="Map view controls">
      <div className="mode-switch" role="group" aria-label="2D or 3D view">
        <button
          className={mode === '2d' ? 'on' : ''}
          onClick={() => onModeChange('2d')}
          aria-pressed={mode === '2d'}
          title="Top-down county operations view"
        >
          <IconSquare size={13} /> 2D
        </button>
        <button
          className={mode === '3d' ? 'on' : ''}
          onClick={() => onModeChange('3d')}
          aria-pressed={mode === '3d'}
          title="Building-level 3D view"
        >
          <IconCube size={13} /> 3D
        </button>
      </div>

      <div className="cam-cluster">
        <button onClick={focusEpicenter} title="Focus epicenter" aria-label="Focus epicenter" disabled={!focusTarget}>
          <IconCrosshair size={15} />
        </button>
        <button onClick={countyOverview} title="County overview" aria-label="County overview">
          <IconGlobe size={15} />
        </button>
        <div className="cam-row">
          <button onClick={() => rotate(-30)} title="Rotate left" aria-label="Rotate left">
            <IconRotateCcw size={14} />
          </button>
          <button onClick={() => rotate(30)} title="Rotate right" aria-label="Rotate right">
            <IconRotateCw size={14} />
          </button>
        </div>
        <div className="cam-row">
          <button onClick={() => tilt(12)} title="Tilt up" aria-label="Tilt up">
            <IconTilt size={14} />
          </button>
          <button onClick={resetNorth} title="Reset north" aria-label="Reset north">
            <IconCompass size={15} />
          </button>
        </div>
        <div className="cam-row">
          <button onClick={() => zoom(1)} title="Zoom in" aria-label="Zoom in">
            <IconPlus size={14} />
          </button>
          <button onClick={() => zoom(-1)} title="Zoom out" aria-label="Zoom out">
            <IconMinus size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
