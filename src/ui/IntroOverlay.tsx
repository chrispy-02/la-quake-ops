import type { SimPhase } from '../sim/types'
import { IconMedical, IconPlay, IconRoad, IconRoute, IconZap } from './icons'

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
        <h1>M6.9 on the Puente Hills fault</h1>
        <p className="lede">
          A simulated major earthquake strikes beneath southeast Los Angeles.
          Watch the region's hospital system absorb mass-casualty incidents as
          buildings fail, freeways close, emergency departments overload — and
          every patient-routing decision explains itself in plain language.
        </p>
        <div className="intro-points">
          <div className="intro-point">
            <IconRoute size={14} />
            <span><b>Explainable routing.</b> Each transport shows why its hospital was chosen — and reroutes live when conditions change.</span>
          </div>
          <div className="intro-point">
            <IconMedical size={14} />
            <span><b>Hospital status board.</b> Occupancy, damage, diversion and outages update across 24 hospitals and 5 clinics.</span>
          </div>
          <div className="intro-point">
            <IconRoad size={14} />
            <span><b>Failing infrastructure.</b> Freeway closures carve visible detours through the basin's road network.</span>
          </div>
          <div className="intro-point">
            <IconZap size={14} />
            <span><b>Aftershocks.</b> A scripted M5.4 hits Pasadena at T+30 — or trigger your own from the top bar.</span>
          </div>
        </div>
        <div className="intro-disclaimer">
          <b>SIMULATED DATA.</b> This is a concept prototype. All patient,
          hospital-condition, capacity and road data are fictional; real
          facility names appear for geographic context only. Not clinically
          validated, not affiliated with LA County or any agency, and never a
          source of real emergency guidance.
        </div>
        <div className="intro-actions">
          {phase === 'idle' ? (
            <>
              <button className="btn primary" onClick={onStart}>
                <IconPlay size={13} /> Start scenario
              </button>
              <button className="btn" onClick={onClose}>
                Explore the map first
              </button>
            </>
          ) : (
            <button className="btn primary" onClick={onClose}>
              Back to the map
            </button>
          )}
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
