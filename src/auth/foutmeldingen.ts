/**
 * Vaste Nederlandse teksten voor fouten van Supabase Auth. Teksten van de
 * server tonen we niet: die zijn Engels en kunnen te veel prijsgeven.
 */
interface AuthFoutLike {
  code?: string
  status?: number
}

export function inlogFout(fout: AuthFoutLike): string {
  if (fout.code === 'invalid_credentials') return 'E-mailadres of wachtwoord klopt niet.'
  if (fout.status === 429) return 'Te veel pogingen. Wacht een paar minuten en probeer het opnieuw.'
  // De access token hook weigert gedeactiveerde accounts met 403.
  if (fout.status === 403) return 'Dit account is niet actief. Neem contact op met een beheerder.'
  return 'Inloggen lukt nu niet. Probeer het later opnieuw.'
}

export function codeFout(fout: AuthFoutLike): string {
  if (fout.code === 'mfa_verification_failed' || fout.code === 'mfa_challenge_expired') {
    return 'De code klopt niet. Gebruik de nieuwste code uit je app.'
  }
  if (fout.status === 429) return 'Te veel pogingen. Wacht een paar minuten en probeer het opnieuw.'
  return 'Controleren lukt nu niet. Probeer het later opnieuw.'
}

/** Een TOTP-code is precies 6 cijfers; spaties uit het plakken halen we weg. */
export function normaliseerCode(invoer: string): string | null {
  const code = invoer.replace(/\s/g, '')
  return /^\d{6}$/.test(code) ? code : null
}
