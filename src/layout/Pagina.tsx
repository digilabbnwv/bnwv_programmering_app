import { useEffect, type ReactNode } from 'react'
import { useRechten } from '../auth/RechtenProvider'
import { Tekstlink } from '../components/Tekstlink'

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

/** Houdt de inhoud op de gekozen breedte, midden in het venster. Op papier de volle breedte. */
export function PaginaKader({ breedte = 'standaard', children }: { breedte?: Breedte; children: ReactNode }) {
  return <div className={`mx-auto w-full ${BREEDTE[breedte]} print:max-w-none`}>{children}</div>
}

/** Kop en titel van een pagina binnen de layout. */
export function Pagina({
  titel,
  intro,
  breedte,
  children,
}: {
  titel: string
  intro?: ReactNode
  breedte?: Breedte
  children?: ReactNode
}) {
  usePaginaTitel(titel)
  return (
    <PaginaKader breedte={breedte}>
      <h1 className="text-kop-medium font-extrabold">{titel}</h1>
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
