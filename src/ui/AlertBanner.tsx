import { useEffect, useState } from 'react'
import { useSim } from '../store'
import { IconAlert, IconCheck, IconInfo } from './icons'

export function AlertBanner() {
  const { banner } = useSim()
  const [visibleId, setVisibleId] = useState<number | null>(null)

  useEffect(() => {
    if (!banner) return
    setVisibleId(banner.id)
    const t = window.setTimeout(() => {
      setVisibleId((v) => (v === banner.id ? null : v))
    }, 7000)
    return () => window.clearTimeout(t)
  }, [banner?.id, banner])

  if (!banner || visibleId !== banner.id) return null
  const icon =
    banner.severity === 'success' ? (
      <IconCheck size={16} />
    ) : banner.severity === 'info' ? (
      <IconInfo size={16} />
    ) : (
      <IconAlert size={16} />
    )
  return (
    <div
      className={`banner ${banner.severity}`}
      role="alert"
      onClick={() => setVisibleId(null)}
      title="Dismiss"
    >
      <span className={`sev-${banner.severity}`}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div className="banner-title">{banner.title}</div>
        {banner.sub && <div className="banner-sub">{banner.sub}</div>}
      </div>
    </div>
  )
}
