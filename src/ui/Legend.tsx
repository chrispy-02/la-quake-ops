import { useState } from 'react'
import { STATUS_META } from './format'
import { IconChevronDown } from './icons'

export function Legend() {
  const [tucked, setTucked] = useState(() => window.innerWidth < 1100)
  return (
    <div className={`legend panel${tucked ? ' tucked' : ''}`}>
      <div
        className="panel-head"
        onClick={() => setTucked((t) => !t)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setTucked((t) => !t)}
      >
        <span className="eyebrow">Legend</span>
        <span style={{ color: 'var(--ink-3)', transform: tucked ? 'rotate(180deg)' : undefined, display: 'inline-flex' }}>
          <IconChevronDown size={12} />
        </span>
      </div>
      <div className="legend-body">
        <div className="legend-sec">
          <div className="eyebrow">Facilities</div>
          {(
            ['operational', 'high-occupancy', 'near-capacity', 'diverting', 'partially-damaged', 'inaccessible', 'offline'] as const
          ).map((s) => (
            <div key={s} className="lg-row">
              <span className="lg-dot" style={{ borderColor: STATUS_META[s].color }} />
              {STATUS_META[s].label}
            </div>
          ))}
        </div>
        <div className="legend-sec">
          <div className="eyebrow">Incidents</div>
          <div className="lg-row"><span className="lg-diamond" style={{ borderColor: '#ef4444' }} />Critical patients on scene</div>
          <div className="lg-row"><span className="lg-diamond" style={{ borderColor: '#fb923c' }} />Serious / delayed</div>
          <div className="lg-row"><span className="lg-diamond" style={{ borderColor: '#2dd4a7' }} />Minor injuries</div>
          <div className="lg-row"><span className="lg-diamond" style={{ borderColor: '#2dd4a7', opacity: 0.45 }} />All patients delivered</div>
        </div>
        <div className="legend-sec">
          <div className="eyebrow">Movement & roads</div>
          <div className="lg-row"><span className="lg-line" style={{ borderColor: 'var(--ems)' }} />Active transport route</div>
          <div className="lg-row">
            <span style={{ width: 16, display: 'inline-flex', justifyContent: 'center' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#c3f2ff', border: '2px solid #06232f', boxShadow: '0 0 6px rgba(56,214,245,.8)' }} />
            </span>
            Ambulance unit
          </div>
          <div className="lg-row"><span className="lg-line" style={{ borderColor: '#ff5252' }} />Closed road segment</div>
          <div className="lg-row"><span className="lg-line" style={{ borderColor: 'var(--ok)', opacity: 0.5 }} />Reopened</div>
        </div>
        <div className="legend-sec">
          <div className="eyebrow">Shaking intensity (simulated MMI)</div>
          <div className="lg-row"><span className="lg-swatch" style={{ background: 'rgba(217,48,37,.45)' }} />VIII · Severe</div>
          <div className="lg-row"><span className="lg-swatch" style={{ background: 'rgba(240,115,29,.4)' }} />VII · Very strong</div>
          <div className="lg-row"><span className="lg-swatch" style={{ background: 'rgba(245,179,28,.35)' }} />VI · Strong</div>
          <div className="lg-row"><span className="lg-swatch" style={{ background: 'rgba(255,224,138,.3)' }} />V · Moderate</div>
        </div>
        <div style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>
          All conditions, capacities and patients are simulated.
        </div>
      </div>
    </div>
  )
}
