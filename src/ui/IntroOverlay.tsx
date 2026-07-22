import type { SimPhase } from '../sim/types'
import { IconMedical, IconPin, IconPlay, IconRoute, IconZap } from './icons'

interface Props {
  phase: SimPhase
  onStart: () => void
  onClose: () => void
}

export function IntroOverlay({ phase, onStart, onClose }: Props) {
  return (
    <div className="intro-backdrop" onClick={onClose}>
      <div className="intro-card" onClick={(e) => e.stopPropagation()}>
        <span className="eyebrow" style={{ color: 'var(--ems)' }}>
          Tabletop exercise · visual prototype
        </span>
        <h1>Place an earthquake anywhere in LA County</h1>
        <p className="lede">
          Choose an epicenter, magnitude and depth — then watch the region's
          hospital system absorb the simulated shock: mass-casualty incidents
          appear, buildings fail, freeways close, EDs overload, and every
          patient-routing decision explains itself in plain language. Real map,
          hospitals and faults; simulated crisis.
        </p>
        <div className="intro-points">
          <div className="intro-point">
            <IconPin size={14} />
            <span><b>Configurable epicenter.</b> Click the map, drag the marker, search, enter lat/lng, or pick a preset. Impacts regenerate around your choice.</span>
          </div>
          <div className="intro-point">
            <IconRoute size={14} />
            <span><b>Explainable routing.</b> Each transport shows why its hospital was chosen — and reroutes live when conditions change.</span>
          </div>
          <div className="intro-point">
            <IconMedical size={14} />
            <span><b>Real hospital roster.</b> 24 real LA hospitals with licensed beds and trauma designations; ED status is simulated.</span>
          </div>
          <div className="intro-point">
            <IconZap size={14} />
            <span><b>2D / 3D.</b> Switch between a county ops view and a building-level 3D view; trigger deterministic aftershocks.</span>
          </div>
        </div>
        <div className="intro-disclaimer">
          <b>REAL BASE DATA · SIMULATED CRISIS.</b> Map, hospitals, faults,
          neighborhoods, roads and population are real public data; the
          earthquake, damage, ED occupancy, closures and incidents are
          simulated. Licensed beds are not live availability. Not clinically
          validated, not affiliated with LA County or any agency, never a source
          of real emergency guidance.
        </div>
        <div className="intro-actions">
          <button className="btn primary" onClick={phase === 'idle' ? onStart : onClose}>
            <IconPlay size={13} /> {phase === 'idle' ? 'Set up the scenario' : 'Back to the map'}
          </button>
          <span
            className="mono"
            style={{ marginLeft: 'auto', fontSize: 9.5, color: 'var(--ink-3)' }}
          >
            75 sim-min ≈ 2.5 real min at 1×
          </span>
        </div>
      </div>
    </div>
  )
}
