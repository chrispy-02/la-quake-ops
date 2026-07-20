import type { Capability, FacilityStatus, Incident } from '../sim/types'

export function fmtClock(simMin: number): string {
  const total = Math.max(0, Math.floor(simMin * 60))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `T+${pad(h)}:${pad(m)}:${pad(s)}`
}

export function fmtShort(simMin: number): string {
  const total = Math.max(0, Math.floor(simMin * 60))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export interface StatusMeta {
  label: string
  color: string
  /** Marker corner-glyph id; also used in board rows and legend. */
  glyph: 'check' | 'up' | 'gauge' | 'divert' | 'warn' | 'x' | 'block'
  rank: number
}

export const STATUS_META: Record<FacilityStatus, StatusMeta> = {
  offline: { label: 'Offline', color: '#ef4444', glyph: 'x', rank: 0 },
  inaccessible: { label: 'Inaccessible', color: '#94a3b8', glyph: 'block', rank: 1 },
  diverting: { label: 'Diverting', color: '#f87171', glyph: 'divert', rank: 2 },
  'partially-damaged': { label: 'Partially damaged', color: '#c084fc', glyph: 'warn', rank: 3 },
  'near-capacity': { label: 'Near capacity', color: '#fb923c', glyph: 'gauge', rank: 4 },
  'high-occupancy': { label: 'High occupancy', color: '#f5c144', glyph: 'up', rank: 5 },
  operational: { label: 'Operational', color: '#2dd4a7', glyph: 'check', rank: 6 },
}

export type IncidentSeverity = 'critical' | 'serious' | 'minor'

export function incidentSeverity(inc: Incident): IncidentSeverity {
  if (inc.patients.critical > 0) return 'critical'
  if (inc.patients.serious > 0) return 'serious'
  return 'minor'
}

export const SEVERITY_COLOR: Record<IncidentSeverity, string> = {
  critical: '#ef4444',
  serious: '#fb923c',
  minor: '#2dd4a7',
}

export const CAPABILITY_LABEL: Record<Capability, string> = {
  trauma: 'Trauma center',
  general: 'General ED',
  pediatric: 'Pediatric',
  'minor-care': 'Minor care',
}

export const INCIDENT_STATUS_LABEL: Record<Incident['status'], string> = {
  waiting: 'Awaiting routing',
  assigned: 'On scene · routed',
  'in-transit': 'In transit',
  delivered: 'Delivered',
}

export const INCIDENT_STATUS_COLOR: Record<Incident['status'], string> = {
  waiting: '#f5c144',
  assigned: '#38d6f5',
  'in-transit': '#38d6f5',
  delivered: '#2dd4a7',
}

export function damageLabel(d: 'none' | 'minor' | 'moderate' | 'severe'): string {
  return d === 'none' ? 'None reported' : d.charAt(0).toUpperCase() + d.slice(1)
}
