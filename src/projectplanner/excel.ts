/**
 * Leest een .xlsx-bestand in de browser, zonder extra pakketten: een xlsx is
 * een zip met XML. Uitpakken gaat met DecompressionStream ('deflate-raw'), de
 * XML is eenvoudig genoeg voor reguliere expressies. Het bestand verlaat de
 * computer niet; alleen wat de gebruiker daarna kiest, gaat naar de database.
 */

export type Celwaarde = string | number | boolean

export interface Werkblad {
  naam: string
  /** Op celadres, bijv. "B6". Lege cellen ontbreken. */
  cellen: Map<string, Celwaarde>
  /** Samengevoegde bereiken, bijv. "A6:A21". */
  samengevoegd: string[]
}

// -----------------------------------------------------------------------------
// Zip
// -----------------------------------------------------------------------------

/** Pakt de bestanden uit een zip uit als tekst. Met `filter` alleen de gevraagde. */
export async function leesZip(buffer: ArrayBuffer, filter: (naam: string) => boolean = () => true): Promise<Map<string, string>> {
  const data = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  // End of central directory: zoek vanaf het eind (er kan een commentaar achter staan).
  let eind = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (data.getUint32(i, true) === 0x06054b50) {
      eind = i
      break
    }
  }
  if (eind < 0) throw new Error('Dit is geen Excel-bestand (.xlsx).')

  const aantal = data.getUint16(eind + 10, true)
  let positie = data.getUint32(eind + 16, true)
  const tekst = new TextDecoder()
  const bestanden = new Map<string, string>()

  for (let n = 0; n < aantal; n++) {
    if (data.getUint32(positie, true) !== 0x02014b50) throw new Error('Het Excel-bestand is beschadigd.')
    const methode = data.getUint16(positie + 10, true)
    const gecomprimeerd = data.getUint32(positie + 20, true)
    const naamLengte = data.getUint16(positie + 28, true)
    const extraLengte = data.getUint16(positie + 30, true)
    const commentaarLengte = data.getUint16(positie + 32, true)
    const lokaal = data.getUint32(positie + 42, true)
    const naam = tekst.decode(bytes.subarray(positie + 46, positie + 46 + naamLengte))
    positie += 46 + naamLengte + extraLengte + commentaarLengte

    if (!filter(naam)) continue
    const start = lokaal + 30 + data.getUint16(lokaal + 26, true) + data.getUint16(lokaal + 28, true)
    const inhoud = bytes.slice(start, start + gecomprimeerd)
    if (methode === 0) bestanden.set(naam, tekst.decode(inhoud))
    else if (methode === 8) {
      const stroom = new Blob([inhoud]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
      bestanden.set(naam, await new Response(stroom).text())
    } else throw new Error('Dit Excel-bestand gebruikt een onbekende compressie.')
  }
  return bestanden
}

// -----------------------------------------------------------------------------
// XML
// -----------------------------------------------------------------------------

const ENTITEITEN: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

export function ontsnap(tekst: string): string {
  return tekst.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (geheel, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) return String.fromCodePoint(parseInt(code.slice(2), 16))
    if (code.startsWith('#')) return String.fromCodePoint(parseInt(code.slice(1), 10))
    return ENTITEITEN[code] ?? geheel
  })
}

function attributen(tag: string): Record<string, string> {
  const uit: Record<string, string> = {}
  for (const m of tag.matchAll(/([\w:]+)="([^"]*)"/g)) uit[m[1] as string] = ontsnap(m[2] as string)
  return uit
}

/** De tekst van alle <t>-elementen samen (rich text bestaat uit meerdere runs). */
function tekstVan(xml: string): string {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => ontsnap(m[1] as string)).join('')
}

export function leesGedeeldeTeksten(xml: string): string[] {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => tekstVan(m[1] as string))
}

export function leesWerkbladXml(naam: string, xml: string, gedeeld: readonly string[]): Werkblad {
  const cellen = new Map<string, Celwaarde>()
  for (const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attr = attributen(m[1] as string)
    const inhoud = m[2] ?? ''
    const adres = attr.r
    if (!adres) continue
    const v = /<v>([\s\S]*?)<\/v>/.exec(inhoud)?.[1]
    let waarde: Celwaarde | undefined
    switch (attr.t) {
      case 's':
        waarde = v === undefined ? undefined : gedeeld[Number(v)]
        break
      case 'inlineStr':
        waarde = tekstVan(inhoud)
        break
      case 'str':
        waarde = v === undefined ? undefined : ontsnap(v)
        break
      case 'b':
        waarde = v === '1'
        break
      case 'e':
        waarde = undefined
        break
      default:
        waarde = v === undefined ? undefined : Number(v)
    }
    if (waarde !== undefined && waarde !== '') cellen.set(adres, waarde)
  }
  const samengevoegd = [...xml.matchAll(/<mergeCell\b[^>]*ref="([A-Z]+\d+:[A-Z]+\d+)"/g)].map((m) => m[1] as string)
  return { naam, cellen, samengevoegd }
}

/** Alle werkbladen van een .xlsx, in de volgorde van het werkboek. */
export async function leesWerkboek(buffer: ArrayBuffer): Promise<Werkblad[]> {
  const bestanden = await leesZip(buffer, (naam) => naam.startsWith('xl/') && (naam.endsWith('.xml') || naam.endsWith('.rels')))
  const werkboek = bestanden.get('xl/workbook.xml')
  const relaties = bestanden.get('xl/_rels/workbook.xml.rels')
  if (!werkboek || !relaties) throw new Error('Dit is geen Excel-bestand (.xlsx).')

  const doelen = new Map<string, string>()
  for (const m of relaties.matchAll(/<Relationship\b[^>]*>/g)) {
    const a = attributen(m[0])
    if (a.Id && a.Target) doelen.set(a.Id, a.Target.startsWith('/') ? a.Target.slice(1) : `xl/${a.Target}`)
  }
  const gedeeld = leesGedeeldeTeksten(bestanden.get('xl/sharedStrings.xml') ?? '')

  const bladen: Werkblad[] = []
  for (const m of werkboek.matchAll(/<sheet\b[^>]*>/g)) {
    const a = attributen(m[0])
    const pad = doelen.get(a['r:id'] ?? '')
    const xml = pad ? bestanden.get(pad) : undefined
    if (a.name && xml) bladen.push(leesWerkbladXml(a.name, xml, gedeeld))
  }
  return bladen
}

// -----------------------------------------------------------------------------
// Celadressen
// -----------------------------------------------------------------------------

/** "BK" → 63 (A = 1). */
export function kolomNummer(letters: string): number {
  return [...letters].reduce((n, l) => n * 26 + (l.charCodeAt(0) - 64), 0)
}

/** 63 → "BK". */
export function kolomLetters(nummer: number): string {
  let uit = ''
  for (let n = nummer; n > 0; n = Math.floor((n - 1) / 26)) uit = String.fromCharCode(65 + ((n - 1) % 26)) + uit
  return uit
}

export function splitsAdres(adres: string): { kolom: number; rij: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(adres)
  if (!m) throw new Error(`Ongeldig celadres ${adres}`)
  return { kolom: kolomNummer(m[1] as string), rij: Number(m[2]) }
}

/** Excel-datum (dagnummer) als ISO-datum: 46645 → "2027-09-15". */
export function excelDatum(serieel: number): string {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serieel) * 86400000).toISOString().slice(0, 10)
}
