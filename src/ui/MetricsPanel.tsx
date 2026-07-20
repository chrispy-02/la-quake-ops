import { useSim } from '../store'

export function MetricsPanel() {
  const { metrics: m } = useSim()
  return (
    <section className="panel" aria-label="Regional metrics">
      <div className="panel-head">
        <span className="eyebrow">Regional status</span>
      </div>
      <div className="tiles">
        <div className="tile">
          <div className="tile-label">Patients</div>
          <div className="tile-value">{m.totalPatients}</div>
          <div className="tile-sub">{m.patientsDelivered} delivered</div>
        </div>
        <div className="tile">
          <div className="tile-label">Waiting on scene</div>
          <div className="tile-value">{m.patientsWaiting}</div>
          <div className="tile-sub">
            {m.criticalWaiting > 0 ? <span className="crit">{m.criticalWaiting} critical</span> : 'no critical'}
          </div>
        </div>
        <div className="tile">
          <div className="tile-label">In transit</div>
          <div className="tile-value" style={{ color: 'var(--ems)' }}>{m.patientsInTransit}</div>
          <div className="tile-sub">{m.patientsAssigned} routed on scene</div>
        </div>
        <div className="tile">
          <div className="tile-label">ED beds open</div>
          <div className="tile-value">{m.bedsAvailable}</div>
          <div className="tile-sub">region-wide</div>
        </div>
        <div className="tile">
          <div className="tile-label">Hospitals OK</div>
          <div className="tile-value" style={{ color: 'var(--ok)' }}>{m.hospitalsOperational}</div>
          <div className="tile-sub">
            {m.hospitalsImpaired} dmg {m.hospitalsDiverting} div {m.hospitalsOffline} off
          </div>
        </div>
        <div className="tile">
          <div className="tile-label">Reroutes</div>
          <div className="tile-value" style={{ color: m.reroutes > 0 ? 'var(--warn)' : undefined }}>
            {m.reroutes}
          </div>
          <div className="tile-sub">routing decisions revised</div>
        </div>
        <div className="tile">
          <div className="tile-label">Road closures</div>
          <div className="tile-value" style={{ color: m.activeClosures > 0 ? 'var(--divert)' : undefined }}>
            {m.activeClosures}
          </div>
          <div className="tile-sub">freeway / arterial</div>
        </div>
        <div className="tile">
          <div className="tile-label">Delivered</div>
          <div className="tile-value" style={{ color: 'var(--ok)' }}>{m.patientsDelivered}</div>
          <div className="tile-sub">of {m.totalPatients} total</div>
        </div>
      </div>
    </section>
  )
}
