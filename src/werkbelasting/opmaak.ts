/** Kleine hulpfuncties voor formulieren en weergave van de werkbelasting. */

const datum = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** "2026-10-01" → "1 okt 2026" */
export function formatDatum(iso: string): string {
  return datum.format(new Date(`${iso}T00:00:00Z`))
}

/** "1 jan 2026 – lopend" */
export function formatPeriode(startdatum: string, einddatum: string | null): string {
  return `${formatDatum(startdatum)} – ${einddatum ? formatDatum(einddatum) : 'lopend'}`
}

/** Getal uit een invoerveld; komma of punt als decimaalteken. Leeg of ongeldig: null. */
export function leesGetal(invoer: string): number | null {
  const tekst = invoer.trim().replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(tekst)) return null
  return Number(tekst)
}

/** Getal voor in een invoerveld: 32.5 → "32,5", null → "". */
export function getalAlsTekst(getal: number | null | undefined): string {
  return getal === null || getal === undefined ? '' : String(getal).replace('.', ',')
}

/** Vandaag als ISO-datum (lokale tijd). */
export function vandaag(): string {
  const nu = new Date()
  const mm = String(nu.getMonth() + 1).padStart(2, '0')
  const dd = String(nu.getDate()).padStart(2, '0')
  return `${nu.getFullYear()}-${mm}-${dd}`
}

/** Loopt de periode op de datum? Einddatum is inclusief. */
export function loopt(periode: { startdatum: string; einddatum: string | null }, op = vandaag()): boolean {
  return periode.startdatum <= op && (periode.einddatum === null || periode.einddatum >= op)
}

/** Sorteert op naam volgens Nederlandse regels. */
export function opNaam<T extends { naam: string }>(a: T, b: T): number {
  return a.naam.localeCompare(b.naam, 'nl')
}
