import type {
  EventSeverity,
  FacilityState,
  IncidentSpec,
  Quake,
  RoadClosure,
} from './types'

export type FeedCategory = 'seismic' | 'hospital' | 'road' | 'incident' | 'routing' | 'system'

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

const q = (t: number, quake: Quake): ScenarioEvent => ({ t, action: { type: 'quake', quake } })
const inc = (t: number, spec: IncidentSpec): ScenarioEvent => ({
  t,
  action: { type: 'incident', spec },
})
const fac = (
  t: number,
  facilityId: string,
  patch: Partial<FacilityState>,
  feedMsg?: string,
  severity: EventSeverity = 'warning',
): ScenarioEvent => ({ t, action: { type: 'facility', facilityId, patch, feedMsg, severity } })
const feed = (
  t: number,
  severity: EventSeverity,
  category: FeedCategory,
  msg: string,
): ScenarioEvent => ({ t, action: { type: 'feed', severity, category, msg } })
const banner = (t: number, severity: EventSeverity, title: string, sub?: string): ScenarioEvent => ({
  t,
  action: { type: 'banner', severity, title, sub },
})

/**
 * The deterministic demo scenario: a M6.9 rupture on the Puente Hills thrust
 * beneath Vernon / southeast DTLA. All timings are minutes after the mainshock.
 */
export function buildMainScenario(): Scenario {
  const events: ScenarioEvent[] = [
    q(0, {
      id: 'mainshock',
      name: 'Puente Hills thrust — Vernon segment',
      magnitude: 6.9,
      epicenter: [-118.23, 34.005],
      depthKm: 11,
      t: 0,
      kind: 'mainshock',
    }),
    banner(0, 'critical', 'M6.9 EARTHQUAKE — PUENTE HILLS FAULT', 'Epicenter: Vernon / SE Los Angeles · Depth 11 km · SIMULATED'),
    feed(0, 'critical', 'seismic', 'ShakeAlert (simulated): M6.9 earthquake — Puente Hills thrust beneath Vernon. Severe shaking across central LA.'),
    feed(0.3, 'info', 'system', 'County EOC activated — Level 1 (full activation). Regional disaster protocols in effect.'),
    feed(0.8, 'info', 'hospital', 'All hospitals: HICS disaster protocols activated. EDs clearing non-urgent patients.'),
    feed(1.5, 'warning', 'seismic', 'USGS (simulated): 62% chance of M5+ aftershock within 24 hours.'),

    inc(2, {
      id: 'inc-dtla-garage',
      name: 'Parking structure collapse',
      icon: 'collapse',
      lngLat: [-118.2506, 34.0479],
      neighborhood: 'Historic Core, DTLA',
      patients: { critical: 6, serious: 5, minor: 3 },
      requires: 'trauma',
      triageMin: 4,
    }),
    inc(2.5, {
      id: 'inc-boyle-gas',
      name: 'Gas main explosion',
      icon: 'fire',
      lngLat: [-118.2115, 34.0378],
      neighborhood: 'Boyle Heights',
      patients: { critical: 3, serious: 4, minor: 2 },
      requires: 'trauma',
      triageMin: 3,
    }),

    fac(3, 'lacusc', { walkInRate: 0.35 }, 'LAC+USC: self-presenting patients arriving in waves'),
    fac(3, 'california', { walkInRate: 0.3 }),
    fac(3, 'whitemem', { walkInRate: 0.3 }),
    fac(3, 'goodsam', { walkInRate: 0.25 }),

    fac(4, 'whitemem', { damage: 'moderate', statusReason: 'Facade and water damage — 2 ED bays closed' }, 'White Memorial reports moderate structural damage', 'warning'),
    fac(4.5, 'goodsam', { damage: 'minor', statusReason: 'Cosmetic damage only — fully operational' }, 'Good Samaritan: minor damage, remains fully operational', 'info'),

    {
      t: 5,
      action: {
        type: 'closure',
        closure: {
          id: 'cl-i10-lacienega',
          edgeIds: ['i10w:lacienega10-crenshaw10'],
          name: 'I-10 Santa Monica Fwy',
          detail: 'Overpass collapse at La Cienega Blvd — both directions blocked',
        },
      },
    },
    banner(5, 'warning', 'I-10 CLOSED AT LA CIENEGA', 'Overpass collapse — Mid-City segment impassable'),
    {
      t: 5.5,
      action: {
        type: 'closure',
        closure: {
          id: 'cl-i110-viaduct',
          edgeIds: ['i110:i10x110-fourlevel'],
          name: 'I-110 Harbor Fwy',
          detail: 'Buckled upper deck near 9th St — closed for emergency inspection',
        },
      },
    },

    inc(6, {
      id: 'inc-fashion',
      name: 'Garment factory floor collapse',
      icon: 'collapse',
      lngLat: [-118.255, 34.037],
      neighborhood: 'Fashion District, DTLA',
      patients: { critical: 2, serious: 5, minor: 4 },
      requires: 'general',
      triageMin: 5,
    }),
    inc(7, {
      id: 'inc-ktown-fire',
      name: 'Apartment tower fire',
      icon: 'fire',
      lngLat: [-118.301, 34.0577],
      neighborhood: 'Koreatown',
      patients: { critical: 4, serious: 5, minor: 3 },
      requires: 'trauma',
      triageMin: 6,
    }),
    feed(7.5, 'warning', 'road', 'Caltrans (simulated): 40+ miles of freeway under emergency inspection countywide.'),
    inc(8, {
      id: 'inc-hollywood-facade',
      name: 'Facade collapse onto sidewalk',
      icon: 'collapse',
      lngLat: [-118.3287, 34.1016],
      neighborhood: 'Hollywood',
      patients: { critical: 2, serious: 3, minor: 3 },
      requires: 'general',
      triageMin: 4,
    }),
    fac(8.5, 'lacusc', { walkInRate: 0.55 }, 'LAC+USC ED volume climbing sharply — surge beds opening'),
    inc(9, {
      id: 'inc-southla-church',
      name: 'Church roof collapse',
      icon: 'collapse',
      lngLat: [-118.274, 33.9892],
      neighborhood: 'South LA',
      patients: { critical: 3, serious: 4, minor: 3 },
      requires: 'trauma',
      triageMin: 5,
    }),

    fac(10, 'california', { offline: true, damage: 'severe', statusReason: 'Red-tagged — structural failure in ED wing', walkInRate: 0 }, 'California Hospital Medical Center OFFLINE — structural red tag. All patients diverting.', 'critical'),
    banner(10, 'critical', 'HOSPITAL OFFLINE — CALIFORNIA HOSPITAL', 'Structural red tag · inbound patients rerouting'),

    inc(11, {
      id: 'inc-westlake-senior',
      name: 'Senior center structural injuries',
      icon: 'building',
      lngLat: [-118.276, 34.057],
      neighborhood: 'Westlake / MacArthur Park',
      patients: { critical: 2, serious: 4, minor: 3 },
      requires: 'general',
      triageMin: 4,
    }),
    {
      t: 12,
      action: {
        type: 'closure',
        closure: {
          id: 'cl-101-vine',
          edgeIds: ['us101h:western101-cahuenga101'],
          name: 'US-101 Hollywood Fwy',
          detail: 'Multiple jackknifed trucks near Vine St — all lanes blocked',
        },
      },
    },
    inc(12.5, {
      id: 'inc-vernon-industrial',
      name: 'Warehouse rack collapse',
      icon: 'industry',
      lngLat: [-118.23, 34.004],
      neighborhood: 'Vernon',
      patients: { critical: 3, serious: 3, minor: 1 },
      requires: 'trauma',
      triageMin: 6,
    }),
    inc(13, {
      id: 'inc-elysian-school',
      name: 'School gym ceiling failure',
      icon: 'school',
      lngLat: [-118.243, 34.081],
      neighborhood: 'Elysian Valley',
      patients: { critical: 1, serious: 2, minor: 3 },
      requires: 'pediatric',
      triageMin: 3,
    }),
    fac(14, 'lacusc', { divertingManual: true, statusReason: 'ED saturated — regional Level I overload' }, 'LAC+USC declares trauma diversion — ED saturated', 'critical'),

    inc(15, {
      id: 'inc-vannuys-overpass',
      name: 'Overpass pancake collapse',
      icon: 'collapse',
      lngLat: [-118.449, 34.2113],
      neighborhood: 'Van Nuys',
      patients: { critical: 5, serious: 4, minor: 1 },
      requires: 'trauma',
      triageMin: 7,
    }),
    inc(16, {
      id: 'inc-sm-pier',
      name: 'Pier structure failures',
      icon: 'building',
      lngLat: [-118.497, 34.009],
      neighborhood: 'Santa Monica',
      patients: { critical: 1, serious: 3, minor: 3 },
      requires: 'general',
      triageMin: 4,
    }),
    inc(17, {
      id: 'inc-lb-port',
      name: 'Container stack collapse',
      icon: 'industry',
      lngLat: [-118.212, 33.755],
      neighborhood: 'Long Beach Harbor',
      patients: { critical: 2, serious: 4, minor: 2 },
      requires: 'trauma',
      triageMin: 5,
    }),
    fac(18, 'stfrancis', { walkInRate: 0.4 }, 'St. Francis Lynwood: walk-in surge — approaching capacity'),
    inc(19, {
      id: 'inc-watts',
      name: 'Apartment building damage',
      icon: 'building',
      lngLat: [-118.241, 33.943],
      neighborhood: 'Watts',
      patients: { critical: 1, serious: 3, minor: 4 },
      requires: 'general',
      triageMin: 4,
    }),
    inc(20, {
      id: 'inc-highlandpark',
      name: 'Brick storefront collapse',
      icon: 'collapse',
      lngLat: [-118.192, 34.111],
      neighborhood: 'Highland Park',
      patients: { critical: 1, serious: 2, minor: 3 },
      requires: 'general',
      triageMin: 3,
    }),
    inc(21, {
      id: 'inc-culver',
      name: 'Stairwell fall injuries',
      icon: 'building',
      lngLat: [-118.396, 34.023],
      neighborhood: 'Culver City',
      patients: { critical: 0, serious: 2, minor: 3 },
      requires: 'minor-care',
      triageMin: 2,
    }),

    {
      t: 22,
      action: {
        type: 'closure',
        closure: {
          id: 'cl-405-pass',
          edgeIds: ['i405:getty405-seppass405', 'i405:seppass405-mulholland405'],
          name: 'I-405 San Diego Fwy',
          detail: 'Rockslide and retaining-wall failure in Sepulveda Pass',
        },
      },
    },
    banner(22, 'warning', 'I-405 CLOSED — SEPULVEDA PASS', 'Valley ↔ Westside corridor severed'),
    fac(24, 'mlk', { walkInRate: 0.35 }, 'MLK Community ED filling with walk-in patients'),

    q(30, {
      id: 'aftershock-pasadena',
      name: 'Raymond fault — Pasadena',
      magnitude: 5.4,
      epicenter: [-118.135, 34.145],
      depthKm: 8,
      t: 30,
      kind: 'aftershock',
    }),
    banner(30, 'critical', 'M5.4 AFTERSHOCK — PASADENA', 'Raymond fault · new damage reports inbound · SIMULATED'),
    feed(30, 'critical', 'seismic', 'M5.4 aftershock — Raymond fault beneath Pasadena. Strong shaking in San Gabriel Valley.'),
    fac(30.4, 'huntington', { damage: 'moderate', divertingManual: true, statusReason: 'Aftershock damage — ED diversion declared' }, 'Huntington Health diverting after aftershock damage', 'critical'),
    {
      t: 30.7,
      action: {
        type: 'closure',
        closure: {
          id: 'cl-110-arroyo',
          edgeIds: ['sr110:southpas110-pasadena110'],
          name: 'SR-110 Arroyo Seco Pkwy',
          detail: 'Aftershock — historic viaduct closed pending inspection',
        },
      },
    },
    inc(31, {
      id: 'inc-pasadena-oldtown',
      name: 'URM facade collapse',
      icon: 'collapse',
      lngLat: [-118.15, 34.1458],
      neighborhood: 'Old Pasadena',
      patients: { critical: 2, serious: 4, minor: 3 },
      requires: 'trauma',
      triageMin: 4,
    }),
    feed(33, 'info', 'seismic', 'Aftershock rate declining (simulated). Inspection teams re-tasked.'),
    fac(34, 'lacusc', { divertingManual: false, statusReason: null }, 'LAC+USC lifts trauma diversion — surge capacity holding', 'success'),

    { t: 36, action: { type: 'stabilize' } },
    feed(36, 'success', 'system', 'Region entering stabilization — mutual-aid ambulance strike teams arriving.'),
    {
      t: 38,
      action: {
        type: 'reopen',
        closureId: 'cl-i10-lacienega',
        feedMsg: 'I-10 at La Cienega: eastbound lanes reopened to emergency traffic',
      },
    },
    fac(40, 'whitemem', { damage: 'minor', statusReason: 'Temporary ED bays restored' }, 'White Memorial restores partial ED capacity', 'success'),
    fac(42, 'huntington', { divertingManual: false, statusReason: 'Accepting ambulances — damage contained' }, 'Huntington Health accepting ambulances again', 'success'),
    feed(45, 'info', 'system', 'USAR teams (simulated) completing primary search of DTLA collapse sites.'),
  ]

  events.sort((a, b) => a.t - b.t)
  return {
    name: 'Puente Hills M6.9',
    description:
      'Simulated M6.9 earthquake on the Puente Hills thrust beneath Vernon/DTLA, with hospital damage, freeway closures, mass-casualty incidents, a Pasadena aftershock, and gradual stabilization.',
    durationMin: 75,
    events,
  }
}

/** Deterministic manual-aftershock presets, cycled by trigger count (1-based). */
export function aftershockPreset(n: number): AftershockPresetResult {
  const idx = ((n - 1) % 3) + 1
  if (idx === 1) {
    return {
      quake: {
        id: 'manual-sm',
        name: 'Santa Monica Bay',
        magnitude: 5.1,
        epicenter: [-118.55, 33.99],
        depthKm: 10,
        t: 0,
        kind: 'aftershock',
      },
      events: [
        { type: 'banner', severity: 'critical', title: 'M5.1 AFTERSHOCK — SANTA MONICA BAY', sub: 'Westside shaking · SIMULATED' },
        { type: 'feed', severity: 'critical', category: 'seismic', msg: 'M5.1 aftershock offshore Santa Monica Bay. Westside facilities reporting.' },
        {
          type: 'facility',
          facilityId: 'stjohns',
          patch: { damage: 'minor', divertingManual: true, statusReason: 'Aftershock — precautionary ED diversion' },
          feedMsg: "Providence Saint John's diverting after aftershock (precautionary)",
          severity: 'warning',
        },
        {
          type: 'closure',
          closure: {
            id: 'cl-manual-i10-lincoln',
            edgeIds: ['i10w:i10-sm-cloverfield10'],
            name: 'I-10 Santa Monica Fwy',
            detail: 'Pavement buckling near Lincoln Blvd — closed for inspection',
          },
        },
        {
          type: 'incident',
          spec: {
            id: 'inc-venice-boardwalk',
            name: 'Boardwalk structure injuries',
            icon: 'building',
            lngLat: [-118.473, 33.985],
            neighborhood: 'Venice',
            patients: { critical: 0, serious: 2, minor: 4 },
            requires: 'minor-care',
            triageMin: 3,
          },
        },
      ],
    }
  }
  if (idx === 2) {
    return {
      quake: {
        id: 'manual-sylmar',
        name: 'Sylmar segment',
        magnitude: 4.8,
        epicenter: [-118.45, 34.31],
        depthKm: 9,
        t: 0,
        kind: 'aftershock',
      },
      events: [
        { type: 'banner', severity: 'critical', title: 'M4.8 AFTERSHOCK — SYLMAR', sub: 'North Valley shaking · SIMULATED' },
        { type: 'feed', severity: 'critical', category: 'seismic', msg: 'M4.8 aftershock near Sylmar. I-5 corridor under inspection.' },
        {
          type: 'facility',
          facilityId: 'holycross',
          patch: { damage: 'moderate', statusReason: 'Aftershock damage — 1 OR offline, ED capacity reduced' },
          feedMsg: 'Providence Holy Cross reports moderate aftershock damage',
          severity: 'warning',
        },
        {
          type: 'closure',
          closure: {
            id: 'cl-manual-i5-newhall',
            edgeIds: ['i5:sunvalley5-i5x405'],
            name: 'I-5 Golden State Fwy',
            detail: 'Aftershock — overhead sign structures down near Sylmar',
          },
        },
      ],
    }
  }
  return {
    quake: {
      id: 'manual-vernon',
      name: 'Puente Hills — Vernon',
      magnitude: 4.3,
      epicenter: [-118.24, 34.0],
      depthKm: 12,
      t: 0,
      kind: 'aftershock',
    },
    events: [
      { type: 'banner', severity: 'warning', title: 'M4.3 AFTERSHOCK — VERNON', sub: 'Felt across central LA · SIMULATED' },
      { type: 'feed', severity: 'warning', category: 'seismic', msg: 'M4.3 aftershock beneath Vernon. No new structural failures reported.' },
      {
        type: 'facility',
        facilityId: 'lacusc',
        patch: { walkInRate: 0.3 },
        feedMsg: 'LAC+USC: renewed wave of walk-in patients after aftershock',
        severity: 'warning',
      },
    ],
  }
}
