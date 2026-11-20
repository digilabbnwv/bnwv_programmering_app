import type { Afdeling, Tak } from '../organisatie/api'
import type { Programma } from '../werkbelasting/api'
import { excelDatum, kolomLetters, splitsAdres, type Celwaarde, type Werkblad } from './excel'

/**
 * Importvoorstel uit de projectplanner-Excel (zie docs/projectplanner.md,
 * "Schaduwdraaien"). Per afdelingstabblad worden de projectrijen gelezen, rijen
 * van één project samengevoegd en programma's herkend. De gebruiker kiest
 * daarna wat er overgenomen wordt.
 */

export interface Voorstel {
  sleutel: string
  naam: string
  afdeling: Afdeling
  takNaam: string
  tak: Tak | null
  /** Programma met precies deze naam: standaard niet overnemen. */
  isProgramma: boolean
  /** Programma waar het project bij hoort (naam begint met de programmanaam). */
  programma: Programma | null
  budget: number | null
  /** Som van het weekraster. */
  weekuren: number
  zonderUren: boolean
  /** De oorspronkelijke rijen, bijv. "Kinderboekenweek programmering (rij 19)". */
  rijen: string[]
  inzetVan: string[]
  /** Overige gegevens uit de Excel, als tekst voor de toelichting. */
  details: string[]
  /** Namen van andere voorstellen die op hetzelfde project lijken. */
  lijktOp: string[]
  overnemen: boolean
}

/** Wat jaarplan_importeren per project verwacht. */
export interface ImportProject {
  naam: string
  afdeling: string
  tak: string | null
  programma: string | null
  startdatum: string
  einddatum: string
  budget: number | null
  toelichting: string
}

const KOPPEN = {
  project: /^project$/i,
  budget: /budget/i,
  leden: /projectleden/i,
  begin: /^begin/i,
  duur: /^duur (projectgroep|voorbereiding)/i,
  startUitvoering: /^start uitvoering/i,
  duurUitvoering: /^duur uitvoering/i,
  aantal: /aantal coll/i,
  inzetVan: /^inzet van$/i,
} as const

type Kop = keyof typeof KOPPEN

const LABELS: Partial<Record<Kop, string>> = {
  leden: 'projectleden',
  begin: 'begin',
  duur: 'duur',
  startUitvoering: 'start uitvoering',
  duurUitvoering: 'duur uitvoering',
  aantal: 'inzet aantal collega’s',
}

/** Naam zonder het deel dat de soort inzet aanduidt: "Kinderboekenweek uitvoering LDV" → "Kinderboekenweek". */
export function basisnaam(naam: string): string {
  return naam
    .trim()
    .replace(/^ondersteuning\s+/i, '')
    .replace(/\s+(uitvoering\s+)?(LDV|PROG|programmering|STAF|LMC|BM|CL|BV)$/i, '')
    .trim()
}

const normaal = (tekst: string) => tekst.trim().toLocaleLowerCase('nl')

function alsTekst(waarde: Celwaarde | undefined): string {
  if (waarde === undefined) return ''
  if (typeof waarde === 'number') return waarde > 30000 && waarde < 80000 ? excelDatum(waarde) : String(waarde)
  return String(waarde).trim()
}

export interface Rij {
  rij: number
  naam: string
  takNaam: string
  zonderUren: boolean
  /** Adres van de budgetcel (samengevoegde cellen tellen één keer). */
  budgetcel: string | null
  budget: number | null
  weekuren: number
  inzetVan: string
  details: [string, string][]
  /** Rijen die via een samengevoegde projectcel bij elkaar horen. */
  projectcel: string
}

/** Leest de projectrijen van één afdelingstabblad. */
export function leesRijen(blad: Werkblad): Rij[] {
  const cel = (kolom: number, rij: number) => blad.cellen.get(`${kolomLetters(kolom)}${rij}`)
  const bereiken = blad.samengevoegd.map((b) => {
    const [van, tot] = b.split(':') as [string, string]
    return { van: splitsAdres(van), tot: splitsAdres(tot), adres: van }
  })
  /** Het adres van de cel waar de waarde staat: linksboven als de cel samengevoegd is. */
  const bron = (kolom: number, rij: number) =>
    bereiken.find((b) => kolom >= b.van.kolom && kolom <= b.tot.kolom && rij >= b.van.rij && rij <= b.tot.rij)?.adres ??
    `${kolomLetters(kolom)}${rij}`
  const waarde = (kolom: number, rij: number) => blad.cellen.get(bron(kolom, rij))

  // De kopregel: de rij met "PROJECT".
  let kopRij = 0
  const kolommen: Partial<Record<Kop, number>> = {}
  for (const [adres, w] of blad.cellen) {
    if (typeof w === 'string' && KOPPEN.project.test(w.trim())) {
      kopRij = splitsAdres(adres).rij
      break
    }
  }
  if (!kopRij) return []
  for (const [adres, w] of blad.cellen) {
    const { kolom, rij } = splitsAdres(adres)
    if (rij !== kopRij || typeof w !== 'string') continue
    for (const kop of Object.keys(KOPPEN) as Kop[]) {
      if (kolommen[kop] === undefined && KOPPEN[kop].test(w.trim())) kolommen[kop] = kolom
    }
  }
  const projectKolom = kolommen.project ?? 2
  const takKolom = projectKolom - 1

  // Weekkolommen: in de rij onder de kop staan de weeknummers 1 t/m 53.
  const weekKolommen: number[] = []
  for (const [adres, w] of blad.cellen) {
    const { kolom, rij } = splitsAdres(adres)
    if (rij === kopRij + 1 && typeof w === 'number' && w >= 1 && w <= 53 && kolom > projectKolom) weekKolommen.push(kolom)
  }

  const laatsteRij = Math.max(0, ...[...blad.cellen.keys()].map((a) => splitsAdres(a).rij))
  const weekuren = (r: number) =>
    weekKolommen.reduce((som, k) => {
      const w = cel(k, r)
      return som + (typeof w === 'number' ? w : 0)
    }, 0)
  const inzetVan = (r: number) => (kolommen.inzetVan === undefined ? '' : alsTekst(cel(kolommen.inzetVan, r)))
  const rijen: Rij[] = []
  let takNaam = ''
  let zonderUren = false
  let vorige: Rij | null = null

  for (let r = kopRij + 1; r <= laatsteRij; r++) {
    const tak = alsTekst(waarde(takKolom, r))
    if (tak) takNaam = tak
    // De kop loopt soms over twee rijen (samengevoegd met de weeknummers).
    const naam = splitsAdres(bron(projectKolom, r)).rij <= kopRij ? '' : alsTekst(waarde(projectKolom, r))
    if (!naam) {
      // Een rij zonder projectnaam direct onder een project, met alleen een
      // andere "inzet van" (Staf: Vrijwilligersuitje, LDV + PROG): zelfde project.
      const boven: Rij | null = vorige
      if (boven && boven.rij === r - 1 && (inzetVan(r) || weekuren(r) > 0)) {
        const erbij: Rij = { ...boven, rij: r, inzetVan: inzetVan(r), weekuren: weekuren(r), budget: null, details: [] }
        rijen.push(erbij)
        vorige = erbij
      } else vorige = null
      continue
    }
    if (/^projectbudget$/i.test(naam)) {
      vorige = null
      continue
    }
    if (/^projecten zonder uren$/i.test(naam)) {
      zonderUren = true
      takNaam = ''
      vorige = null
      continue
    }

    const details: [string, string][] = []
    for (const kop of Object.keys(LABELS) as Kop[]) {
      const k = kolommen[kop]
      const t = k === undefined ? '' : alsTekst(waarde(k, r))
      if (t) details.push([LABELS[kop] as string, t])
    }
    const budgetKolom = kolommen.budget
    const budgetWaarde = budgetKolom === undefined ? undefined : waarde(budgetKolom, r)
    vorige = {
      rij: r,
      naam,
      takNaam,
      zonderUren,
      budgetcel: budgetKolom === undefined ? null : bron(budgetKolom, r),
      budget: typeof budgetWaarde === 'number' ? budgetWaarde : null,
      weekuren: weekuren(r),
      inzetVan: inzetVan(r),
      details,
      projectcel: bron(projectKolom, r),
    }
    rijen.push(vorige)
  }
  return rijen
}

/** "Digitaal" past bij Digitaal, en een afkorting als "D. Leeslijn" bij Doorgaande leeslijn. */
export function takPast(uitExcel: string, takNaam: string): boolean {
  const a = normaal(uitExcel)
  const b = normaal(takNaam)
  if (!a) return false
  if (a === b) return true
  const afgekort = /^(\p{L})\.\s*(.+)$/u.exec(a)
  return Boolean(afgekort && b.startsWith(afgekort[1] as string) && b.endsWith(` ${afgekort[2] as string}`))
}

/** Zoekt het afdelingstabblad: op naam of afkorting van de afdeling. */
export function afdelingVan(blad: Werkblad, afdelingen: readonly Afdeling[]): Afdeling | undefined {
  const naam = normaal(blad.naam)
  return afdelingen.find((a) => normaal(a.naam) === naam || (a.afkorting && normaal(a.afkorting) === naam))
}

export function maakVoorstel(
  bladen: readonly Werkblad[],
  afdelingen: readonly Afdeling[],
  takken: readonly Tak[],
  programmas: readonly Programma[],
): Voorstel[] {
  const voorstellen: Voorstel[] = []

  for (const blad of bladen) {
    const afdeling = afdelingVan(blad, afdelingen)
    if (!afdeling) continue

    // Groepeer: dezelfde samengevoegde projectcel, of dezelfde basisnaam in dezelfde sectie.
    const groepen = new Map<string, Rij[]>()
    for (const rij of leesRijen(blad)) {
      const sleutel = `${rij.zonderUren ? 'z' : 'u'}:${normaal(basisnaam(rij.naam))}`
      const viaCel = [...groepen.values()].find((g) => g.some((x) => x.projectcel === rij.projectcel))
      if (viaCel) viaCel.push(rij)
      else groepen.set(sleutel, [...(groepen.get(sleutel) ?? []), rij])
    }

    for (const [sleutel, rijen] of groepen) {
      const eerste = rijen[0] as Rij
      const namen = [...new Set(rijen.map((r) => r.naam))]
      const naam = namen.length > 1 ? basisnaam(eerste.naam) : eerste.naam
      const takNaam = eerste.takNaam
      const exact = programmas.find((p) => normaal(p.naam) === normaal(naam))
      const bijProgramma = exact ?? programmas.find((p) => normaal(naam).startsWith(`${normaal(p.naam)} `)) ?? null
      const budgetcellen = new Map<string, number>()
      for (const r of rijen) if (r.budgetcel && r.budget !== null) budgetcellen.set(r.budgetcel, r.budget)
      const details = new Map<string, Set<string>>()
      for (const r of rijen) for (const [label, t] of r.details) details.set(label, (details.get(label) ?? new Set()).add(t))

      voorstellen.push({
        sleutel: `${afdeling.id}:${sleutel}`,
        naam,
        afdeling,
        takNaam,
        tak: takken.find((t) => t.afdeling_id === afdeling.id && takPast(takNaam, t.naam)) ?? null,
        isProgramma: Boolean(exact),
        programma: bijProgramma,
        budget: budgetcellen.size > 0 ? [...budgetcellen.values()].reduce((a, b) => a + b, 0) : null,
        weekuren: rijen.reduce((som, r) => som + r.weekuren, 0),
        zonderUren: eerste.zonderUren,
        rijen: namen.map(
          (n) => `${n} (${blad.naam}, rij ${rijen.filter((r) => r.naam === n).map((r) => r.rij).join(', ')})`,
        ),
        inzetVan: [...new Set(rijen.map((r) => r.inzetVan).filter(Boolean))],
        details: [...details].map(([label, t]) => `${label}: ${[...t].join(' / ')}`),
        lijktOp: [],
        overnemen: !exact,
      })
    }
  }

  // Mogelijk dubbel: de ene basisnaam zit in de andere (ook over tabbladen heen).
  for (const v of voorstellen) {
    const eigen = normaal(basisnaam(v.naam))
    v.lijktOp = voorstellen
      .filter((w) => {
        if (w === v || w.isProgramma) return false
        const ander = normaal(basisnaam(w.naam))
        return Math.min(eigen.length, ander.length) >= 6 && (eigen.includes(ander) || ander.includes(eigen))
      })
      .map((w) => `${w.naam} (${w.afdeling.afkorting || w.afdeling.naam})`)
  }
  return voorstellen
}

/** De gekozen voorstellen, zoals jaarplan_importeren ze verwacht. */
export function alsImport(voorstellen: readonly Voorstel[], jaar: number): ImportProject[] {
  return voorstellen
    .filter((v) => v.overnemen)
    .map((v) => {
      const regels = [
        `Uit de Excel: ${v.rijen.join('; ')}.`,
        v.zonderUren ? 'In de Excel een project zonder uren.' : '',
        v.inzetVan.length > 0 ? `Inzet van: ${v.inzetVan.join(', ')}.` : '',
        v.weekuren > 0 ? `Weekraster: ${String(v.weekuren).replace('.', ',')} uur.` : '',
        ...v.details.map((d) => `${d.charAt(0).toUpperCase()}${d.slice(1)}.`),
      ].filter(Boolean)
      return {
        naam: v.naam.slice(0, 120),
        afdeling: v.afdeling.afkorting,
        tak: v.tak?.naam ?? null,
        programma: v.programma?.naam ?? null,
        startdatum: `${jaar}-01-01`,
        einddatum: `${jaar}-12-31`,
        budget: v.budget,
        toelichting: regels.join('\n').slice(0, 2000),
      }
    })
}
