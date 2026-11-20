import { describe, expect, it } from 'vitest'
import type { Inzet, Project, Projectjaar } from './api'
import {
  binnen,
  dagen,
  deelInJaar,
  filterRegels,
  formatEuro,
  GEEN_FILTER,
  jarenVan,
  kengetallen,
  leesBedrag,
  projectregels,
  urenPerPersoon,
  urenPerWeek,
} from './berekening'

const project = (id: string, naam: string, extra: Partial<Project> = {}): Project => ({
  id,
  naam,
  omschrijving: '',
  afdeling_id: 'prog',
  tak_id: null,
  indiener_id: null,
  programma_id: null,
  startdatum: '2027-01-01',
  einddatum: '2027-12-31',
  ...extra,
})

const projectjaar = (id: string, projectId: string, extra: Partial<Projectjaar> = {}): Projectjaar => ({
  id,
  project_id: projectId,
  jaar: 2027,
  status: 'ingediend',
  budget: null,
  toelichting: '',
  ...extra,
})

const inzet = (projectjaarId: string, functieId: string, uren: number, extra: Partial<Inzet> = {}): Inzet => ({
  id: `${projectjaarId}-${functieId}-${uren}`,
  projectjaar_id: projectjaarId,
  functie_id: functieId,
  fase: 'uitvoering',
  aantal_collegas: 1,
  uren,
  startdatum: '2027-01-01',
  einddatum: '2027-12-31',
  ...extra,
})

describe('periodes', () => {
  it('deelInJaar: het deel van de looptijd in het jaar', () => {
    const p = { startdatum: '2027-09-01', einddatum: '2028-03-31' }
    expect(deelInJaar(p, 2027)).toEqual({ startdatum: '2027-09-01', einddatum: '2027-12-31' })
    expect(deelInJaar(p, 2028)).toEqual({ startdatum: '2028-01-01', einddatum: '2028-03-31' })
    expect(deelInJaar(p, 2029)).toBeNull()
  })

  it('jarenVan: alle jaren van de looptijd', () => {
    expect(jarenVan({ startdatum: '2027-09-01', einddatum: '2028-03-31' })).toEqual([2027, 2028])
    expect(jarenVan({ startdatum: '2027-01-01', einddatum: '2027-12-31' })).toEqual([2027])
  })

  it('binnen: datums tellen mee', () => {
    const grenzen = { startdatum: '2027-04-01', einddatum: '2027-10-31' }
    expect(binnen({ startdatum: '2027-04-01', einddatum: '2027-10-31' }, grenzen)).toBe(true)
    expect(binnen({ startdatum: '2027-03-31', einddatum: '2027-05-01' }, grenzen)).toBe(false)
  })

  it('dagen: start en eind inclusief, ook over de zomertijd heen', () => {
    expect(dagen({ startdatum: '2027-01-01', einddatum: '2027-12-31' })).toBe(365)
    expect(dagen({ startdatum: '2027-03-27', einddatum: '2027-04-02' })).toBe(7)
  })
})

describe('inzet', () => {
  it('urenPerWeek: gelijk verdeeld over de periode', () => {
    // Twee weken, 60 uur: 30 per week.
    expect(urenPerWeek({ uren: 60, startdatum: '2027-09-27', einddatum: '2027-10-10' })).toBeCloseTo(30)
  })

  it('urenPerPersoon: het totaal gedeeld door het aantal collega’s', () => {
    expect(urenPerPersoon({ uren: 60, aantal_collegas: 3 })).toBe(20)
  })
})

describe('projectregels en filters', () => {
  const projecten = [
    project('kbw', 'Kinderboekenweek', { tak_id: 'dll' }),
    project('web', 'Nieuwe website', { afdeling_id: 'staf' }),
    project('oud', 'Ouder project'),
  ]
  const jaren = [
    projectjaar('j1', 'kbw', { status: 'akkoord', budget: 2500 }),
    projectjaar('j2', 'web', { budget: 10000 }),
    projectjaar('j3', 'oud', { jaar: 2026 }),
    projectjaar('j4', 'oud', { status: 'afgewezen', budget: 99999 }),
  ]
  const regelsInzet = [inzet('j1', 'lmc', 80), inzet('j1', 'bm', 20), inzet('j2', 'bm', 40), inzet('j4', 'lmc', 500)]
  const regels = projectregels(2027, projecten, jaren, regelsInzet)

  it('alleen projecten met een projectjaar in dat jaar, op naam', () => {
    expect(regels.map((r) => r.project.naam)).toEqual(['Kinderboekenweek', 'Nieuwe website', 'Ouder project'])
    expect(regels[0]?.inzet).toHaveLength(2)
  })

  it('filtert op afdeling, tak, status en functie', () => {
    const namen = (f: Partial<typeof GEEN_FILTER>) => filterRegels(regels, { ...GEEN_FILTER, ...f }).map((r) => r.project.naam)
    expect(namen({ afdelingId: 'staf' })).toEqual(['Nieuwe website'])
    expect(namen({ takId: 'dll' })).toEqual(['Kinderboekenweek'])
    expect(namen({ status: 'akkoord' })).toEqual(['Kinderboekenweek'])
    expect(namen({ functieId: 'bm' })).toEqual(['Kinderboekenweek', 'Nieuwe website'])
    expect(namen({})).toHaveLength(3)
  })

  it('kengetallen tellen afgewezen projecten niet mee in budget en uren', () => {
    const k = kengetallen(regels)
    expect(k.aantal).toBe(3)
    expect(k.perStatus).toEqual({ ingediend: 1, akkoord: 1, afgewezen: 1, uitgesteld: 0 })
    expect(k.budget).toBe(12500)
    expect(k.uren).toBe(140)
    expect(k.zonderBudget).toBe(0)
    expect(k.zonderInzet).toBe(0)
  })
})

describe('leesBedrag', () => {
  it('leest bedragen zoals mensen ze typen', () => {
    expect(leesBedrag('2500')).toBe(2500)
    expect(leesBedrag('2.500')).toBe(2500)
    expect(leesBedrag('€ 2.500,50')).toBe(2500.5)
    expect(leesBedrag('1.250.000')).toBe(1250000)
    expect(leesBedrag('12,5')).toBe(12.5)
    expect(leesBedrag('12.5')).toBe(12.5)
  })

  it('geeft null bij iets dat geen bedrag is', () => {
    expect(leesBedrag('')).toBeNull()
    expect(leesBedrag('-5')).toBeNull()
    expect(leesBedrag('veel')).toBeNull()
    expect(leesBedrag('1,234,5')).toBeNull()
  })
})

describe('formatEuro', () => {
  it('toont een bedrag of "onbekend"', () => {
    expect(formatEuro(2500).replace(/\s/g, ' ')).toBe('€ 2.500')
    expect(formatEuro(12.5).replace(/\s/g, ' ')).toBe('€ 12,50')
    expect(formatEuro(null)).toBe('onbekend')
  })
})
