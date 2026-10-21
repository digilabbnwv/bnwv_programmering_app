/**
 * Automatisch uitloggen na inactiviteit. Het tijdstip van de laatste
 * activiteit staat in localStorage, zodat alle tabbladen samen één timer
 * hebben en een sessie na het sluiten van de browser niet stilletjes doorloopt.
 */
export const ACTIVITEIT_SLEUTEL = 'bnwv.laatsteActiviteit'

/** Hoe lang vóór het uitloggen de waarschuwing verschijnt. */
export const WAARSCHUWING_MS = 2 * 60 * 1000

export type InactiviteitStatus =
  | { soort: 'actief' }
  | { soort: 'waarschuwing'; resterendMs: number }
  | { soort: 'verlopen' }

export function leesLaatsteActiviteit(opslag: Pick<Storage, 'getItem'>): number | null {
  const waarde = Number(opslag.getItem(ACTIVITEIT_SLEUTEL))
  return Number.isFinite(waarde) && waarde > 0 ? waarde : null
}

export function registreerActiviteit(opslag: Pick<Storage, 'setItem'>, nu = Date.now()): void {
  opslag.setItem(ACTIVITEIT_SLEUTEL, String(nu))
}

/**
 * Geen bekend tijdstip telt als verlopen: dan is de sessie van vóór deze
 * controle, of is de opslag gewist.
 */
export function bepaalInactiviteit(
  laatsteActiviteit: number | null,
  nu: number,
  timeoutMs: number,
): InactiviteitStatus {
  if (laatsteActiviteit === null) return { soort: 'verlopen' }
  const resterendMs = laatsteActiviteit + timeoutMs - nu
  if (resterendMs <= 0) return { soort: 'verlopen' }
  if (resterendMs <= WAARSCHUWING_MS) return { soort: 'waarschuwing', resterendMs }
  return { soort: 'actief' }
}
