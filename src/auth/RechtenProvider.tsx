import { createContext, use, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from './AuthProvider'

/**
 * Profiel en rechten van de ingelogde gebruiker, uit de database (RLS laat
 * alleen de eigen rij en de rechten van de eigen rol zien). Alleen voor de
 * interface: knoppen en pagina's verbergen. De database dwingt het af.
 */
export interface Rechten {
  laden: boolean
  weergavenaam: string | null
  rolNaam: string | null
  heeftRecht: (recht: string) => boolean
}

const RechtenContext = createContext<Rechten | null>(null)

export function useRechten(): Rechten {
  const rechten = use(RechtenContext)
  if (!rechten) throw new Error('useRechten buiten RechtenProvider')
  return rechten
}

interface Gegevens {
  userId: string
  weergavenaam: string | null
  rolNaam: string | null
  rechten: ReadonlySet<string>
}

export function RechtenProvider({ children }: { children: ReactNode }) {
  const { client, claims } = useAuth()
  const userId = claims?.sub
  const rol = claims?.user_role
  const [gegevens, setGegevens] = useState<Gegevens | null>(null)

  useEffect(() => {
    if (!userId || !rol) return
    let actueel = true
    void (async () => {
      const [profiel, rolRij, rechten] = await Promise.all([
        client.from('profiles').select('weergavenaam').eq('user_id', userId).maybeSingle(),
        client.from('roles').select('naam').eq('id', rol).maybeSingle(),
        client.from('role_permissions').select('permission_id').eq('role_id', rol),
      ])
      if (!actueel) return
      setGegevens({
        userId,
        weergavenaam: (profiel.data?.weergavenaam as string | undefined) ?? null,
        rolNaam: (rolRij.data?.naam as string | undefined) ?? null,
        rechten: new Set((rechten.data ?? []).map((r) => r.permission_id as string)),
      })
    })()
    return () => {
      actueel = false
    }
  }, [client, userId, rol])

  // Gegevens van een vorige gebruiker nooit tonen.
  const huidig = gegevens?.userId === userId ? gegevens : null
  const waarde: Rechten = {
    laden: huidig === null,
    weergavenaam: huidig?.weergavenaam ?? null,
    rolNaam: huidig?.rolNaam ?? null,
    heeftRecht: (recht) => huidig?.rechten.has(recht) ?? false,
  }

  return <RechtenContext value={waarde}>{children}</RechtenContext>
}
