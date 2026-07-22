import type { Map as MlMap } from 'maplibre-gl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MapView, type LayersState, type MapMode } from './map/MapView'
import type { ScenarioParams } from './sim/scenario'
import { engine, startSimLoop, useSim, type Selection } from './store'
import { AlertBanner } from './ui/AlertBanner'
import { DataProvenance } from './ui/DataProvenance'
import { DetailPanel } from './ui/DetailPanel'
import { EventFeed } from './ui/EventFeed'
import { HospitalBoard } from './ui/HospitalBoard'
import { IconAlert, IconChevronLeft, IconChevronRight } from './ui/icons'
import { IntroOverlay } from './ui/IntroOverlay'
import { LayerToggles } from './ui/LayerToggles'
import { Legend } from './ui/Legend'
import { MapControls } from './ui/MapControls'
import { MetricsPanel } from './ui/MetricsPanel'
import { ScenarioSetup } from './ui/ScenarioSetup'
import { TopBar } from './ui/TopBar'

export default function App() {
  const state = useSim()
  const [selection, setSelection] = useState<Selection | null>(null)
  const [layers, setLayers] = useState<LayersState>({
    hospitals: true,
    clinics: true,
    incidents: true,
    routes: true,
    zones: true,
    closures: true,
  })
  const [mode, setMode] = useState<MapMode>('2d')
  const [setup, setSetup] = useState<ScenarioParams>(() => engine.getParams())
  const [showIntro, setShowIntro] = useState(true)
  const [showProvenance, setShowProvenance] = useState(false)
  const [leftOpen, setLeftOpen] = useState(() => window.innerWidth > 980)
  const [rightOpen, setRightOpen] = useState(() => window.innerWidth > 980)
  const mapRef = useRef<MlMap | null>(null)

  useEffect(() => startSimLoop(), [])

  // Auto-dismiss the intro when the scenario starts from anywhere.
  const prevPhase = useRef(state.phase)
  useEffect(() => {
    if (prevPhase.current === 'idle' && state.phase !== 'idle') setShowIntro(false)
    prevPhase.current = state.phase
  }, [state.phase])

  const configuring = state.phase === 'idle'
  const placement = configuring ? setup : null

  const focusTarget = useMemo(() => {
    if (configuring) return setup.epicenter
    return state.quakes.find((q) => q.kind === 'mainshock')?.epicenter ?? setup.epicenter
  }, [configuring, setup.epicenter, state.quakes])

  const generate = () => {
    engine.setScenarioParams(setup)
    engine.start()
    setShowIntro(false)
  }
  const restoreDefault = () => {
    engine.restoreDefault()
    setSetup(engine.getParams())
  }

  return (
    <div className="app">
      <MapView
        selection={selection}
        onSelect={setSelection}
        layers={layers}
        mode={mode}
        placement={placement}
        onPlaceEpicenter={(lngLat) => setSetup((s) => ({ ...s, epicenter: lngLat }))}
        onReady={(m) => {
          mapRef.current = m
        }}
      />

      <TopBar />
      <AlertBanner />
      <MapControls mapRef={mapRef} mode={mode} onModeChange={setMode} focusTarget={focusTarget} />

      <aside className={`rail left${leftOpen ? '' : ' closed'}`}>
        {configuring ? (
          <ScenarioSetup
            params={setup}
            onChange={setSetup}
            onGenerate={generate}
            onRestoreDefault={restoreDefault}
            onShowProvenance={() => setShowProvenance(true)}
          />
        ) : (
          <>
            <MetricsPanel />
            <HospitalBoard selection={selection} onSelect={setSelection} />
          </>
        )}
        <LayerToggles layers={layers} onChange={setLayers} />
      </aside>
      <button
        className={`rail-toggle left${leftOpen ? '' : ' closed'}`}
        onClick={() => setLeftOpen((o) => !o)}
        aria-label={leftOpen ? 'Hide status panels' : 'Show status panels'}
      >
        {leftOpen ? <IconChevronLeft size={13} /> : <IconChevronRight size={13} />}
      </button>

      <aside className={`rail right${rightOpen ? '' : ' closed'}`}>
        <EventFeed />
        {selection && <DetailPanel selection={selection} onSelect={setSelection} />}
      </aside>
      <button
        className={`rail-toggle right${rightOpen ? '' : ' closed'}`}
        onClick={() => setRightOpen((o) => !o)}
        aria-label={rightOpen ? 'Hide event feed' : 'Show event feed'}
      >
        {rightOpen ? <IconChevronRight size={13} /> : <IconChevronLeft size={13} />}
      </button>

      <Legend />

      <button className="disclaimer-pill" onClick={() => setShowProvenance(true)}>
        <IconAlert size={11} />
        REAL BASE DATA · SIMULATED CRISIS — NOT FOR EMERGENCY USE
      </button>

      {showIntro && (
        <IntroOverlay
          phase={state.phase}
          onStart={() => setShowIntro(false)}
          onClose={() => setShowIntro(false)}
        />
      )}
      {showProvenance && <DataProvenance onClose={() => setShowProvenance(false)} />}
    </div>
  )
}
