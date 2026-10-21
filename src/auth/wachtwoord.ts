/**
 * Wachtwoordeisen. Gelijk houden aan supabase/config.toml (minimum_password_length,
 * password_requirements) en aan de Edge Function wachtwoord-wijzigen.
 */
export const MIN_LENGTE = 12
/** bcrypt gebruikt maar 72 bytes; langer geeft Supabase een fout. */
export const MAX_BYTES = 72

export function wachtwoordProblemen(wachtwoord: string): string[] {
  const problemen: string[] = []
  if (wachtwoord.length < MIN_LENGTE) problemen.push(`minstens ${MIN_LENGTE} tekens`)
  if (new TextEncoder().encode(wachtwoord).length > MAX_BYTES) problemen.push('niet langer dan 72 tekens')
  if (!/[a-z]/.test(wachtwoord)) problemen.push('een kleine letter')
  if (!/[A-Z]/.test(wachtwoord)) problemen.push('een hoofdletter')
  if (!/[0-9]/.test(wachtwoord)) problemen.push('een cijfer')
  return problemen
}
