import { useCallback, useEffect, useState } from 'react'
import type { Resultaat } from './api'

/**
 * Laadt gegevens bij het tonen van een pagina en opnieuw na herlaad().
 * Een antwoord dat binnenkomt nadat de pagina weg is, wordt genegeerd.
 */
export function useGegevens<T>(laden: () => Promise<Resultaat<T>>): {
  data: T | null
  fout: string | null
  herlaad: () => void
} {
  const [data, setData] = useState<T | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  const [teller, setTeller] = useState(0)

  useEffect(() => {
    let actueel = true
    void laden().then((res) => {
      if (!actueel) return
      if (res.ok) {
        setData(res.data)
        setFout(null)
      } else {
        setFout(res.melding)
      }
    })
    return () => {
      actueel = false
    }
  }, [laden, teller])

  const herlaad = useCallback(() => setTeller((t) => t + 1), [])
  return { data, fout, herlaad }
}

/** Combineert resultaten: de eerste fout wint. */
export function alles<T extends unknown[]>(
  resultaten: { [K in keyof T]: Resultaat<T[K]> },
): Resultaat<T> {
  const data: unknown[] = []
  for (const r of resultaten as Resultaat<unknown>[]) {
    if (!r.ok) return r
    data.push(r.data)
  }
  return { ok: true, data: data as T }
}
