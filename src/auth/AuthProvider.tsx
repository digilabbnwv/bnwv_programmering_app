import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { SESSIE_SLEUTEL } from '../lib/supabase'
import { bepaalStap, leesClaims, type AuthStap, type TokenClaims } from './stap'
import { InactiviteitBewaker } from './InactiviteitBewaker'

interface AuthState {
  client: SupabaseClient
  laden: boolean
  session: Session | null
  claims: TokenClaims | null
  stap: AuthStap
  /** Melding voor het inlogscherm, bijv. na automatisch uitloggen. */
  melding: string | null
  uitloggen: (melding?: string) => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

const MELDING_SLEUTEL = 'bnwv.uitlogMelding'

function leesBewaardeMelding(): string | null {
  const melding = sessionStorage.getItem(MELDING_SLEUTEL)
  sessionStorage.removeItem(MELDING_SLEUTEL)
  return melding
}

export function useAuth(): AuthState {
  const auth = use(AuthContext)
  if (!auth) throw new Error('useAuth buiten AuthProvider')
  return auth
}

export function AuthProvider({
  client,
  idleTimeoutMinutes,
  children,
}: {
  client: SupabaseClient
  idleTimeoutMinutes: number
  children: ReactNode
}) {
  // undefined: de opgeslagen sessie is nog niet gelezen.
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [melding, setMelding] = useState<string | null>(leesBewaardeMelding)

  useEffect(() => {
    // Geen Supabase-aanroepen in deze callback: die wachten op elkaar.
    const { data } = client.auth.onAuthStateChange((_event, nieuweSessie) => {
      setSession(nieuweSessie)
      // Een sessie met onbruikbare claims (bijv. zonder rol) direct beëindigen,
      // buiten de callback om.
      if (nieuweSessie && !leesClaims(nieuweSessie.access_token).user_role) {
        setTimeout(() => void client.auth.signOut({ scope: 'local' }), 0)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [client])

  const uitloggen = useCallback(
    async (nieuweMelding?: string) => {
      setMelding(nieuweMelding ?? null)
      const { error } = await client.auth.signOut({ scope: 'local' })
      if (error) {
        // Bijv. geen netwerk: de sessie in deze browser hoe dan ook wissen en
        // opnieuw laden, zodat de client hem ook niet meer ververst.
        localStorage.removeItem(SESSIE_SLEUTEL)
        if (nieuweMelding) sessionStorage.setItem(MELDING_SLEUTEL, nieuweMelding)
        window.location.reload()
      }
    },
    [client],
  )

  const claims = useMemo(() => (session ? leesClaims(session.access_token) : null), [session])
  const heeftGeverifieerdeFactor =
    session?.user.factors?.some((f) => f.factor_type === 'totp' && f.status === 'verified') ?? false
  const stap = bepaalStap({ claims, heeftGeverifieerdeFactor })

  const waarde = useMemo<AuthState>(
    () => ({
      client,
      laden: session === undefined,
      session: session ?? null,
      claims,
      stap,
      melding,
      uitloggen,
    }),
    [client, session, claims, stap, melding, uitloggen],
  )

  return (
    <AuthContext value={waarde}>
      {session && <InactiviteitBewaker timeoutMinutes={idleTimeoutMinutes} />}
      {children}
    </AuthContext>
  )
}
