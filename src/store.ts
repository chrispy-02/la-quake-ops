import { useSyncExternalStore } from 'react'
import { SimulationEngine } from './sim/engine'
import type { SimState } from './sim/types'

export const engine = new SimulationEngine()

/** Sim-minutes per real second at 1× (75-min scenario ≈ 2.5 real minutes). */
const SIM_MIN_PER_REAL_SEC = 0.5

/**
 * React binding. Engine notifications are throttled to ~7 Hz for panel
 * re-renders; frame-accurate visuals (transports, dashes) read engine.state
 * directly inside MapView's own rAF loop.
 */
export function useSim(): SimState {
  useSyncExternalStore(subscribeThrottled, () => engine.state.version)
  return engine.state
}

function subscribeThrottled(cb: () => void): () => void {
  let timer = 0
  const onChange = () => {
    if (timer) return
    timer = window.setTimeout(() => {
      timer = 0
      cb()
    }, 140)
  }
  const unsub = engine.subscribe(onChange)
  return () => {
    window.clearTimeout(timer)
    unsub()
  }
}

/** Drives the simulation clock. Returns a cleanup function. */
export function startSimLoop(): () => void {
  let raf = 0
  let last = performance.now()
  const tick = (now: number) => {
    const dtSec = Math.min(0.25, (now - last) / 1000)
    last = now
    if (engine.state.phase === 'running') {
      engine.advance(dtSec * engine.state.speed * SIM_MIN_PER_REAL_SEC)
    }
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}

export interface Selection {
  kind: 'facility' | 'incident'
  id: string
}
