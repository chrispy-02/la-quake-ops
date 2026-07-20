import { FACILITIES, availableBeds, facilityStatus, occupancyPct } from '../sim/facilities'
import type { Facility, FacilityStatus } from '../sim/types'
import { useSim, type Selection } from '../store'
import { STATUS_META } from './format'
import { IconAlert, IconDivert, IconX } from './icons'

interface Props {
  selection: Selection | null
  onSelect: (sel: Selection) => void
}

function StatusGlyph({ status }: { status: FacilityStatus }) {
  const color = STATUS_META[status].color
  switch (status) {
    case 'offline':
      return <span className="hglyph" style={{ color }} title="Offline"><IconX size={10} /></span>
    case 'inaccessible':
      return <span className="hglyph" style={{ color }} title="Inaccessible"><IconX size={10} /></span>
    case 'diverting':
      return <span className="hglyph" style={{ color }} title="Diverting"><IconDivert size={10} /></span>
    case 'partially-damaged':
      return <span className="hglyph" style={{ color }} title="Partially damaged"><IconAlert size={10} /></span>
    default:
      return null
  }
}

function Row({ f, selection, onSelect }: { f: Facility } & Props) {
  const state = useSim()
  const s = state.facilityStates[f.id]
  const status = facilityStatus(f, s)
  const meta = STATUS_META[status]
  const pct = occupancyPct(f, s)
  const isSel = selection?.kind === 'facility' && selection.id === f.id
  return (
    <button className={`hrow${isSel ? ' sel' : ''}`} onClick={() => onSelect({ kind: 'facility', id: f.id })}>
      <span className="sdot" style={{ background: meta.color }} />
      <span className="hname">
        {f.short}
        <StatusGlyph status={status} />
      </span>
      <span className="occ-bar">
        <i style={{ width: `${Math.min(100, pct)}%`, background: meta.color }} />
      </span>
      <span className="hpct" style={pct > 100 ? { color: 'var(--offline)', fontWeight: 700 } : undefined}>
        {pct}%
      </span>
      <span className="hbeds">{availableBeds(f, s)} bd</span>
    </button>
  )
}

export function HospitalBoard({ selection, onSelect }: Props) {
  const state = useSim()
  const hospitals = FACILITIES.filter((f) => f.kind === 'hospital')
  const clinics = FACILITIES.filter((f) => f.kind === 'clinic')

  const rank = (f: Facility) => STATUS_META[facilityStatus(f, state.facilityStates[f.id])].rank
  const occ = (f: Facility) => occupancyPct(f, state.facilityStates[f.id])
  const sorted = [...hospitals].sort(
    (a, b) => rank(a) - rank(b) || occ(b) - occ(a) || a.short.localeCompare(b.short),
  )

  let ok = 0
  let imp = 0
  let div = 0
  let off = 0
  for (const f of hospitals) {
    const st = facilityStatus(f, state.facilityStates[f.id])
    if (st === 'offline' || st === 'inaccessible') off += 1
    else if (st === 'diverting') div += 1
    else if (st === 'partially-damaged') imp += 1
    else ok += 1
  }

  return (
    <section className="panel" style={{ flex: 1 }} aria-label="Hospital status board">
      <div className="panel-head">
        <span className="eyebrow">Hospital status board</span>
        <span className="board-counts">
          <span className="count-chip"><i style={{ background: 'var(--ok)' }} />{ok}</span>
          <span className="count-chip"><i style={{ background: STATUS_META['partially-damaged'].color }} />{imp}</span>
          <span className="count-chip"><i style={{ background: 'var(--divert)' }} />{div}</span>
          <span className="count-chip"><i style={{ background: 'var(--offline)' }} />{off}</span>
        </span>
      </div>
      <div className="panel-body">
        {sorted.map((f) => (
          <Row key={f.id} f={f} selection={selection} onSelect={onSelect} />
        ))}
        <div className="board-section">
          <span className="eyebrow">Urgent-care clinics · fictional</span>
        </div>
        {clinics.map((f) => (
          <Row key={f.id} f={f} selection={selection} onSelect={onSelect} />
        ))}
      </div>
    </section>
  )
}
