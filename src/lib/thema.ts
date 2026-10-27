/**
 * Licht of donker. Standaard volgt de app de systeeminstelling (CSS
 * prefers-color-scheme); kiest iemand licht of donker, dan staat dat als
 * data-thema op <html> en bewaart de browser de keuze. Alleen een gemak:
 * zonder opslag (privévenster) werkt de app gewoon met de systeeminstelling.
 */

export type Thema = 'systeem' | 'licht' | 'donker'

export const THEMAS: readonly { waarde: Thema; label: string }[] = [
  { waarde: 'systeem', label: 'Systeem' },
  { waarde: 'licht', label: 'Licht' },
  { waarde: 'donker', label: 'Donker' },
]

const SLEUTEL = 'bnwv.thema'

export function leesThema(): Thema {
  try {
    const waarde = localStorage.getItem(SLEUTEL)
    return waarde === 'licht' || waarde === 'donker' ? waarde : 'systeem'
  } catch {
    return 'systeem'
  }
}

/** Zet het thema op de pagina en onthoudt de keuze. */
export function zetThema(thema: Thema): void {
  pasToe(thema)
  try {
    if (thema === 'systeem') localStorage.removeItem(SLEUTEL)
    else localStorage.setItem(SLEUTEL, thema)
  } catch {
    // Geen opslag: de keuze geldt tot de pagina sluit.
  }
}

/** Bij het starten van de app: de bewaarde keuze toepassen. */
export function pasToe(thema: Thema = leesThema()): void {
  if (thema === 'systeem') delete document.documentElement.dataset.thema
  else document.documentElement.dataset.thema = thema
}
