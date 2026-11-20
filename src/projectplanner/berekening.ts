import type { Inzet, Project, Projectjaar, ProjectStatus } from './api'

/** Rekenregels van de projectplanner (zie docs/projectplanner.md). */

export interface Periode {
  startdatum: string
  einddatum: string
}

/** 1 januari t/m 31 december van het jaar. */
export function jaarPeriode(jaar: number): Periode {
  return { startdatum: `${jaar}-01-01`, einddatum: `${jaar}-12-31` }
}

/** Het deel van de looptijd dat in het jaar valt, of null als er niets overlapt. */
export function deelInJaar(project: Periode, jaar: number): Periode | null {
  const j = jaarPeriode(jaar)
  const startdatum = project.startdatum > j.startdatum ? project.startdatum : j.startdatum
  const einddatum = project.einddatum < j.einddatum ? project.einddatum : j.einddatum
  return startdatum <= einddatum ? { startdatum, einddatum } : null
}

/** De jaren waarin het project loopt. */
export function jarenVan(project: Periode): number[] {
  const van = Number(project.startdatum.slice(0, 4))
  const tot = Number(project.einddatum.slice(0, 4))
  return Array.from({ length: Math.max(0, tot - van + 1) }, (_, i) => van + i)
}

/** Ligt de periode binnen de grenzen? Datums inclusief. */
export function binnen(periode: Periode, grenzen: Periode): boolean {
  return periode.startdatum >= grenzen.startdatum && periode.einddatum <= grenzen.einddatum
}

const DAG = 24 * 60 * 60 * 1000

/** Aantal dagen van start t/m eind. */
export function dagen(periode: Periode): number {
  return Math.round((Date.parse(`${periode.einddatum}T00:00:00Z`) - Date.parse(`${periode.startdatum}T00:00:00Z`)) / DAG) + 1
}

/** Uren per week als de uren gelijk over de periode verdeeld worden. */
export function urenPerWeek(inzet: Pick<Inzet, 'uren' | 'startdatum' | 'einddatum'>): number {
  return (inzet.uren / dagen(inzet)) * 7
}

/** Uren per collega. */
export function urenPerPersoon(inzet: Pick<Inzet, 'uren' | 'aantal_collegas'>): number {
  return inzet.uren / Math.max(1, inzet.aantal_collegas)
}

export function totaalUren(inzet: readonly Pick<Inzet, 'uren'>[]): number {
  return inzet.reduce((som, i) => som + i.uren, 0)
}

/** Een regel in de projectenlijst van een jaarplan. */
export interface Projectregel {
  project: Project
  projectjaar: Projectjaar
  inzet: Inzet[]
}

/** Alle projecten in het jaarplan, met hun projectjaar en inzet van dat jaar. */
export function projectregels(
  jaar: number,
  projecten: readonly Project[],
  projectjaren: readonly Projectjaar[],
  inzet: readonly Inzet[],
): Projectregel[] {
  const perId = new Map(projecten.map((p) => [p.id, p]))
  return projectjaren
    .filter((j) => j.jaar === jaar)
    .flatMap((projectjaar) => {
      const project = perId.get(projectjaar.project_id)
      return project ? [{ project, projectjaar, inzet: inzet.filter((i) => i.projectjaar_id === projectjaar.id) }] : []
    })
    .sort((a, b) => a.project.naam.localeCompare(b.project.naam, 'nl'))
}

export interface Filter {
  afdelingId: string
  takId: string
  status: ProjectStatus | ''
  functieId: string
}

export const GEEN_FILTER: Filter = { afdelingId: '', takId: '', status: '', functieId: '' }

/** Filtert op afdeling, tak, status en functie (een project met inzet van die functie). Leeg = alles. */
export function filterRegels(regels: readonly Projectregel[], filter: Filter): Projectregel[] {
  return regels.filter(
    (r) =>
      (!filter.afdelingId || r.project.afdeling_id === filter.afdelingId) &&
      (!filter.takId || r.project.tak_id === filter.takId) &&
      (!filter.status || r.projectjaar.status === filter.status) &&
      (!filter.functieId || r.inzet.some((i) => i.functie_id === filter.functieId)),
  )
}

export interface Kengetallen {
  aantal: number
  perStatus: Record<ProjectStatus, number>
  /** Som van de bekende budgetten, zonder afgewezen projecten. */
  budget: number
  zonderBudget: number
  /** Som van de uren, zonder afgewezen projecten. */
  uren: number
  zonderInzet: number
}

export function kengetallen(regels: readonly Projectregel[]): Kengetallen {
  const perStatus: Record<ProjectStatus, number> = { ingediend: 0, akkoord: 0, afgewezen: 0, uitgesteld: 0 }
  let budget = 0
  let zonderBudget = 0
  let uren = 0
  let zonderInzet = 0
  for (const r of regels) {
    perStatus[r.projectjaar.status] += 1
    if (r.projectjaar.status === 'afgewezen') continue
    if (r.projectjaar.budget === null) zonderBudget += 1
    else budget += r.projectjaar.budget
    if (r.inzet.length === 0) zonderInzet += 1
    uren += totaalUren(r.inzet)
  }
  return { aantal: regels.length, perStatus, budget, zonderBudget, uren, zonderInzet }
}

/**
 * Bedrag uit een invoerveld: "2500", "2.500", "€ 2.500,50" of "12.5".
 * Met een komma zijn punten duizendtallen; zonder komma alleen in de vorm
 * 1.234 of 1.234.567. Leeg of ongeldig: null.
 */
export function leesBedrag(invoer: string): number | null {
  let tekst = invoer.replace(/[€\s]/g, '')
  if (tekst.includes(',')) tekst = tekst.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(tekst)) tekst = tekst.replace(/\./g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(tekst)) return null
  return Number(tekst)
}

const euroHeel =new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const euroCenten = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

/** € 2.500, € 12,50 of "onbekend". */
export function formatEuro(bedrag: number | null): string {
  if (bedrag === null) return 'onbekend'
  return Number.isInteger(bedrag) ? euroHeel.format(bedrag) : euroCenten.format(bedrag)
}
