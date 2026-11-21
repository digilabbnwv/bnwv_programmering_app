import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { useRechten } from '../auth/RechtenProvider'
import { Tekstlink } from '../components/Tekstlink'
import { kruimels } from './navigatie'

const APP_NAAM = 'BNWV Team Programmering'

/**
 * Breedte van de inhoud (docs/navigatie.md, hoofdstuk 5): `smal` voor
 * formulieren, `standaard` voor lijsten en detailpagina's, `breed` voor
 * dashboards en grote tabellen. Lopende tekst blijft op `max-w-prose`.
 */
export type Breedte = 'smal' | 'standaard' | 'breed'

const BREEDTE: Record<Breedte, string> = {
  smal: 'max-w-smal',
  standaard: 'max-w-page',
  breed: 'max-w-breed',
}

/** Zet de titel van het browsertabblad (WCAG 2.4.2). */
export function usePaginaTitel(titel: string) {
  useEffect(() => {
    document.title = `${titel} – ${APP_NAAM}`
    return () => {
      document.title = APP_NAAM
    }
  }, [titel])
}

/** Houdt de inhoud op de gekozen breedte, links uitgelijnd naast de zijbalk, zodat de linkerrand op elke pagina gelijk is. Op papier de volle breedte. */
export function PaginaKader({ breedte = 'standaard', children }: { breedte?: Breedte; children: ReactNode }) {
  return <div className={`w-full ${BREEDTE[breedte]} print:max-w-none`}>{children}</div>
}

/**
 * Waar de pagina staat: de menugroep en, bij een detailpagina, het overzicht
 * erboven als link (layout/navigatie.ts). Vervangt losse terug-links.
 */
function Kruimelpad({ titel }: { titel: string }) {
  const { pathname } = useLocation()
  const { heeftRecht } = useRechten()
  const pad = kruimels(pathname, heeftRecht)
  if (pad.length === 0) return null
  return (
    <nav aria-label="Kruimelpad" className="mb-3 print:hidden">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ui-sm text-neutral-700">
        {pad.map((k) => (
          <li key={k.label} className="flex items-center gap-2">
            {k.pad ? <Tekstlink licht to={k.pad}>{k.label}</Tekstlink> : <span>{k.label}</span>}
            <span aria-hidden="true">›</span>
          </li>
        ))}
        <li>
          <span aria-current="page" className="font-semibold text-anthracite">
            {titel}
          </span>
        </li>
      </ol>
    </nav>
  )
}

/**
 * De vaste opbouw van een pagina (docs/navigatie.md, hoofdstuk 6): kruimelpad,
 * titel met een statuslabel, rechts de acties voor de hele pagina (hoogstens
 * één primaire knop), de intro, en daaronder de inhoud. Tabbladen, filterbalk
 * en kengetallen horen bovenaan de inhoud, in die volgorde.
 */
export function Pagina({
  titel,
  intro,
  status,
  acties,
  breedte,
  children,
}: {
  titel: string
  intro?: ReactNode
  /** Kort label naast de titel, bijv. "Definitief" of "Inactief". */
  status?: ReactNode
  /** Knoppen voor de pagina als geheel, rechts naast de titel; niet op papier. */
  acties?: ReactNode
  breedte?: Breedte
  children?: ReactNode
}) {
  usePaginaTitel(titel)
  return (
    <PaginaKader breedte={breedte}>
      <Kruimelpad titel={titel} />
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-kop-medium font-extrabold">{titel}</h1>
          {status}
        </div>
        {acties && <div className="flex flex-wrap gap-3 md:pt-1.5 print:hidden">{acties}</div>}
      </div>
      {intro && <p className="mt-3 max-w-prose text-intro text-neutral-700">{intro}</p>}
      {children && <div className="mt-8">{children}</div>}
    </PaginaKader>
  )
}

/**
 * Toont de pagina alleen met het juiste recht. Alleen UX: zonder recht geeft
 * de database ook geen gegevens (RLS).
 */
export function VereistRecht({ recht, children }: { recht: string; children: ReactNode }) {
  const { laden, heeftRecht } = useRechten()
  if (laden) {
    return (
      <PaginaKader>
        <p role="status">Bezig met laden…</p>
      </PaginaKader>
    )
  }
  if (!heeftRecht(recht)) {
    return (
      <Pagina titel="Geen toegang" intro="Je hebt geen rechten voor deze pagina.">
        <Tekstlink to="/">Naar het dashboard</Tekstlink>
      </Pagina>
    )
  }
  return children
}
