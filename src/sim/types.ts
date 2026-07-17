/** [longitude, latitude] — GeoJSON order, matching MapLibre. */
export type LngLat = [number, number]

export interface TriageCounts {
  critical: number
  serious: number
  minor: number
}

export type Capability = 'trauma' | 'general' | 'pediatric' | 'minor-care'

/** 'ped' = pediatric trauma center. null = ED without trauma designation. */
export type TraumaLevel = 'I' | 'II' | 'ped' | null

export type DamageLevel = 'none' | 'minor' | 'moderate' | 'severe'

export type FacilityStatus =
  | 'operational'
  | 'high-occupancy'
  | 'near-capacity'
  | 'diverting'
  | 'partially-damaged'
  | 'inaccessible'
  | 'offline'

export interface Facility {
  id: string
  name: string
  /** Short label for map markers. */
  short: string
  kind: 'hospital' | 'clinic'
  lngLat: LngLat
  neighborhood: string
  traumaLevel: TraumaLevel
  /** ED surge capacity in beds (simulated). */
  edCapacity: number
  /** Beds occupied at T0 (simulated). */
  baselineOccupied: number
  helipad?: boolean
  /** Fictional facility (clinics); real names are used for hospitals with simulated conditions. */
  fictional?: boolean
}

export interface FacilityState {
  occupied: number
  /** Patients currently en route to this facility. */
  incomingPatients: number
  damage: DamageLevel
  accessible: boolean
  /** Diversion declared by scenario event (in addition to occupancy-driven diversion). */
  divertingManual: boolean
  offline: boolean
  /** Human-readable reason for closure/diversion/damage shown in UI. */
  statusReason: string | null
  /** Walk-in arrivals per sim-minute from neighborhood surge (deterministic). */
  walkInRate: number
  /** Fractional walk-in accumulator. */
  walkInAcc: number
}

export type IncidentStatus = 'waiting' | 'assigned' | 'in-transit' | 'delivered'

export interface IncidentSpec {
  id: string
  name: string
  icon: string
  lngLat: LngLat
  neighborhood: string
  patients: TriageCounts
  requires: Capability
  /** Minutes on scene before transport can depart (triage/extrication). */
  triageMin: number
}

export interface Incident extends IncidentSpec {
  tSpawn: number
  status: IncidentStatus
  assignedFacilityId: string | null
  explanation: string
  rerouteCount: number
  etaMin: number | null
  departT: number | null
  arriveT: number | null
  routeCoords: LngLat[] | null
  routeEdgeIds: string[] | null
  viaNames: string[]
  log: { t: number; msg: string }[]
}

export type ZoneKind = 'severe' | 'strong' | 'moderate' | 'light'

export interface ShakeZone {
  id: string
  kind: ZoneKind
  /** e.g. "MMI VIII+ — Severe" */
  label: string
  center: LngLat
  polygon: LngLat[]
}

export interface RoadClosure {
  id: string
  edgeIds: string[]
  name: string
  detail: string
  tClosed: number
  reopened?: boolean
}

export interface Quake {
  id: string
  name: string
  magnitude: number
  epicenter: LngLat
  depthKm: number
  t: number
  kind: 'mainshock' | 'aftershock'
}

export type EventSeverity = 'info' | 'success' | 'warning' | 'critical'

export interface FeedEvent {
  id: number
  t: number
  severity: EventSeverity
  category:
    | 'seismic'
    | 'hospital'
    | 'road'
    | 'incident'
    | 'routing'
    | 'system'
  msg: string
}

export interface Banner {
  id: number
  severity: EventSeverity
  title: string
  sub?: string
}

export interface Metrics {
  totalPatients: number
  patientsWaiting: number
  patientsAssigned: number
  patientsInTransit: number
  patientsDelivered: number
  criticalWaiting: number
  hospitalsOperational: number
  hospitalsImpaired: number
  hospitalsDiverting: number
  hospitalsOffline: number
  bedsAvailable: number
  reroutes: number
  activeClosures: number
}

export type SimPhase = 'idle' | 'running' | 'paused' | 'complete'

export interface SimState {
  phase: SimPhase
  simMin: number
  speed: number
  stabilizing: boolean
  quakes: Quake[]
  zones: ShakeZone[]
  facilityStates: Record<string, FacilityState>
  incidents: Incident[]
  closures: RoadClosure[]
  feed: FeedEvent[]
  banner: Banner | null
  metrics: Metrics
  rerouteTotal: number
  manualAftershocks: number
  /** Monotonic version for change detection. */
  version: number
}
