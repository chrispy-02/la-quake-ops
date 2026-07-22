import { FACILITY_BY_ID, availableBeds, facilityStatus, occupancyPct, waitEstimate } from '../sim/facilities'
import type { Facility, Incident } from '../sim/types'
import { useSim, type Selection } from '../store'
import {
  CAPABILITY_LABEL,
  INCIDENT_STATUS_COLOR,
  INCIDENT_STATUS_LABEL,
  STATUS_META,
  damageLabel,
  fmtShort,
} from './format'
import { IconCheck, IconRadio, IconRoute, IconX, IconZap } from './icons'

interface Props {
  selection: Selection
  onSelect: (sel: Selection | null) => void
}

function pillStyle(color: string) {
  return { color, borderColor: `${color}66`, background: `${color}14` }
}

function FacilityDetail({ f, onSelect }: { f: Facility; onSelect: Props['onSelect'] }) {
  const state = useSim()
  const s = state.facilityStates[f.id]
  const status = facilityStatus(f, s)
  const meta = STATUS_META[status]
  const pct = occupancyPct(f, s)
  const inbound = state.incidents.filter(
    (i) => i.assignedFacilityId === f.id && i.status !== 'delivered',
  )
  const trauma =
    f.traumaLevel === 'ped'
      ? 'PEDIATRIC TRAUMA'
      : f.traumaLevel
        ? `LEVEL ${f.traumaLevel} TRAUMA`
        : null
  const traumaFull =
    [
      f.traumaAdult ? `Adult Level ${f.traumaAdult}` : null,
      f.traumaPeds ? `Peds Level ${f.traumaPeds}` : null,
    ]
      .filter(Boolean)
      .join(' · ') || 'None designated'
  const erLabel =
    f.erLevel === 'comprehensive' ? 'Comprehensive' : f.erLevel === 'basic' ? 'Basic' : f.erLevel === 'standby' ? 'Standby' : '—'
  return (
    <>
      <div className="d-title">{f.name}</div>
      <div className="d-sub">
        {f.neighborhood} · {f.kind === 'clinic' ? 'Urgent-care clinic' : 'Hospital ED'}
        {f.fictional ? ' · fictional facility' : ''}
      </div>
      <div className="d-badges">
        <span className="status-pill" style={pillStyle(meta.color)}>● {meta.label}</span>
        {trauma && <span className="badge gold">{trauma}</span>}
        {f.helipad && <span className="badge">HELIPAD</span>}
      </div>

      {!f.fictional && (
        <div className="realbox">
          <div className="databar real"><IconCheck size={10} /> REAL BASE DATA · HCAI + EMSA</div>
          <dl>
            <dt>Licensed beds</dt><dd>{f.licensedBeds}</dd>
            <dt>ED service level</dt><dd>{erLabel}</dd>
            <dt>Trauma center</dt><dd>{traumaFull}</dd>
            <dt>City · OSHPD</dt><dd className="mono">{f.city} · {f.oshpdId}</dd>
          </dl>
        </div>
      )}

      <div className="databar sim"><IconZap size={10} /> SIMULATED · live ED status (not real availability)</div>
      <div className="d-occbar">
        <i style={{ width: `${Math.min(100, pct)}%`, background: meta.color }} />
      </div>
      <div className="d-stats">
        <div className="d-stat"><b style={pct > 100 ? { color: 'var(--offline)' } : undefined}>{pct}%</b><span>Occupancy</span></div>
        <div className="d-stat"><b>{availableBeds(f, s)}</b><span>Beds open</span></div>
        <div className="d-stat"><b>{waitEstimate(f, s)}m</b><span>Est. wait</span></div>
        <div className="d-stat"><b>{s.incomingPatients}</b><span>Inbound pts</span></div>
        <div className="d-stat"><b style={{ fontSize: 11.5 }}>{damageLabel(s.damage)}</b><span>Damage</span></div>
        <div className="d-stat"><b style={{ fontSize: 11.5 }}>{s.accessible ? 'Open' : 'Blocked'}</b><span>Access</span></div>
      </div>
      {s.statusReason && <div className="reasonbox">{s.statusReason}</div>}
      {inbound.length > 0 && (
        <>
          <div className="eyebrow" style={{ margin: '10px 0 4px' }}>Inbound transports</div>
          {inbound.map((i) => (
            <button
              key={i.id}
              className="d-route-row"
              style={{ width: '100%', cursor: 'pointer' }}
              onClick={() => onSelect({ kind: 'incident', id: i.id })}
            >
              <span className="arrow"><IconRoute size={12} /></span>
              <span className="dest">{i.name}</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>
                {i.patients.critical + i.patients.serious + i.patients.minor} pts · {INCIDENT_STATUS_LABEL[i.status]}
              </span>
            </button>
          ))}
        </>
      )}
    </>
  )
}

function IncidentDetail({ inc, onSelect }: { inc: Incident; onSelect: Props['onSelect'] }) {
  const state = useSim()
  const dest = inc.assignedFacilityId ? FACILITY_BY_ID.get(inc.assignedFacilityId) : null
  const statusColor = INCIDENT_STATUS_COLOR[inc.status]
  const onSceneMin =
    inc.status === 'waiting' || inc.status === 'assigned'
      ? Math.max(0, Math.round(state.simMin - inc.tSpawn))
      : null
  const etaRemaining =
    inc.status === 'in-transit' && inc.arriveT !== null
      ? Math.max(0, Math.round(inc.arriveT - state.simMin))
      : null
  return (
    <>
      <div className="d-title">{inc.name}</div>
      <div className="d-sub">{inc.neighborhood} · reported T+{fmtShort(inc.tSpawn)}</div>
      <div className="d-badges">
        <span className="status-pill" style={pillStyle(statusColor)}>● {INCIDENT_STATUS_LABEL[inc.status]}</span>
        <span className="badge">REQ: {CAPABILITY_LABEL[inc.requires].toUpperCase()}</span>
        {onSceneMin !== null && <span className="badge">ON SCENE {onSceneMin} MIN</span>}
        {inc.rerouteCount > 0 && (
          <span className="badge" style={{ color: 'var(--warn)', borderColor: 'rgba(245,193,68,.45)' }}>
            REROUTED ×{inc.rerouteCount}
          </span>
        )}
      </div>
      <div className="triage-tags">
        <div className="ttag red"><b>{inc.patients.critical}</b><span>Immediate</span></div>
        <div className="ttag yellow"><b>{inc.patients.serious}</b><span>Delayed</span></div>
        <div className="ttag green"><b>{inc.patients.minor}</b><span>Minor</span></div>
      </div>
      {dest && (
        <div className="d-route-row">
          <span className="arrow"><IconRoute size={12} /></span>
          <button className="dest" onClick={() => onSelect({ kind: 'facility', id: dest.id })}>
            {dest.name}
          </button>
          <span className="mono" style={{ fontSize: 10, color: 'var(--ink-2)' }}>
            {etaRemaining !== null
              ? `ETA ${etaRemaining} min`
              : inc.status === 'delivered'
                ? 'ARRIVED'
                : inc.etaMin !== null
                  ? `ETA ${inc.etaMin} min`
                  : ''}
          </span>
        </div>
      )}
      {inc.viaNames.length > 0 && inc.status !== 'delivered' && (
        <div style={{ fontSize: 10.5, color: 'var(--ink-3)', margin: '-3px 0 6px 2px' }}>
          via {inc.viaNames.join(' · ')}
        </div>
      )}
      {inc.explanation && (
        <div className="medcontrol">
          <div className="eyebrow"><IconRadio size={11} /> Med control — routing decision</div>
          <p>{inc.explanation}</p>
        </div>
      )}
      <div className="d-log">
        <div className="eyebrow" style={{ marginBottom: 4 }}>Unit log</div>
        {inc.log.map((l, i) => (
          <div key={i} className="logline">
            <span className="lt">{fmtShort(l.t)}</span>
            <span>{l.msg}</span>
          </div>
        ))}
      </div>
    </>
  )
}

export function DetailPanel({ selection, onSelect }: Props) {
  const state = useSim()
  const facility = selection.kind === 'facility' ? FACILITY_BY_ID.get(selection.id) : null
  const incident =
    selection.kind === 'incident' ? state.incidents.find((i) => i.id === selection.id) : null
  if (!facility && !incident) return null
  return (
    <section className="panel detail" aria-label="Selection details">
      <div className="panel-head">
        <span className="eyebrow">{facility ? 'Facility' : 'Incident'} details</span>
        <button className="icon-btn" aria-label="Close details" onClick={() => onSelect(null)}>
          <IconX size={13} />
        </button>
      </div>
      <div className="panel-body">
        {facility ? (
          <FacilityDetail f={facility} onSelect={onSelect} />
        ) : (
          <IncidentDetail inc={incident!} onSelect={onSelect} />
        )}
      </div>
    </section>
  )
}
