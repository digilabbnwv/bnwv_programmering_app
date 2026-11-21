import { createContext, use, useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useRechten } from '../auth/RechtenProvider'
import { Button } from '../components/Button'
import { lees, type Werkjaar } from '../werkbelasting/api'
import { alles, useGegevens } from '../werkbelasting/useGegevens'
import type { Jaarplan } from '../projectplanner/api'
import { bepaalJaar, jarenInKeuze, leesOnthouden, onthoud } from './jaarkeuze'

interface Jaarcontext {
  /** Het gekozen jaar. */
  jaar: number
  /** Kies een ander jaar: in de URL en onthouden. */
  zetJaar: (jaar: number) => void
  /** De jaren voor de keuzelijst. */
  jaren: number[]
  /** Jaren met een werkjaar (werkbelasting). */
  werkjaren: number[]
  /** Jaren met een jaarplan (projectplanner; leeg zonder projectplan.bekijken). */
  jaarplanjaren: number[]
  /** Opnieuw laden, na het toevoegen van een werkjaar of jaarplan. */
  herlaadJaren: () => void
}

const JaarContext = createContext<Jaarcontext | null>(null)

export function useJaar(): Jaarcontext {
  const context = use(JaarContext)
  if (!context) throw new Error('useJaar buiten JaarProvider')
  return context
}

/**
 * Bij een jaar zonder gegevens: knoppen naar de jaren die er wel zijn, zodat
 * je niet eerst de keuzelijst bovenaan hoeft te zoeken.
 */
export function AndereJaren({ jaren }: { jaren: readonly number[] }) {
  const { jaar, zetJaar } = useJaar()
  const andere = jaren.filter((j) => j !== jaar)
  if (andere.length === 0) return null
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <span>Wel beschikbaar:</span>
      {andere.map((j) => (
        <Button key={j} variant="secundair" onClick={() => zetJaar(j)}>
          {j}
        </Button>
      ))}
    </div>
  )
}

/** Het jaar voor de hele app; zie layout/jaarkeuze.ts. */
export function JaarProvider({ children }: { children: ReactNode }) {
  const { client } = useAuth()
  const { heeftRecht, laden: rechtenLaden } = useRechten()
  const magJaarplannen = !rechtenLaden && heeftRecht('projectplan.bekijken')
  const [zoek, setZoek] = useSearchParams()
  const nu = new Date().getFullYear()
  const uitUrl = zoek.get('jaar')
  const jaar = bepaalJaar(uitUrl, leesOnthouden(), nu)

  // Een jaar uit een link (?jaar=) geldt daarna ook voor de andere pagina's.
  useEffect(() => {
    if (uitUrl !== null && String(jaar) === uitUrl) onthoud(jaar)
  }, [uitUrl, jaar])

  const laden = useCallback(
    async () =>
      alles<[Werkjaar[], Jaarplan[]]>(
        await Promise.all([
          lees<Werkjaar>(client, 'werkjaren', 'jaar'),
          magJaarplannen ? lees<Jaarplan>(client, 'jaarplannen', 'jaar') : Promise.resolve({ ok: true as const, data: [] }),
        ]),
      ),
    [client, magJaarplannen],
  )
  const { data, herlaad } = useGegevens(laden)

  const zetJaar = useCallback(
    (nieuw: number) => {
      onthoud(nieuw)
      setZoek((oud) => {
        const volgende = new URLSearchParams(oud)
        volgende.set('jaar', String(nieuw))
        return volgende
      })
    },
    [setZoek],
  )

  const waarde = useMemo(() => {
    const werkjaren = (data?.[0] ?? []).map((w) => w.jaar)
    const jaarplanjaren = (data?.[1] ?? []).map((j) => j.jaar)
    return {
      jaar,
      zetJaar,
      jaren: jarenInKeuze([...werkjaren, ...jaarplanjaren], nu, jaar),
      werkjaren,
      jaarplanjaren,
      herlaadJaren: herlaad,
    }
  }, [data, jaar, nu, zetJaar, herlaad])

  return <JaarContext value={waarde}>{children}</JaarContext>
}
