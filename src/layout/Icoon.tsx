import type { ReactNode } from 'react'
import type { IcoonNaam } from './paginas'

/** Lijniconen voor het menu, 24×24 met de tekstkleur. Altijd decoratief: de naam staat ernaast of in sr-only. */
const PADEN: Record<IcoonNaam, ReactNode> = {
  start: <path d="M3 11l9-8 9 8M5 9.5V20h5v-6h4v6h5V9.5" />,
  persoon: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
    </>
  ),
  balken: <path d="M4 5v15h16M8 9h9M8 13h5M8 17h11" />,
  personen: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-5.5 6.5-5.5s6.5 1.9 6.5 5.5M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2.1.7 3.5 2.4 3.5 5.2" />
    </>
  ),
  school: <path d="M3 21h18M5 21V10l7-5 7 5v11M10 21v-5h4v5M10 11h4" />,
  lagen: <path d="M12 3l9 5-9 5-9-5zM3 12.5l9 5 9-5M3 17l9 5 9-5" />,
  groep: (
    <>
      <circle cx="12" cy="7" r="3" />
      <circle cx="5" cy="11" r="2.2" />
      <circle cx="19" cy="11" r="2.2" />
      <path d="M7 21c0-3 2.2-5 5-5s5 2 5 5M1.5 19c0-2.2 1.4-3.6 3.5-3.6M22.5 19c0-2.2-1.4-3.6-3.5-3.6" />
    </>
  ),
  lijst: <path d="M10 6h10M10 12h10M10 18h10M4 6l1.3 1.3L7.5 5M4 12l1.3 1.3L7.5 11M4 18l1.3 1.3L7.5 17" />,
  dashboard: (
    <>
      <rect x="3" y="3" width="8" height="10" rx="1.5" />
      <rect x="13" y="3" width="8" height="6" rx="1.5" />
      <rect x="13" y="11" width="8" height="10" rx="1.5" />
      <rect x="3" y="15" width="8" height="6" rx="1.5" />
    </>
  ),
  kalender: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  schuiven: (
    <>
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  organisatie: (
    <>
      <rect x="9" y="3" width="6" height="5" rx="1" />
      <rect x="3" y="16" width="6" height="5" rx="1" />
      <rect x="15" y="16" width="6" height="5" rx="1" />
      <path d="M12 8v4M6 16v-4h12v4" />
    </>
  ),
  schild: <path d="M12 3l8 3v6c0 4.8-3.4 8-8 9-4.6-1-8-4.2-8-9V6zM9 12l2 2 4-4" />,
  logboek: <path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7" />,
}

export function Icoon({ naam, className = 'size-5' }: { naam: IcoonNaam; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      {PADEN[naam]}
    </svg>
  )
}
