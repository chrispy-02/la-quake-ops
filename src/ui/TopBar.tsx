import { useEffect, useRef } from 'react'
import { engine, useSim } from '../store'
import { fmtClock } from './format'
import {
  IconActivity,
  IconPause,
  IconPlay,
  IconReset,
  IconStep,
  IconZap,
} from './icons'

const SPEEDS = [0.5, 1, 2, 4]

function Seismo() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const W = 150
    const H = 30
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const samples: number[] = new Array(W).fill(0)
    const shocks: { at: number; mag: number }[] = []
    let knownQuakes = 0
    let raf = 0

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      ctx.strokeStyle = '#223146'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, H / 2)
      ctx.lineTo(W, H / 2)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(255, 138, 112, 0.9)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      for (let x = 0; x < W; x += 1) {
        const y = H / 2 - samples[x]
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    if (reduced) {
      draw()
      return
    }

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const st = engine.state
      if (st.quakes.length > knownQuakes) {
        for (let i = knownQuakes; i < st.quakes.length; i += 1) {
          shocks.push({ at: now, mag: st.quakes[i].magnitude })
        }
        knownQuakes = st.quakes.length
      } else if (st.quakes.length < knownQuakes) {
        knownQuakes = st.quakes.length
        shocks.length = 0
      }
      let amp = 0.7
      for (const s of shocks) {
        amp += (s.mag - 3.2) * 3.4 * Math.exp(-(now - s.at) / 6500)
      }
      const t = now / 1000
      const noise =
        Math.sin(t * 11.3) * 0.5 + Math.sin(t * 23.7) * 0.35 + Math.sin(t * 5.1) * 0.15
      samples.push(Math.max(-12, Math.min(12, amp * noise)))
      samples.shift()
      draw()
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={canvasRef} className="seismo" style={{ width: 150, height: 30 }} />
}

export function TopBar() {
  const state = useSim()
  const mainshock = state.quakes.find((q) => q.kind === 'mainshock')
  const lastAftershock = [...state.quakes].reverse().find((q) => q.kind === 'aftershock')
  const phase = state.phase

  const phaseBadge =
    phase === 'running' ? (
      <span className="phase-badge live"><span className="dot" />LIVE</span>
    ) : phase === 'paused' ? (
      <span className="phase-badge paused"><span className="dot" />PAUSED</span>
    ) : phase === 'complete' ? (
      <span className="phase-badge complete"><span className="dot" />COMPLETE</span>
    ) : (
      <span className="phase-badge"><span className="dot" />STANDBY</span>
    )

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark"><IconActivity size={15} /></span>
        <div>
          <div className="brand-name">LA QUAKE OPS</div>
          <div className="brand-sub">REGIONAL EMS ROUTING · TABLETOP SIM</div>
        </div>
        <span className="sim-chip">SIMULATED DATA</span>
      </div>

      <div className="telemetry">
        {mainshock ? (
          <>
            <div className="quake-readout">
              <span className="quake-mag">
                M{mainshock.magnitude.toFixed(1)} · {mainshock.depthKm} KM DEEP
                {lastAftershock ? (
                  <span style={{ color: 'var(--warn)' }}> · AS M{lastAftershock.magnitude.toFixed(1)}</span>
                ) : null}
              </span>
              <span className="quake-name">{mainshock.name}</span>
            </div>
            <Seismo />
          </>
        ) : (
          <div className="quake-readout">
            <span className="quake-mag" style={{ color: 'var(--ink-3)' }}>NO EVENT</span>
            <span className="quake-name">Awaiting scenario start</span>
          </div>
        )}
        <div className="clock">
          <span className="eyebrow">Elapsed</span>
          <span className="clock-value">{fmtClock(state.simMin)}</span>
        </div>
      </div>

      <div className="controls">
        {phase === 'idle' && (
          <button className="btn primary" onClick={() => engine.start()}>
            <IconPlay size={13} /> Start scenario
          </button>
        )}
        {phase === 'running' && (
          <button className="btn" onClick={() => engine.pause()}>
            <IconPause size={13} /> Pause
          </button>
        )}
        {phase === 'paused' && (
          <button className="btn primary" onClick={() => engine.resume()}>
            <IconPlay size={13} /> Resume
          </button>
        )}
        <button
          className="btn"
          title="Advance one simulated minute"
          disabled={phase === 'idle'}
          onClick={() => engine.step()}
        >
          <IconStep size={13} /> +1 min
        </button>
        <button className="btn" disabled={phase === 'idle'} onClick={() => engine.reset()}>
          <IconReset size={13} /> Reset
        </button>
        <div className="seg" role="group" aria-label="Simulation speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              className={state.speed === s ? 'on' : ''}
              onClick={() => engine.setSpeed(s)}
            >
              {s}×
            </button>
          ))}
        </div>
        <button
          className="btn amber"
          disabled={phase === 'idle' || phase === 'complete'}
          onClick={() => engine.triggerAftershock()}
          title="Trigger a scripted aftershock preset"
        >
          <IconZap size={13} /> Aftershock
        </button>
        {phaseBadge}
      </div>
    </header>
  )
}
