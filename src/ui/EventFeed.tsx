import type { JSX } from 'react'
import type { FeedEvent } from '../sim/types'
import { useSim } from '../store'
import { fmtShort } from './format'
import {
  IconActivity,
  IconAlert,
  IconInfo,
  IconMedical,
  IconRoad,
  IconRoute,
} from './icons'

const CATEGORY_ICON: Record<FeedEvent['category'], (size: number) => JSX.Element> = {
  seismic: (s) => <IconActivity size={s} />,
  hospital: (s) => <IconMedical size={s} />,
  road: (s) => <IconRoad size={s} />,
  incident: (s) => <IconAlert size={s} />,
  routing: (s) => <IconRoute size={s} />,
  system: (s) => <IconInfo size={s} />,
}

export function EventFeed() {
  const state = useSim()
  const events = [...state.feed].reverse()
  return (
    <section className="panel feed" aria-label="Event log">
      <div className="panel-head">
        <span className="eyebrow">Event log</span>
        <span className="count-chip">{state.feed.length}</span>
      </div>
      <div className="panel-body">
        {events.length === 0 ? (
          <div style={{ padding: '14px 12px', fontSize: 11, color: 'var(--ink-3)' }}>
            No events yet. Start the scenario to begin the timeline.
          </div>
        ) : (
          events.map((e) => (
            <div key={e.id} className={`frow ${e.severity}`}>
              <span className={`ficon sev-${e.severity}`}>{CATEGORY_ICON[e.category](13)}</span>
              <span className="fmsg">{e.msg}</span>
              <span className="ft">{fmtShort(e.t)}</span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
