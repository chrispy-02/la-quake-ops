import { useEffect, useRef, useState } from 'react'
import { MapView, type LayersState } from './map/MapView'
import { engine, startSimLoop, useSim, type Selection } from './store'
import { AlertBanner } from './ui/AlertBanner'
import { DetailPanel } from './ui/DetailPanel'
import { EventFeed } from './ui/EventFeed'
import { HospitalBoard } from './ui/HospitalBoard'
import { IconAlert, IconChevronLeft, IconChevronRight } from './ui/icons'
import { IntroOverlay } from './ui/IntroOverlay'
import { LayerToggles } from './ui/LayerToggles'
import { Legend } from './ui/Legend'
import { MetricsPanel } from './ui/MetricsPanel'
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
    buildings: true,
  })
  const [showIntro, setShowIntro] = useState(true)
  const [leftOpen, setLeftOpen] = useState(() => window.innerWidth > 980)
  const [rightOpen, setRightOpen] = useState(() => window.innerWidth > 980)

  useEffect(() => startSimLoop(), [])

  // Auto-dismiss the intro when the scenario starts from anywhere (e.g. top bar).
  const prevPhase = useRef(state.phase)
  useEffect(() => {
    if (prevPhase.current === 'idle' && state.phase !== 'idle') setShowIntro(false)
    prevPhase.current = state.phase
  }, [state.phase])

  return (
    <div className="app">
      <MapView selection={selection} onSelect={setSelection} layers={layers} />

      <TopBar />
      <AlertBanner />

      <aside className={`rail left${leftOpen ? '' : ' closed'}`}>
        <MetricsPanel />
        <HospitalBoard selection={selection} onSelect={setSelection} />
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

      <button className="disclaimer-pill" onClick={() => setShowIntro(true)}>
        <IconAlert size={11} />
        SIMULATED DATA · PROTOTYPE — NOT FOR EMERGENCY USE
      </button>

      {showIntro && (
        <IntroOverlay
          phase={state.phase}
          onStart={() => {
            engine.start()
            setShowIntro(false)
          }}
          onClose={() => setShowIntro(false)}
        />
      )}
    </div>
  )
}
