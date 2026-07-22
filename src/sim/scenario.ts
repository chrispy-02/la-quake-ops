import type {
  EventSeverity,
  FacilityState,
  IncidentSpec,
  LngLat,
  Quake,
  RoadClosure,
} from './types'

export type FeedCategory = 'seismic' | 'hospital' | 'road' | 'incident' | 'routing' | 'system'

/** Parameters that fully determine a (deterministic) generated scenario. */
export interface ScenarioParams {
  epicenter: LngLat
  magnitude: number
  depthKm: number
}

/**
 * Default scenario: a M6.9 rupture on the Puente Hills thrust beneath
 * Vernon / SE Los Angeles — the original demo, now reproduced by the generator.
 */
export const DEFAULT_PARAMS: ScenarioParams = {
  epicenter: [-118.23, 34.005],
  magnitude: 6.9,
  depthKm: 11,
}

export type ScenarioAction =
  | { type: 'quake'; quake: Quake }
  | { type: 'incident'; spec: IncidentSpec }
  | {
      type: 'facility'
      facilityId: string
      patch: Partial<FacilityState>
      feedMsg?: string
      severity?: EventSeverity
    }
  | { type: 'closure'; closure: Omit<RoadClosure, 'tClosed'> }
  | { type: 'reopen'; closureId: string; feedMsg?: string }
  | { type: 'feed'; severity: EventSeverity; category: FeedCategory; msg: string }
  | { type: 'banner'; severity: EventSeverity; title: string; sub?: string }
  | { type: 'stabilize' }

export interface ScenarioEvent {
  t: number
  action: ScenarioAction
}

export interface Scenario {
  name: string
  description: string
  durationMin: number
  events: ScenarioEvent[]
}

export interface AftershockPresetResult {
  quake: Quake
  events: ScenarioAction[]
}
