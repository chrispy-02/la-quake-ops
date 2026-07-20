import {
  availableBeds,
  facilityStatus,
  occupancyPct,
  waitEstimate,
} from '../sim/facilities'
import type { Facility, FacilityState, Incident, Quake, RoadClosure } from '../sim/types'
import {
  CAPABILITY_LABEL,
  INCIDENT_STATUS_LABEL,
  SEVERITY_COLOR,
  STATUS_META,
  fmtShort,
  incidentSeverity,
} from '../ui/format'

/** Tiny stroke-icon SVG strings for marker corner glyphs. */
function glyphSvg(glyph: string, size: number): string {
  const paths: Record<string, string> = {
    check: '<polyline points="20 6 9 17 4 12"/>',
    up: '<polyline points="6 15 12 9 18 15"/>',
    gauge: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/>',
    divert: '<polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/>',
    warn: '<path d="M12 3 2 21h20Z"/><line x1="12" y1="10" x2="12" y2="14"/><line x1="12" y1="17.5" x2="12.01" y2="17.5"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    block: '<circle cx="12" cy="12" r="9"/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/>',
    cross: '<path d="M12 5v14M5 12h14"/>',
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[glyph] ?? ''}</svg>`
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function facilityMarkerHtml(f: Facility, s: FacilityState): string {
  const status = facilityStatus(f, s)
  const meta = STATUS_META[status]
  const showGlyph = status !== 'operational' && status !== 'high-occupancy' && status !== 'near-capacity'
  const lvl = f.traumaLevel === 'ped' ? 'P' : f.traumaLevel
  const occ = occupancyPct(f, s)
  return `
    <div class="fmk ${f.kind === 'clinic' ? 'clinic' : ''} ${status === 'offline' ? 'offline-x' : ''}" style="border-color:${meta.color}">
      ${glyphSvg('cross', f.kind === 'clinic' ? 9 : 12)}
      ${lvl ? `<span class="lvl">${lvl}</span>` : ''}
      ${showGlyph ? `<span class="sglyph" style="background:${meta.color}">${glyphSvg(meta.glyph, 8)}</span>` : ''}
    </div>
    ${f.kind === 'hospital' ? `<span class="mk-occ" style="color:${meta.color}">${occ}%</span>` : ''}
  `
}

export function facilityMarkerKey(f: Facility, s: FacilityState, selected: boolean, visible: boolean): string {
  return `${facilityStatus(f, s)}|${occupancyPct(f, s)}|${selected}|${visible}`
}

export function facilityTooltipHtml(f: Facility, s: FacilityState): string {
  const status = facilityStatus(f, s)
  const meta = STATUS_META[status]
  const trauma =
    f.traumaLevel === 'ped' ? 'Pediatric trauma' : f.traumaLevel ? `Level ${f.traumaLevel} trauma` : f.kind === 'clinic' ? 'Urgent care only' : 'No trauma designation'
  return `
    <div class="tt-title">${esc(f.name)}</div>
    <div class="tt-sub">${esc(f.neighborhood)} · ${trauma}${f.fictional ? ' · FICTIONAL' : ''}</div>
    <dl class="tt-grid">
      <dt>Occupancy</dt><dd>${s.occupied}/${f.edCapacity} · ${occupancyPct(f, s)}%</dd>
      <dt>Beds open</dt><dd>${availableBeds(f, s)}</dd>
      <dt>Est. wait</dt><dd>${waitEstimate(f, s)} min</dd>
      <dt>Inbound</dt><dd>${s.incomingPatients} pts</dd>
    </dl>
    <div class="tt-status" style="color:${meta.color}">● ${meta.label}${s.statusReason ? ` — ${esc(s.statusReason)}` : ''}</div>
  `
}

export function incidentMarkerHtml(inc: Incident): string {
  const sev = incidentSeverity(inc)
  const color = SEVERITY_COLOR[sev]
  const done = inc.status === 'delivered'
  const pulse = !done && sev === 'critical'
  const count = inc.patients.critical + inc.patients.serious + inc.patients.minor
  return `
    <div class="imk ${pulse ? 'pulse' : ''} ${done ? 'done' : ''}" style="border-color:${done ? '' : color}">
      <span style="color:${done ? 'var(--ok)' : color}">${done ? glyphSvg('check', 9) : count}</span>
    </div>
  `
}

export function incidentMarkerKey(inc: Incident, selected: boolean, visible: boolean): string {
  return `${inc.status}|${selected}|${visible}`
}

export function incidentTooltipHtml(inc: Incident, simMin: number): string {
  const p = inc.patients
  const dest = inc.assignedFacilityId
  return `
    <div class="tt-title">${esc(inc.name)}</div>
    <div class="tt-sub">${esc(inc.neighborhood)} · reported ${fmtShort(inc.tSpawn)}</div>
    <dl class="tt-grid">
      <dt>Patients</dt><dd>${p.critical + p.serious + p.minor} (${p.critical} crit)</dd>
      <dt>Requires</dt><dd>${CAPABILITY_LABEL[inc.requires]}</dd>
      <dt>Status</dt><dd>${INCIDENT_STATUS_LABEL[inc.status]}</dd>
      ${dest && inc.etaMin !== null && inc.status !== 'delivered' ? `<dt>ETA</dt><dd>${Math.max(0, Math.round(inc.arriveT !== null ? inc.arriveT - simMin : inc.etaMin))} min</dd>` : ''}
    </dl>
  `
}

export function quakeMarkerHtml(q: Quake): string {
  return `
    <div class="qmk ${q.kind === 'aftershock' ? 'aftershock' : ''}">
      <span class="ring"></span><span class="ring2"></span><span class="core"></span>
      <span class="qlabel">M${q.magnitude.toFixed(1)}</span>
    </div>
  `
}

export function closureMarkerHtml(c: RoadClosure): string {
  return `<div class="cmk ${c.reopened ? 'reopened' : ''}">${glyphSvg(c.reopened ? 'check' : 'x', 9)}</div>`
}

export function closureTooltipHtml(c: RoadClosure): string {
  return `
    <div class="tt-title">${esc(c.name)}</div>
    <div class="tt-sub">${c.reopened ? 'REOPENED' : `CLOSED ${fmtShort(c.tClosed)}`}</div>
    <dl class="tt-grid"></dl>
    <div style="font-size:10.5px;color:var(--ink-2)">${esc(c.detail)}</div>
  `
}
