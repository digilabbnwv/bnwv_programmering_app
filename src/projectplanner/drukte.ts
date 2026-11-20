import type { Afdeling, Functie, Tak } from '../organisatie/api'
import type { Inzet, InzetFase, ProjectStatus } from './api'
import { deelInJaar, dagen, totaalUren, type Periode, type Projectregel } from './berekening'

/**
 * Rekenregels voor het dashboard van de projectplanner (docs/projectplanner.md,
 * hoofdstuk 7 en 8): uren per functie per week, capaciteit, bezetting,
 * gelijktijdige projecten, tijdlijn, budget per tak en signalen.
 */

// -----------------------------------------------------------------------------
// Weken
// -----------------------------------------------------------------------------

const DAG = 86400000

function utc(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`)
}

/** ISO-week van een datum: { jaar, week }. Week 1 is de week met de eerste donderdag. */
export function isoWeek(iso: string): { jaar: number; week: number } {
  const d = new Date(utc(iso))
  const dag = (d.getUTCDay() + 6) % 7 // maandag = 0
  d.setUTCDate(d.getUTCDate() - dag + 3) // donderdag van deze week
  const jaar = d.getUTCFullYear()
  const eersteDonderdag = new Date(Date.UTC(jaar, 0, 4))
  eersteDonderdag.setUTCDate(eersteDonderdag.getUTCDate() - ((eersteDonderdag.getUTCDay() + 6) % 7) + 3)
  return { jaar, week: 1 + Math.round((d.getTime() - eersteDonderdag.getTime()) / (7 * DAG)) }
}

/** 52 of 53. */
export function wekenInJaar(jaar: number): number {
  return isoWeek(`${jaar}-12-28`).week
}

/**
 * De week van een dag binnen het jaar. Dagen begin januari of eind december die
 * in een week van het vorige of volgende jaar vallen, tellen bij de eerste of
 * laatste week van dit jaar.
 */
export function weekVanDag(iso: string, jaar: number): number {
  const w = isoWeek(iso)
  if (w.jaar < jaar) return 1
  if (w.jaar > jaar) return wekenInJaar(jaar)
  return w.week
}

/** Maandag van een ISO-week, als ISO-datum. */
export function maandagVan(jaar: number, week: number): string {
  const vier = new Date(Date.UTC(jaar, 0, 4))
  const maandag = vier.getTime() - ((vier.getUTCDay() + 6) % 7) * DAG + (week - 1) * 7 * DAG
  return new Date(maandag).toISOString().slice(0, 10)
}

/**
 * Uren van een inzetregel per week (index 0 = week 1). De uren zijn gelijk over
 * de dagen van de periode verdeeld; alleen het deel in het jaar telt.
 */
export function urenPerWeekVan(inzet: Pick<Inzet, 'uren' | 'startdatum' | 'einddatum'>, jaar: number): number[] {
  const weken = new Array<number>(wekenInJaar(jaar)).fill(0)
  const deel = deelInJaar(inzet, jaar)
  if (!deel || inzet.uren === 0) return weken
  const perDag = inzet.uren / dagen(inzet)
  for (let t = utc(deel.startdatum); t <= utc(deel.einddatum); t += DAG) {
    const week = weekVanDag(new Date(t).toISOString().slice(0, 10), jaar)
    weken[week - 1] = (weken[week - 1] ?? 0) + perDag
  }
  return weken
}

// -----------------------------------------------------------------------------
// Selectie
// -----------------------------------------------------------------------------

export type Statuskeuze = 'actief' | 'akkoord'

/** Welke projecten meetellen: akkoord, of akkoord en ingediend. Uitgesteld en afgewezen nooit. */
export function telMee(status: ProjectStatus, keuze: Statuskeuze): boolean {
  return status === 'akkoord' || (keuze === 'actief' && status === 'ingediend')
}

// -----------------------------------------------------------------------------
// Capaciteit en drukte
// -----------------------------------------------------------------------------

export interface Capaciteit {
  /** Uren per jaar die over zijn voor projecten. */
  perJaar: number
  perWeek: number
  medewerkers: number
}

/**
 * Capaciteit per functie: per medewerker met die functie de beschikbare
 * werktijd min scholen, programma-uitvoering en overige taken (projecturen
 * niet, die plannen we juist), opgeteld. Per week = per jaar ÷ werkweken.
 */
export function capaciteitPerFunctie(
  medewerkers: readonly { functie_id: string | null; vrij: number; werkweken: number }[],
): Map<string, Capaciteit> {
  const uit = new Map<string, Capaciteit>()
  for (const m of medewerkers) {
    if (!m.functie_id || m.werkweken <= 0) continue
    const c = uit.get(m.functie_id) ?? { perJaar: 0, perWeek: 0, medewerkers: 0 }
    c.perJaar += Math.max(0, m.vrij)
    c.perWeek += Math.max(0, m.vrij) / m.werkweken
    c.medewerkers += 1
    uit.set(m.functie_id, c)
  }
  return uit
}

export interface Bijdrage {
  projectId: string
  naam: string
  uren: number
}

export interface Functiedrukte {
  functie: Functie
  /** Uren nodig per week (index 0 = week 1). */
  nodig: number[]
  totaal: number
  /** null: capaciteit onbekend (extern, of geen medewerkers met een contract). */
  capaciteit: Capaciteit | null
  /** Nodig ÷ capaciteit per week, of null bij onbekende capaciteit. */
  bezetting: number[] | null
  /** Per week de projecten die uren vragen, grootste eerst. */
  bijdragen: Bijdrage[][]
}

/** Uren per functie per week, voor de projecten die meetellen. Alleen functies met inzet. */
export function drukte(
  regels: readonly Projectregel[],
  functies: readonly Functie[],
  capaciteit: ReadonlyMap<string, Capaciteit>,
  jaar: number,
): Functiedrukte[] {
  const n = wekenInJaar(jaar)
  const perFunctie = new Map<string, { nodig: number[]; bijdragen: Map<string, Bijdrage>[] }>()
  for (const r of regels) {
    for (const i of r.inzet) {
      const f = perFunctie.get(i.functie_id) ?? {
        nodig: new Array<number>(n).fill(0),
        bijdragen: Array.from({ length: n }, () => new Map<string, Bijdrage>()),
      }
      urenPerWeekVan(i, jaar).forEach((uren, w) => {
        if (uren <= 0) return
        f.nodig[w] = (f.nodig[w] ?? 0) + uren
        const kaart = f.bijdragen[w] as Map<string, Bijdrage>
        const b = kaart.get(r.project.id) ?? { projectId: r.project.id, naam: r.project.naam, uren: 0 }
        b.uren += uren
        kaart.set(r.project.id, b)
      })
      perFunctie.set(i.functie_id, f)
    }
  }

  return functies
    .filter((f) => perFunctie.has(f.id))
    .map((functie) => {
      const f = perFunctie.get(functie.id) as { nodig: number[]; bijdragen: Map<string, Bijdrage>[] }
      const cap = functie.extern ? null : (capaciteit.get(functie.id) ?? null)
      const bekend = cap && cap.perWeek > 0 ? cap : null
      return {
        functie,
        nodig: f.nodig,
        totaal: f.nodig.reduce((a, b) => a + b, 0),
        capaciteit: bekend,
        bezetting: bekend ? f.nodig.map((u) => u / bekend.perWeek) : null,
        bijdragen: f.bijdragen.map((k) => [...k.values()].sort((a, b) => b.uren - a.uren)),
      }
    })
}

/** De drukste week: hoogste bezetting, of bij onbekende capaciteit de meeste uren. */
export function drukstWeek(d: Functiedrukte): { week: number; uren: number; bezetting: number | null } {
  const reeks = d.bezetting ?? d.nodig
  let index = 0
  reeks.forEach((v, i) => {
    if (v > (reeks[index] ?? 0)) index = i
  })
  return { week: index + 1, uren: d.nodig[index] ?? 0, bezetting: d.bezetting?.[index] ?? null }
}

/** Weken boven 100% bezetting. */
export function wekenTeVol(d: Functiedrukte): number[] {
  return (d.bezetting ?? []).flatMap((b, i) => (b > 1.0005 ? [i + 1] : []))
}

/**
 * Stap op de kleurschaal (0 = leeg, 1–4 = steeds voller, 5 = te vol). Bij
 * onbekende capaciteit ten opzichte van de drukste week, en nooit "te vol".
 */
export function stap(d: Functiedrukte, weekIndex: number): 0 | 1 | 2 | 3 | 4 | 5 {
  const uren = d.nodig[weekIndex] ?? 0
  if (uren <= 0.005) return 0
  const deel = d.bezetting ? (d.bezetting[weekIndex] ?? 0) : uren / Math.max(...d.nodig)
  if (d.bezetting && deel > 1.0005) return 5
  if (deel <= 0.25) return 1
  if (deel <= 0.5) return 2
  if (deel <= 0.75) return 3
  return 4
}

/** Per week het aantal projecten met uitvoering in die week (index 0 = week 1). */
export function projectenInUitvoering(regels: readonly Projectregel[], jaar: number): number[] {
  const n = wekenInJaar(jaar)
  const uit = new Array<number>(n).fill(0)
  for (const r of regels) {
    const weken = new Set<number>()
    for (const i of r.inzet) {
      if (i.fase !== 'uitvoering') continue
      urenPerWeekVan({ ...i, uren: 1 }, jaar).forEach((u, w) => {
        if (u > 0) weken.add(w)
      })
    }
    for (const w of weken) uit[w] = (uit[w] ?? 0) + 1
  }
  return uit
}

// -----------------------------------------------------------------------------
// Tijdlijn
// -----------------------------------------------------------------------------

export interface Tijdlijnregel {
  regel: Projectregel
  /** Looptijd binnen het jaar. */
  looptijd: Periode
  fases: { fase: InzetFase; periode: Periode }[]
}

/** Per project: de looptijd in het jaar en per fase de periode van eerste tot laatste inzet. */
export function tijdlijn(regels: readonly Projectregel[], jaar: number): Tijdlijnregel[] {
  return regels.flatMap((regel) => {
    const looptijd = deelInJaar(regel.project, jaar)
    if (!looptijd) return []
    const fases = (['voorbereiding', 'uitvoering'] as const).flatMap((fase) => {
      const delen = regel.inzet.filter((i) => i.fase === fase).flatMap((i) => deelInJaar(i, jaar) ?? [])
      if (delen.length === 0) return []
      const startdatum = delen.map((d) => d.startdatum).sort()[0] as string
      const einddatum = delen.map((d) => d.einddatum).sort().at(-1) as string
      return [{ fase, periode: { startdatum, einddatum } }]
    })
    return [{ regel, looptijd, fases }]
  })
}

/** Positie in het jaar als percentage (0–100) van het begin van de dag. */
export function positieInJaar(iso: string, jaar: number): number {
  const start = utc(`${jaar}-01-01`)
  const eind = utc(`${jaar + 1}-01-01`)
  return ((utc(iso) - start) / (eind - start)) * 100
}

// -----------------------------------------------------------------------------
// Budget
// -----------------------------------------------------------------------------

export interface Budgetregel {
  afdeling: Afdeling
  /** null: projecten zonder tak. */
  tak: Tak | null
  projecten: number
  akkoord: number
  ingediend: number
  zonderBudget: number
  zonderInzet: number
  uren: number
}

/** Budget en uren per afdeling en tak. Uitgesteld en afgewezen tellen niet mee. */
export function budgetPerTak(regels: readonly Projectregel[], afdelingen: readonly Afdeling[], takken: readonly Tak[]): Budgetregel[] {
  const uit: Budgetregel[] = []
  for (const afdeling of [...afdelingen].sort((a, b) => a.volgorde - b.volgorde)) {
    const vanAfdeling = regels.filter((r) => r.project.afdeling_id === afdeling.id && telMee(r.projectjaar.status, 'actief'))
    const groepen = new Map<string, Projectregel[]>()
    for (const r of vanAfdeling) groepen.set(r.project.tak_id ?? '', [...(groepen.get(r.project.tak_id ?? '') ?? []), r])
    const namen = (id: string) => takken.find((t) => t.id === id)?.naam ?? ''
    const volgorde = [...groepen.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : namen(a).localeCompare(namen(b), 'nl')))
    for (const takId of volgorde) {
      const lijst = groepen.get(takId) as Projectregel[]
      const bedrag = (status: ProjectStatus) =>
        lijst.filter((r) => r.projectjaar.status === status).reduce((s, r) => s + (r.projectjaar.budget ?? 0), 0)
      uit.push({
        afdeling,
        tak: takken.find((t) => t.id === takId) ?? null,
        projecten: lijst.length,
        akkoord: bedrag('akkoord'),
        ingediend: bedrag('ingediend'),
        zonderBudget: lijst.filter((r) => r.projectjaar.budget === null).length,
        zonderInzet: lijst.filter((r) => r.inzet.length === 0).length,
        uren: lijst.reduce((s, r) => s + totaalUren(r.inzet), 0),
      })
    }
  }
  return uit
}

// -----------------------------------------------------------------------------
// Signalen
// -----------------------------------------------------------------------------

export type Plansignaal =
  | { soort: 'geen-werkjaar'; jaar: number }
  | { soort: 'te-vol'; functie: Functie; weken: number[]; hoogste: number }
  | { soort: 'capaciteit-onbekend'; functie: Functie; uren: number }
  | { soort: 'geen-inzet'; regel: Projectregel }
  | { soort: 'geen-budget'; regel: Projectregel }
  | { soort: 'inactieve-functie'; functie: Functie; regels: Projectregel[] }

export function plansignalen(
  regels: readonly Projectregel[],
  d: readonly Functiedrukte[],
  opties: { jaar: number; werkjaarBekend: boolean; capaciteitBekend: boolean },
): Plansignaal[] {
  const uit: Plansignaal[] = []
  if (!opties.werkjaarBekend) uit.push({ soort: 'geen-werkjaar', jaar: opties.jaar })
  for (const f of d) {
    const weken = wekenTeVol(f)
    if (weken.length > 0) uit.push({ soort: 'te-vol', functie: f.functie, weken, hoogste: Math.max(...(f.bezetting ?? [0])) })
    if (!f.capaciteit && !f.functie.extern && opties.capaciteitBekend && opties.werkjaarBekend) {
      uit.push({ soort: 'capaciteit-onbekend', functie: f.functie, uren: f.totaal })
    }
    if (!f.functie.actief) {
      uit.push({ soort: 'inactieve-functie', functie: f.functie, regels: regels.filter((r) => r.inzet.some((i) => i.functie_id === f.functie.id)) })
    }
  }
  for (const r of regels) {
    if (r.inzet.length === 0) uit.push({ soort: 'geen-inzet', regel: r })
    if (r.projectjaar.budget === null) uit.push({ soort: 'geen-budget', regel: r })
  }
  return uit
}
