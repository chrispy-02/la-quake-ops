import { FACILITIES, FACILITY_BY_ID, availableBeds, facilityStatus, initialFacilityState } from './facilities'
import { organicPolygon, pointAlong } from './geo'
import { buildRoadNetwork, type RoadNetwork } from './roadNetwork'
import { assignIncident, type AssignmentContext, type AssignmentResult } from './routing'
import {
  aftershockPreset,
  buildMainScenario,
  type FeedCategory,
  type Scenario,
  type ScenarioAction,
} from './scenario'
import type {
  EventSeverity,
  Incident,
  IncidentSpec,
  LngLat,
  Metrics,
  Quake,
  ShakeZone,
  SimState,
} from './types'

/** Fixed logic timestep: one deci-minute. */
const DECI = 0.1
/** Occupancy floor (fraction of capacity) that post-event discharges drain toward. */
const DISCHARGE_FLOOR = 0.74
/** Walk-in surges cannot push occupancy past this multiple of capacity. */
const WALKIN_CEILING = 1.12

function incidentLoad(i: { patients: { critical: number; serious: number; minor: number } }): number {
  return i.patients.critical + i.patients.serious + i.patients.minor
}

function zonesForQuake(quake: Quake): ShakeZone[] {
  let seedBase = 0
  for (const ch of quake.id) seedBase = (seedBase * 31 + ch.charCodeAt(0)) >>> 0
  const mk = (
    kind: ShakeZone['kind'],
    label: string,
    radiusKm: number,
    elongation: number,
    idx: number,
  ): ShakeZone => ({
    id: `${quake.id}-${kind}`,
    kind,
    label,
    center: quake.epicenter,
    polygon: organicPolygon(quake.epicenter, radiusKm, {
      seed: (seedBase + idx * 97) % 100000,
      elongation,
      bearingDeg: 115,
      roughness: 0.09,
    }),
  })
  if (quake.kind === 'mainshock') {
    return [
      mk('severe', 'MMI VIII · Severe', 5.5, 1.35, 1),
      mk('strong', 'MMI VII · Very strong', 11, 1.3, 2),
      mk('moderate', 'MMI VI · Strong', 20, 1.25, 3),
      mk('light', 'MMI V · Moderate', 34, 1.2, 4),
    ]
  }
  const strongR = Math.max(1.5, (quake.magnitude - 4) * 3 + 1.5)
  return [
    mk('strong', 'MMI VII · Very strong', strongR, 1.25, 1),
    mk('moderate', 'MMI VI · Strong', strongR * 2.2, 1.2, 2),
  ]
}

function emptyMetrics(): Metrics {
  return {
    totalPatients: 0,
    patientsWaiting: 0,
    patientsAssigned: 0,
    patientsInTransit: 0,
    patientsDelivered: 0,
    criticalWaiting: 0,
    hospitalsOperational: 0,
    hospitalsImpaired: 0,
    hospitalsDiverting: 0,
    hospitalsOffline: 0,
    bedsAvailable: 0,
    reroutes: 0,
    activeClosures: 0,
  }
}

export class SimulationEngine {
  state!: SimState

  private readonly net: RoadNetwork = buildRoadNetwork()
  private scenario!: Scenario
  private eventIndex = 0
  private simDeci = 0
  private pendingDeci = 0
  private closedEdges = new Set<string>()
  private feedSeq = 0
  private bannerSeq = 0
  private routingDirty = false
  private listeners = new Set<() => void>()

  constructor() {
    this.init()
  }

  private init(): void {
    this.scenario = buildMainScenario()
    this.eventIndex = 0
    this.simDeci = 0
    this.pendingDeci = 0
    this.closedEdges = new Set()
    this.feedSeq = 0
    this.bannerSeq = 0
    this.routingDirty = false
    const facilityStates: SimState['facilityStates'] = {}
    for (const f of FACILITIES) facilityStates[f.id] = initialFacilityState(f)
    this.state = {
      phase: 'idle',
      simMin: 0,
      speed: 1,
      stabilizing: false,
      quakes: [],
      zones: [],
      facilityStates,
      incidents: [],
      closures: [],
      feed: [],
      banner: null,
      metrics: emptyMetrics(),
      rerouteTotal: 0,
      manualAftershocks: 0,
      version: 0,
    }
    this.recomputeMetrics()
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private notify(): void {
    this.state.version += 1
    for (const cb of this.listeners) cb()
  }

  start(): void {
    if (this.state.phase !== 'idle') return
    this.state.phase = 'running'
    this.applyDueEvents()
    this.validateRouting()
    this.recomputeMetrics()
    this.notify()
  }

  pause(): void {
    if (this.state.phase === 'running') {
      this.state.phase = 'paused'
      this.notify()
    }
  }

  resume(): void {
    if (this.state.phase === 'paused') {
      this.state.phase = 'running'
      this.notify()
    }
  }

  reset(): void {
    this.init()
    this.notify()
  }

  setSpeed(speed: number): void {
    this.state.speed = speed
    this.notify()
  }

  /** Advance exactly one sim-minute, even while paused. */
  step(): void {
    if (this.state.phase === 'idle') return
    this.advanceBy(1)
    this.notify()
  }

  advance(dtMin: number): void {
    if (this.state.phase !== 'running' && this.state.phase !== 'complete') return
    this.advanceBy(dtMin)
    this.notify()
  }

  triggerAftershock(): void {
    if (this.state.phase === 'idle') return
    this.state.manualAftershocks += 1
    const n = this.state.manualAftershocks
    const preset = aftershockPreset(n)
    const t = this.state.simMin
    this.applyAction({
      type: 'quake',
      quake: { ...preset.quake, id: `${preset.quake.id}-${n}`, t },
    })
    for (const action of preset.events) {
      if (action.type === 'incident') {
        this.applyAction({
          type: 'incident',
          spec: { ...action.spec, id: `${action.spec.id}-${n}` },
        })
      } else if (action.type === 'closure') {
        this.applyAction({
          type: 'closure',
          closure: { ...action.closure, id: `${action.closure.id}-${n}` },
        })
      } else {
        this.applyAction(action)
      }
    }
    this.validateRouting()
    this.recomputeMetrics()
    this.notify()
  }

  private advanceBy(dtMin: number): void {
    this.pendingDeci += dtMin * 10
    let steps = Math.floor(this.pendingDeci + 1e-6)
    this.pendingDeci -= steps
    while (steps > 0) {
      steps -= 1
      this.processDeci()
    }
  }

  private processDeci(): void {
    this.simDeci += 1
    this.state.simMin = this.simDeci / 10
    const t = this.state.simMin

    this.applyDueEvents()
    this.applyDynamics()
    this.applyTransports(t)
    if (this.routingDirty || this.simDeci % 10 === 0) {
      this.validateRouting()
    }
    if (
      this.state.phase === 'running' &&
      t >= this.scenario.durationMin &&
      this.eventIndex >= this.scenario.events.length &&
      this.state.incidents.every((i) => i.status === 'delivered')
    ) {
      this.state.phase = 'complete'
      this.pushFeed('success', 'system', 'Scenario complete — regional conditions stabilized. Reset to run again.')
      this.setBanner('success', 'SCENARIO COMPLETE', 'All simulated patients delivered · conditions stabilized')
    }
    this.recomputeMetrics()
  }

  private applyDueEvents(): void {
    const events = this.scenario.events
    while (this.eventIndex < events.length && events[this.eventIndex].t <= this.state.simMin + 1e-9) {
      this.applyAction(events[this.eventIndex].action)
      this.eventIndex += 1
    }
  }

  private applyAction(action: ScenarioAction): void {
    switch (action.type) {
      case 'quake': {
        const quake: Quake = { ...action.quake, t: this.state.simMin }
        this.state.quakes = [...this.state.quakes, quake]
        this.state.zones = [...this.state.zones, ...zonesForQuake(quake)]
        this.routingDirty = true
        break
      }
      case 'incident':
        this.spawnIncident(action.spec)
        break
      case 'facility': {
        const s = this.state.facilityStates[action.facilityId]
        if (!s) break
        Object.assign(s, action.patch)
        if (action.feedMsg) this.pushFeed(action.severity ?? 'warning', 'hospital', action.feedMsg)
        this.routingDirty = true
        break
      }
      case 'closure': {
        const fresh = action.closure.edgeIds.some((e) => !this.closedEdges.has(e))
        if (!fresh) break
        this.state.closures = [
          ...this.state.closures,
          { ...action.closure, tClosed: this.state.simMin },
        ]
        this.rebuildClosedEdges()
        this.pushFeed('warning', 'road', `ROAD CLOSED: ${action.closure.name} — ${action.closure.detail}`)
        this.routingDirty = true
        break
      }
      case 'reopen': {
        const closure = this.state.closures.find((c) => c.id === action.closureId)
        if (!closure || closure.reopened) break
        closure.reopened = true
        this.rebuildClosedEdges()
        this.pushFeed('success', 'road', action.feedMsg ?? `ROAD REOPENED: ${closure.name}`)
        this.routingDirty = true
        break
      }
      case 'feed':
        this.pushFeed(action.severity, action.category, action.msg)
        break
      case 'banner':
        this.setBanner(action.severity, action.title, action.sub)
        break
      case 'stabilize': {
        this.state.stabilizing = true
        for (const s of Object.values(this.state.facilityStates)) s.walkInRate = 0
        break
      }
    }
  }

  private rebuildClosedEdges(): void {
    this.closedEdges = new Set(
      this.state.closures.filter((c) => !c.reopened).flatMap((c) => c.edgeIds),
    )
  }

  private assignmentContext(): AssignmentContext {
    return {
      net: this.net,
      facilities: FACILITIES,
      states: this.state.facilityStates,
      closedEdgeIds: this.closedEdges,
      zones: this.state.zones,
    }
  }

  private spawnIncident(spec: IncidentSpec): void {
    const t = this.state.simMin
    const incident: Incident = {
      ...spec,
      tSpawn: t,
      status: 'waiting',
      assignedFacilityId: null,
      explanation: '',
      rerouteCount: 0,
      etaMin: null,
      departT: null,
      arriveT: null,
      routeCoords: null,
      routeEdgeIds: null,
      viaNames: [],
      log: [{ t, msg: `Reported: ${spec.name} — ${spec.neighborhood}` }],
    }
    this.state.incidents = [...this.state.incidents, incident]
    const load = incidentLoad(incident)
    const severity: EventSeverity = incident.patients.critical > 0 ? 'critical' : 'warning'
    this.pushFeed(
      severity,
      'incident',
      `MCI reported: ${spec.name} (${spec.neighborhood}) — ${load} patients, ${incident.patients.critical} critical.`,
    )
    this.applyAssignment(incident, assignIncident(incident, this.assignmentContext()), 'initial')
  }

  private applyAssignment(
    incident: Incident,
    result: AssignmentResult | null,
    mode: 'initial' | 'reroute' | 'retry',
    reroutePrefix?: string,
  ): void {
    const t = this.state.simMin
    const load = incidentLoad(incident)
    if (!result) {
      incident.status = 'waiting'
      incident.assignedFacilityId = null
      incident.routeCoords = null
      incident.routeEdgeIds = null
      incident.viaNames = []
      incident.etaMin = null
      incident.explanation =
        'No facility currently reachable — transport holding on scene; retrying as conditions change.'
      incident.log.push({ t, msg: 'No reachable facility — holding on scene' })
      this.pushFeed('critical', 'routing', `HOLDING: ${incident.name} — no reachable facility with capacity.`)
      return
    }
    const facility = FACILITY_BY_ID.get(result.facilityId)!
    incident.assignedFacilityId = facility.id
    incident.etaMin = result.etaMin
    incident.routeCoords = result.path.coords
    incident.routeEdgeIds = result.path.edgeIds
    incident.viaNames = result.path.viaNames
    this.state.facilityStates[facility.id].incomingPatients += load

    if (mode === 'initial' || mode === 'retry' || incident.status !== 'in-transit') {
      incident.status = 'assigned'
      incident.departT = Math.max(t, incident.tSpawn + incident.triageMin)
      incident.arriveT = incident.departT + result.path.minutes
    } else {
      // Mid-transit redirect: restart interpolation from the current position.
      incident.departT = t
      incident.arriveT = t + result.path.minutes
    }

    if (mode === 'reroute') {
      incident.rerouteCount += 1
      this.state.rerouteTotal += 1
      incident.explanation = `${reroutePrefix ?? 'Rerouted.'} ${result.explanation}`
      incident.log.push({ t, msg: `Rerouted → ${facility.name} (ETA ${result.etaMin} min)` })
      this.pushFeed(
        'warning',
        'routing',
        `REROUTED: ${incident.name} → ${facility.name}. ${reroutePrefix ?? ''}`.trim(),
      )
    } else {
      incident.explanation = result.explanation
      incident.log.push({ t, msg: `Assigned → ${facility.name} (ETA ${result.etaMin} min)` })
      this.pushFeed(
        'info',
        'routing',
        `Assigned: ${incident.name} → ${facility.name} — ETA ${result.etaMin} min${result.path.viaNames.length ? ` via ${result.path.viaNames[0]}` : ''}.`,
      )
    }
  }

  private applyDynamics(): void {
    // Deterministic walk-in surges (fractional accumulator, integer admissions).
    for (const f of FACILITIES) {
      const s = this.state.facilityStates[f.id]
      if (s.walkInRate > 0 && !s.offline) {
        s.walkInAcc += s.walkInRate * DECI
        const whole = Math.floor(s.walkInAcc)
        if (whole > 0) {
          s.walkInAcc -= whole
          s.occupied = Math.min(s.occupied + whole, Math.ceil(f.edCapacity * WALKIN_CEILING))
        }
      }
    }
    // Post-stabilization discharges drain busy EDs every 2 minutes.
    if (this.state.stabilizing && this.simDeci % 20 === 0) {
      for (const f of FACILITIES) {
        const s = this.state.facilityStates[f.id]
        if (s.occupied > Math.ceil(f.edCapacity * DISCHARGE_FLOOR)) s.occupied -= 1
      }
    }
  }

  private applyTransports(t: number): void {
    for (const incident of this.state.incidents) {
      if (incident.status === 'assigned' && incident.departT !== null && t >= incident.departT - 1e-9) {
        incident.status = 'in-transit'
        incident.log.push({ t, msg: 'Transport departed scene' })
      }
      if (incident.status === 'in-transit' && incident.arriveT !== null && t >= incident.arriveT - 1e-9) {
        incident.status = 'delivered'
        const load = incidentLoad(incident)
        const facilityId = incident.assignedFacilityId!
        const s = this.state.facilityStates[facilityId]
        s.incomingPatients = Math.max(0, s.incomingPatients - load)
        s.occupied += load
        const facility = FACILITY_BY_ID.get(facilityId)!
        incident.log.push({ t, msg: `Delivered ${load} patients → ${facility.name}` })
        this.pushFeed(
          'success',
          'routing',
          `Delivered: ${load} patients from ${incident.name} → ${facility.name}.`,
        )
      }
    }
  }

  /**
   * Re-validate assignments. On-scene incidents reroute away from offline,
   * inaccessible, diverting, or full facilities; in-transit units continue to
   * a diverting/full facility but re-path or redirect when the destination is
   * offline/inaccessible or the route crosses a new closure.
   */
  private validateRouting(): void {
    this.routingDirty = false
    const t = this.state.simMin
    for (const incident of this.state.incidents) {
      if (incident.status === 'delivered') continue

      if (incident.assignedFacilityId === null) {
        this.applyAssignment(incident, assignIncident(incident, this.assignmentContext()), 'retry')
        continue
      }

      const facility = FACILITY_BY_ID.get(incident.assignedFacilityId)!
      const s = this.state.facilityStates[facility.id]
      const status = facilityStatus(facility, s)
      const load = incidentLoad(incident)
      const inTransit = incident.status === 'in-transit'
      const blocked = (incident.routeEdgeIds ?? []).some((e) => this.closedEdges.has(e))

      let reason: string | null = null
      if (s.offline) {
        reason = `${facility.name} is offline${s.statusReason ? ` (${s.statusReason.toLowerCase()})` : ''}`
      } else if (!s.accessible) {
        reason = `${facility.name} became inaccessible`
      } else if (!inTransit && status === 'diverting') {
        reason = `${facility.name} is on ED diversion`
      } else if (!inTransit && (s.occupied + s.incomingPatients - load) / facility.edCapacity > 1.02) {
        reason = `${facility.name} ran out of ED beds`
      } else if (blocked) {
        reason = null // handled below as a path-only diversion
      } else {
        continue
      }

      if (reason === null && blocked) {
        // Destination still valid — recompute the path around the closure.
        const from = this.currentPosition(incident, t)
        s.incomingPatients = Math.max(0, s.incomingPatients - load)
        const result = assignIncident({ ...incident, lngLat: from }, this.assignmentContext())
        if (result && result.facilityId === incident.assignedFacilityId) {
          const prevEta = incident.etaMin
          this.applyAssignment(incident, result, 'reroute', `Route blocked by closure — diverted${prevEta && result.etaMin > prevEta ? ` (+${result.etaMin - prevEta} min)` : ''}.`)
        } else {
          this.applyAssignment(incident, result, 'reroute', 'Route blocked by closure.')
        }
        continue
      }

      if (reason !== null) {
        const from = this.currentPosition(incident, t)
        s.incomingPatients = Math.max(0, s.incomingPatients - load)
        const result = assignIncident({ ...incident, lngLat: from }, this.assignmentContext())
        this.applyAssignment(incident, result, 'reroute', `Rerouted because ${reason}.`)
      }
    }
  }

  private currentPosition(incident: Incident, t: number): LngLat {
    if (
      incident.status === 'in-transit' &&
      incident.routeCoords &&
      incident.departT !== null &&
      incident.arriveT !== null &&
      incident.arriveT > incident.departT
    ) {
      const progress = (t - incident.departT) / (incident.arriveT - incident.departT)
      return pointAlong(incident.routeCoords, Math.min(1, Math.max(0, progress)))
    }
    return incident.lngLat
  }

  private recomputeMetrics(): void {
    const m = emptyMetrics()
    for (const incident of this.state.incidents) {
      const load = incidentLoad(incident)
      m.totalPatients += load
      if (incident.status === 'waiting' || incident.status === 'assigned') {
        m.patientsWaiting += load
        m.criticalWaiting += incident.patients.critical
        if (incident.assignedFacilityId) m.patientsAssigned += load
      } else if (incident.status === 'in-transit') {
        m.patientsInTransit += load
      } else {
        m.patientsDelivered += load
      }
    }
    for (const f of FACILITIES) {
      const s = this.state.facilityStates[f.id]
      m.bedsAvailable += availableBeds(f, s)
      if (f.kind !== 'hospital') continue
      const status = facilityStatus(f, s)
      if (status === 'offline' || status === 'inaccessible') m.hospitalsOffline += 1
      else if (status === 'diverting') m.hospitalsDiverting += 1
      else if (status === 'partially-damaged') m.hospitalsImpaired += 1
      else m.hospitalsOperational += 1
    }
    m.reroutes = this.state.rerouteTotal
    m.activeClosures = this.state.closures.filter((c) => !c.reopened).length
    this.state.metrics = m
  }

  private pushFeed(severity: EventSeverity, category: FeedCategory, msg: string): void {
    this.feedSeq += 1
    this.state.feed = [
      ...this.state.feed,
      { id: this.feedSeq, t: this.state.simMin, severity, category, msg },
    ]
    if (this.state.feed.length > 250) this.state.feed = this.state.feed.slice(-250)
  }

  private setBanner(severity: EventSeverity, title: string, sub?: string): void {
    this.bannerSeq += 1
    this.state.banner = { id: this.bannerSeq, severity, title, sub }
  }
}
