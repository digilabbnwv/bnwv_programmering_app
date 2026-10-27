import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useRechten } from '../auth/RechtenProvider'

const APP_NAAM = 'BNWV Team Programmering'

/** Zet de titel van het browsertabblad (WCAG 2.4.2). */
export function usePaginaTitel(titel: string) {
  useEffect(() => {
    document.title = `${titel} – ${APP_NAAM}`
    return () => {
      document.title = APP_NAAM
    }
  }, [titel])
}

/** Kop en titel van een pagina binnen de layout. */
export function Pagina({ titel, intro, children }: { titel: string; intro?: ReactNode; children?: ReactNode }) {
  usePaginaTitel(titel)
  return (
    <>
      <h1 className="text-kop-medium font-extrabold">{titel}</h1>
      {intro && <p className="mt-3 max-w-prose text-intro text-neutral-700">{intro}</p>}
      {children && <div className="mt-8">{children}</div>}
    </>
  )
}

/**
 * Toont de pagina alleen met het juiste recht. Alleen UX: zonder recht geeft
 * de database ook geen gegevens (RLS).
 */
export function VereistRecht({ recht, children }: { recht: string; children: ReactNode }) {
  const { laden, heeftRecht } = useRechten()
  if (laden) return <p role="status">Bezig met laden…</p>
  if (!heeftRecht(recht)) {
    return (
      <Pagina titel="Geen toegang" intro="Je hebt geen rechten voor deze pagina.">
        <Link to="/" className="font-semibold underline underline-offset-4 hover:no-underline">
          Naar het dashboard
        </Link>
      </Pagina>
    )
  }
  return children
}
