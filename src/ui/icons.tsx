import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

function I({ size = 14, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const IconPlay = (p: P) => (
  <I {...p}>
    <path d="M7 4.5 19 12 7 19.5Z" fill="currentColor" stroke="none" />
  </I>
)

export const IconPause = (p: P) => (
  <I {...p}>
    <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
    <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
  </I>
)

export const IconStep = (p: P) => (
  <I {...p}>
    <path d="M5 4.5 15 12 5 19.5Z" fill="currentColor" stroke="none" />
    <line x1="19" y1="5" x2="19" y2="19" />
  </I>
)

export const IconReset = (p: P) => (
  <I {...p}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </I>
)

export const IconZap = (p: P) => (
  <I {...p}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10" fill="currentColor" stroke="none" />
  </I>
)

export const IconActivity = (p: P) => (
  <I {...p}>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </I>
)

export const IconAlert = (p: P) => (
  <I {...p}>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </I>
)

export const IconMedical = (p: P) => (
  <I {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M8 12h8" />
  </I>
)

export const IconRoad = (p: P) => (
  <I {...p}>
    <path d="M4 20 8.5 4" />
    <path d="M20 20 15.5 4" />
    <path d="M12 7v2.5" />
    <path d="M12 14v2.5" />
  </I>
)

export const IconRoute = (p: P) => (
  <I {...p}>
    <circle cx="6" cy="19" r="2.6" />
    <path d="M8.6 19h8.9a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
    <circle cx="18" cy="5" r="2.6" />
  </I>
)

export const IconInfo = (p: P) => (
  <I {...p}>
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </I>
)

export const IconCheck = (p: P) => (
  <I {...p}>
    <polyline points="20 6 9 17 4 12" />
  </I>
)

export const IconX = (p: P) => (
  <I {...p}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </I>
)

export const IconChevronLeft = (p: P) => (
  <I {...p}>
    <polyline points="15 18 9 12 15 6" />
  </I>
)

export const IconChevronRight = (p: P) => (
  <I {...p}>
    <polyline points="9 18 15 12 9 6" />
  </I>
)

export const IconChevronDown = (p: P) => (
  <I {...p}>
    <polyline points="6 9 12 15 18 9" />
  </I>
)

export const IconRadio = (p: P) => (
  <I {...p}>
    <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    <path d="M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 19.1a10 10 0 0 1 0-14.2M19.1 4.9a10 10 0 0 1 0 14.2" />
  </I>
)

export const IconDivert = (p: P) => (
  <I {...p}>
    <polyline points="15 14 20 9 15 4" />
    <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
  </I>
)

export const IconClock = (p: P) => (
  <I {...p}>
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15.5 14" />
  </I>
)

export const IconLayers = (p: P) => (
  <I {...p}>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </I>
)

export const IconBed = (p: P) => (
  <I {...p}>
    <path d="M2 18v-6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6" />
    <path d="M2 18h20" />
    <path d="M6 10V7a1 1 0 0 1 1-1h4v4" />
  </I>
)
