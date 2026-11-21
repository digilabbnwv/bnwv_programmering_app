/**
 * Eén jaarkeuze voor de hele app (docs/navigatie.md, hoofdstuk 3). Het jaar
 * staat in de URL (?jaar=), zodat een gedeelde link hetzelfde jaar toont, en
 * de browser onthoudt de laatste keuze. Zonder beide: het huidige jaar.
 */

const SLEUTEL = 'bnwv.jaar'

/** Een jaar uit tekst, of null als het geen redelijk jaar is. */
export function leesJaar(tekst: string | null | undefined): number | null {
  if (!tekst || !/^\d{4}$/.test(tekst)) return null
  const jaar = Number(tekst)
  return jaar >= 2000 && jaar <= 2100 ? jaar : null
}

/** Het jaar uit de URL, anders het onthouden jaar, anders het huidige jaar. */
export function bepaalJaar(uitUrl: string | null, onthouden: string | null, nu: number): number {
  return leesJaar(uitUrl) ?? leesJaar(onthouden) ?? nu
}

/**
 * De jaren in de keuzelijst: waarvoor een werkjaar of jaarplan bestaat, plus
 * het huidige en het gekozen jaar, zodat de lijst nooit leeg is en de keuze er
 * altijd in staat.
 */
export function jarenInKeuze(bekend: readonly number[], nu: number, gekozen: number): number[] {
  return [...new Set([...bekend, nu, gekozen])].sort((a, b) => a - b)
}

export function leesOnthouden(): string | null {
  try {
    return localStorage.getItem(SLEUTEL)
  } catch {
    return null
  }
}

export function onthoud(jaar: number): void {
  try {
    localStorage.setItem(SLEUTEL, String(jaar))
  } catch {
    // Geen opslag (privévenster): de keuze blijft in de URL staan.
  }
}
