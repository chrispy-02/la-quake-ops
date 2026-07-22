import { PROVENANCE, SNAPSHOT_AS_OF } from '../data/provenance'
import { IconCheck, IconDatabase, IconX, IconZap } from './icons'

interface Props {
  onClose: () => void
}

export function DataProvenance({ onClose }: Props) {
  const real = PROVENANCE.filter((p) => p.klass === 'real')
  const sim = PROVENANCE.filter((p) => p.klass === 'simulated')

  return (
    <div className="intro-backdrop" onClick={onClose}>
      <div className="intro-card provenance" onClick={(e) => e.stopPropagation()}>
        <button className="card-close" onClick={onClose} aria-label="Close">
          <IconX size={16} />
        </button>
        <span className="eyebrow" style={{ color: 'var(--ems)' }}>
          <IconDatabase size={13} /> Data provenance
        </span>
        <h1>Real base data vs. simulated crisis</h1>
        <p className="lede">
          The map, hospitals, faults, neighborhoods, roads and population are{' '}
          <b>real public data</b>. The earthquake and everything it causes —
          shaking, damage, ED occupancy, diversion, closures, incidents — are{' '}
          <b>simulated</b>. Snapshots as of <span className="mono">{SNAPSHOT_AS_OF}</span>;
          the demo runs entirely offline from them.
        </p>

        <div className="prov-section">
          <div className="prov-legend real"><IconCheck size={12} /> REAL BASE DATA</div>
          <ul className="prov-list">
            {real.map((p) => (
              <li key={p.id}>
                <div className="prov-label">{p.label}</div>
                <div className="prov-provides">{p.provides}</div>
                <div className="prov-meta">
                  <span className="prov-source">{p.source}</span>
                  <span className="prov-lic mono">{p.license} · retrieved {p.retrieved}</span>
                </div>
                {p.note && <div className="prov-note">{p.note}</div>}
              </li>
            ))}
          </ul>
        </div>

        <div className="prov-section">
          <div className="prov-legend sim"><IconZap size={12} /> SIMULATED CRISIS DATA</div>
          <ul className="prov-list">
            {sim.map((p) => (
              <li key={p.id}>
                <div className="prov-label">{p.label}</div>
                <div className="prov-provides">{p.provides}</div>
                {p.note && <div className="prov-note">{p.note}</div>}
              </li>
            ))}
          </ul>
        </div>

        <div className="intro-disclaimer">
          <b>Licensed beds are not live availability.</b> ED surge capacity and
          occupancy shown in the sim are simulated baselines derived from real
          licensed bed counts — never a source of real hospital status.
        </div>

        <div className="intro-actions">
          <button className="btn primary" onClick={onClose}>Back to the map</button>
        </div>
      </div>
    </div>
  )
}
