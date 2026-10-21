/**
 * Bepaalt welke stap van de inlogflow de gebruiker moet doen. Dit is alleen
 * UX: de database (RLS) dwingt AAL2, een actief account en een definitief
 * wachtwoord zelf af.
 */
export type AuthStap =
  | 'inloggen'
  | '2fa-instellen'
  | '2fa-controleren'
  | 'wachtwoord-wijzigen'
  | 'klaar'

export interface TokenClaims {
  sub?: string
  aal?: string
  user_role?: string
  is_active?: boolean
  must_change_password?: boolean
}

/** Leest de claims uit een JWT zonder de handtekening te controleren (alleen voor UX). */
export function leesClaims(accessToken: string): TokenClaims {
  const payload = accessToken.split('.')[1]
  if (!payload) return {}
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const data: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return typeof data === 'object' && data !== null ? (data as TokenClaims) : {}
  } catch {
    return {}
  }
}

export function bepaalStap(input: {
  claims: TokenClaims | null
  heeftGeverifieerdeFactor: boolean
}): AuthStap {
  const { claims, heeftGeverifieerdeFactor } = input
  if (!claims?.sub || !claims.user_role || claims.is_active !== true) return 'inloggen'
  if (claims.aal !== 'aal2') {
    return heeftGeverifieerdeFactor ? '2fa-controleren' : '2fa-instellen'
  }
  // Ontbreekt de claim, dan liever te streng: wachtwoord laten wijzigen.
  if (claims.must_change_password !== false) return 'wachtwoord-wijzigen'
  return 'klaar'
}
