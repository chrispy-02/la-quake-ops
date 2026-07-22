import { useMemo, useState } from 'react'
import { NEIGHBORHOODS, isInLACounty, nearestFault, nearestNeighborhood } from '../data/baseData'
import { FACILITIES } from '../sim/facilities'
import { haversineKm } from '../sim/geo'
import type { ScenarioParams } from '../sim/scenario'
import type { LngLat } from '../sim/types'
import { IconCrosshair, IconDatabase, IconPin, IconSearch, IconZap } from './icons'

interface Props {
  params: ScenarioParams
  onChange: (p: ScenarioParams) => void
  onGenerate: () => void
  onRestoreDefault: () => void
  onShowProvenance: () => void
}

interface Preset {
  key: string
  label: string
  epicenter: LngLat
  magnitude: number
  depthKm: number
}
const PRESETS: Preset[] = [
  { key: 'dtla', label: 'DTLA', epicenter: [-118.2437, 34.0522], magnitude: 6.8, depthKm: 10 },
  { key: 'santamonica', label: 'Santa Monica', epicenter: [-118.4912, 34.0195], magnitude: 6.6, depthKm: 9 },
  { key: 'longbeach', label: 'Long Beach', epicenter: [-118.1937, 33.7701], magnitude: 6.7, depthKm: 12 },
  { key: 'northridge', label: 'Northridge', epicenter: [-118.5301, 34.2381], magnitude: 6.7, depthKm: 11 },
  { key: 'pasadena', label: 'Pasadena', epicenter: [-118.1445, 34.1478], magnitude: 6.4, depthKm: 8 },
]

/** Local, key-free place index: real neighborhoods + hospitals. */
const PLACE_INDEX: { name: string; lngLat: LngLat }[] = [
  ...NEIGHBORHOODS.map((n) => ({ name: n.name.replace(/^City of /, '').replace(/^Los Angeles - /, ''), lngLat: n.lngLat })),
  ...FACILITIES.filter((f) => f.kind === 'hospital').map((f) => ({ name: f.name, lngLat: f.lngLat })),
]

export function ScenarioSetup({ params, onChange, onGenerate, onRestoreDefault, onShowProvenance }: Props) {
  const [query, setQuery] = useState('')
  const [latText, setLatText] = useState('')
  const [lngText, setLngText] = useState('')

  const inCounty = useMemo(() => isInLACounty(params.epicenter), [params.epicenter])
  const hood = useMemo(
    () => nearestNeighborhood(params.epicenter).replace(/^Los Angeles - /, ''),
    [params.epicenter],
  )
  const fault = useMemo(() => nearestFault(params.epicenter), [params.epicenter])
  const nearestTrauma = useMemo(
    () =>
      FACILITIES.filter((f) => f.kind === 'hospital' && f.traumaLevel)
        .map((f) => ({ f, km: haversineKm(params.epicenter, f.lngLat) }))
        .sort((a, b) => a.km - b.km)
        .slice(0, 4),
    [params.epicenter],
  )

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return PLACE_INDEX.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6)
  }, [query])

  const setEpicenter = (lngLat: LngLat) => onChange({ ...params, epicenter: lngLat })

  const applyLatLng = () => {
    const lat = parseFloat(latText)
    const lng = parseFloat(lngText)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setEpicenter([+lng.toFixed(4), +lat.toFixed(4)])
    }
  }

  return (
    <section className="panel setup" aria-label="Earthquake setup">
      <div className="panel-head">
        <span className="eyebrow"><IconZap size={12} /> Earthquake setup</span>
        <span className="sim-tag">SIMULATED CRISIS</span>
      </div>

      <p className="setup-hint">
        Place an epicenter anywhere in LA County — click the map, drag the ✦ marker,
        search, enter coordinates, or pick a preset. Base geography is real; the
        quake and its effects are simulated.
      </p>

      <div className="preset-row">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            className="chip-btn"
            onClick={() => onChange({ epicenter: p.epicenter, magnitude: p.magnitude, depthKm: p.depthKm })}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="setup-search">
        <IconSearch size={13} />
        <input
          type="text"
          value={query}
          placeholder="Search a place or hospital…"
          onChange={(e) => setQuery(e.target.value)}
        />
        {results.length > 0 && (
          <ul className="search-results">
            {results.map((r) => (
              <li key={`${r.name}-${r.lngLat[0]}`}>
                <button
                  onClick={() => {
                    setEpicenter(r.lngLat)
                    setQuery('')
                  }}
                >
                  <IconPin size={11} /> {r.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="latlng-row">
        <label>
          <span>Lat</span>
          <input
            type="number"
            step="0.0001"
            value={latText}
            placeholder={params.epicenter[1].toFixed(4)}
            onChange={(e) => setLatText(e.target.value)}
          />
        </label>
        <label>
          <span>Lng</span>
          <input
            type="number"
            step="0.0001"
            value={lngText}
            placeholder={params.epicenter[0].toFixed(4)}
            onChange={(e) => setLngText(e.target.value)}
          />
        </label>
        <button className="btn tiny" onClick={applyLatLng}>Set</button>
      </div>

      <div className="slider-row">
        <label>
          <span>Magnitude <b>M{params.magnitude.toFixed(1)}</b></span>
          <input
            type="range"
            min={5}
            max={7.6}
            step={0.1}
            value={params.magnitude}
            onChange={(e) => onChange({ ...params, magnitude: +parseFloat(e.target.value).toFixed(1) })}
          />
        </label>
        <label>
          <span>Depth <b>{Math.round(params.depthKm)} km</b></span>
          <input
            type="range"
            min={4}
            max={20}
            step={1}
            value={params.depthKm}
            onChange={(e) => onChange({ ...params, depthKm: parseInt(e.target.value, 10) })}
          />
        </label>
      </div>

      <dl className="setup-readout">
        <dt>Coordinates</dt>
        <dd className="mono">{params.epicenter[1].toFixed(4)}, {params.epicenter[0].toFixed(4)}</dd>
        <dt>In LA County</dt>
        <dd>{inCounty ? <span className="ok-pill"><IconCrosshair size={10} /> Yes</span> : <span className="bad-pill">Outside county</span>}</dd>
        <dt>Neighborhood</dt>
        <dd>{hood}</dd>
        <dt>Nearest fault</dt>
        <dd>{fault ? `${fault.name} (${fault.distanceKm.toFixed(1)} km)` : '—'}</dd>
      </dl>

      <div className="hosp-dist">
        <span className="eyebrow">Nearest trauma centers</span>
        <ul>
          {nearestTrauma.map(({ f, km }) => (
            <li key={f.id}>
              <span className="hd-name">{f.short}</span>
              <span className="hd-lvl">L{f.traumaLevel === 'ped' ? 'P' : f.traumaLevel}</span>
              <span className="hd-km mono">{km.toFixed(1)} km</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="setup-actions">
        <button className="btn primary" onClick={onGenerate} disabled={!inCounty}>
          <IconZap size={13} /> Generate scenario
        </button>
        <button className="btn" onClick={onRestoreDefault}>Restore default</button>
      </div>
      <button className="link-btn" onClick={onShowProvenance}>
        <IconDatabase size={12} /> Base data &amp; sources
      </button>
    </section>
  )
}
