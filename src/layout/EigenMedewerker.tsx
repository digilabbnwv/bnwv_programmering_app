import { createContext, use, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'

/**
 * De medewerker die bij het ingelogde account hoort: een id, null als het
 * account niet gekoppeld is, of undefined zolang het laadt. RLS laat iedereen
 * de eigen rij zien. Voor Mijn werkurenverdeling in het menu en op de pagina.
 */
const EigenMedewerkerContext = createContext<string | null | undefined>(undefined)

export function useEigenMedewerker(): string | null | undefined {
  return use(EigenMedewerkerContext)
}

export function EigenMedewerkerProvider({ children }: { children: ReactNode }) {
  const { client, claims } = useAuth()
  const userId = claims?.sub
  const [gevonden, setGevonden] = useState<{ userId: string; id: string | null } | null>(null)

  useEffect(() => {
    if (!userId) return
    let actueel = true
    void client
      .from('medewerkers')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .then(({ data, error }) => {
        if (!actueel || error) return
        setGevonden({ userId, id: (data?.[0]?.id as string | undefined) ?? null })
      })
    return () => {
      actueel = false
    }
  }, [client, userId])

  // Nooit de medewerker van een vorige gebruiker.
  const id = gevonden && gevonden.userId === userId ? gevonden.id : undefined
  return <EigenMedewerkerContext value={id}>{children}</EigenMedewerkerContext>
}
