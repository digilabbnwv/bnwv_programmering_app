import { describe, expect, it } from 'vitest'
import type { Afdeling, Functie, Tak } from '../organisatie/api'
import type { Inzet, Project, Projectjaar } from './api'
import { projectregels } from './berekening'
import {
  budgetPerTak,
  capaciteitPerFunctie,
  drukstWeek,
  drukte,
  isoWeek,
  maandagVan,
  plansignalen,
  positieInJaar,
  projectenInUitvoering,
  stap,
  telMee,
  tijdlijn,
  urenPerWeekVan,
  weekVanDag,
  wekenInJaar,
  wekenTeVol,
} from './drukte'

describe('weken', () => {
  it('ISO-weken, ook rond de jaarwisseling', () => {
    expect(isoWeek('2027-01-01')).toEqual({ jaar: 2026, week: 53 })
    expect(isoWeek('2027-01-04')).toEqual({ jaar: 2027, week: 1 })
    expect(isoWeek('2027-10-04')).toEqual({ jaar: 2027, week: 40 })
    expect(isoWeek('2028-01-01')).toEqual({ jaar: 2027, week: 52 })
  })

  it('52 of 53 weken', () => {
    expect(wekenInJaar(2026)).toBe(53)
    expect(wekenInJaar(2027)).toBe(52)
    expect(wekenInJaar(2020)).toBe(53)
  })

  it('dagen buiten de weken van het jaar tellen bij de eerste of laatste week', () => {
    expect(weekVanDag('2027-01-01', 2027)).toBe(1)
    expect(weekVanDag('2026-12-31', 2026)).toBe(53)
    expect(weekVanDag('2027-12-31', 2027)).toBe(52)
  })

  it('maandag van een week', () => {
    expect(maandagVan(2027, 1)).toBe('2027-01-04')
    expect(maandagVan(2027, 40)).toBe('2027-10-04')
    expect(maandagVan(2020, 53)).toBe('2020-12-28')
  })

  it('uren gelijk over de dagen verdeeld', () => {
    const weken = urenPerWeekVan({ uren: 70, startdatum: '2027-01-04', einddatum: '2027-01-17' }, 2027)
    expect(weken).toHaveLength(52)
    expect(weken.slice(0, 3)).toEqual([35, 35, 0])
    // Woensdag t/m dinsdag: 5 dagen in week 40, 2 in week 41.
    const piek = urenPerWeekVan({ uren: 70, startdatum: '2027-10-06', einddatum: '2027-10-12' }, 2027)
    expect(piek[39]).toBeCloseTo(50)
    expect(piek[40]).toBeCloseTo(20)
  })

  it('positie in het jaar', () => {
    expect(positieInJaar('2027-01-01', 2027)).toBe(0)
    expect(positieInJaar('2028-01-01', 2027)).toBe(100)
  })
})

const functie = (id: string, extra: Partial<Functie> = {}): Functie => ({
  id,
  naam: id.toUpperCase(),
  afkorting: '',
  afdeling_id: 'prog',
  extern: false,
  actief: true,
  ...extra,
})
const afdelingen: Afdeling[] = [
  { id: 'prog', naam: 'Programmering', afkorting: 'PROG', volgorde: 2 },
  { id: 'ldv', naam: 'Lokale Dienstverlening', afkorting: 'LDV', volgorde: 1 },
]
const takken: Tak[] = [{ id: 'dll', afdeling_id: 'prog', naam: 'Doorgaande leeslijn', actief: true }]
const project = (id: string, extra: Partial<Project> = {}): Project => ({
  id,
  naam: id,
  omschrijving: '',
  afdeling_id: 'prog',
  tak_id: 'dll',
  indiener_id: null,
  programma_id: null,
  startdatum: '2027-01-01',
  einddatum: '2027-12-31',
  ...extra,
})
const jaar = (id: string, projectId: string, extra: Partial<Projectjaar> = {}): Projectjaar => ({
  id,
  project_id: projectId,
  jaar: 2027,
  status: 'akkoord',
  budget: 1000,
  toelichting: '',
  ...extra,
})
const inzet = (projectjaarId: string, functieId: string, uren: number, van: string, tot: string, extra: Partial<Inzet> = {}): Inzet => ({
  id: `${projectjaarId}-${functieId}-${van}`,
  projectjaar_id: projectjaarId,
  functie_id: functieId,
  fase: 'uitvoering',
  aantal_collegas: 1,
  uren,
  startdatum: van,
  einddatum: tot,
  ...extra,
})

describe('capaciteit en drukte', () => {
  const capaciteit = capaciteitPerFunctie([
    { functie_id: 'lmc', vrij: 470, werkweken: 47 },
    { functie_id: 'lmc', vrij: 235, werkweken: 47 },
    { functie_id: 'lmc', vrij: -50, werkweken: 47 },
    { functie_id: null, vrij: 1000, werkweken: 47 },
  ])

  it('capaciteit per functie: wat over is na vaste taken, per week', () => {
    expect(capaciteit.get('lmc')).toEqual({ perJaar: 705, perWeek: 15, medewerkers: 3 })
  })

  const regels = projectregels(
    2027,
    [project('kbw'), project('dikke-pil'), project('weg')],
    [jaar('j1', 'kbw'), jaar('j2', 'dikke-pil', { budget: null }), jaar('j3', 'weg', { status: 'afgewezen' })],
    [
      inzet('j1', 'lmc', 42, '2027-10-04', '2027-10-10'),
      inzet('j1', 'lmc', 70, '2027-04-05', '2027-05-16', { fase: 'voorbereiding' }),
      inzet('j2', 'lmc', 7, '2027-10-04', '2027-10-10'),
      inzet('j2', 'cl', 14, '2027-10-04', '2027-10-17'),
    ],
  ).filter((r) => telMee(r.projectjaar.status, 'actief'))
  const d = drukte(regels, [functie('lmc'), functie('cl'), functie('bm')], capaciteit, 2027)
  const vind = (id: string) => {
    const f = d.find((x) => x.functie.id === id)
    if (!f) throw new Error(`geen drukte voor ${id}`)
    return f
  }
  const lmc = vind('lmc')
  const cl = vind('cl')

  it('alleen functies met inzet; afgewezen projecten tellen niet', () => {
    expect(d.map((f) => f.functie.id)).toEqual(['lmc', 'cl'])
    expect(lmc.totaal).toBeCloseTo(119)
  })

  it('bezetting = nodig ÷ capaciteit per week', () => {
    expect(lmc.nodig[39]).toBeCloseTo(49)
    expect(lmc.bezetting?.[39]).toBeCloseTo(49 / 15)
    expect(lmc.bijdragen[39]?.map((b) => b.projectId)).toEqual(['kbw', 'dikke-pil'])
    expect(wekenTeVol(lmc)).toEqual([40])
    expect(drukstWeek(lmc)).toMatchObject({ week: 40 })
  })

  it('kleurstappen: leeg, vol en te vol', () => {
    expect(stap(lmc, 0)).toBe(0)
    // Voorbereiding: 70 uur in 6 weken = 11,7 per week op 15 → 78%.
    expect(stap(lmc, 14)).toBe(4)
    expect(stap(lmc, 39)).toBe(5)
  })

  it('zonder capaciteit: kleur ten opzichte van de drukste week, nooit te vol', () => {
    expect(cl.capaciteit).toBeNull()
    expect(cl.bezetting).toBeNull()
    expect(stap(cl, 39)).toBe(4)
    expect(wekenTeVol(cl)).toEqual([])
  })

  it('externe functies hebben geen capaciteit', () => {
    const extern = drukte(regels, [functie('lmc', { extern: true })], capaciteit, 2027)
    expect(extern[0]?.capaciteit).toBeNull()
  })

  it('projecten in uitvoering per week', () => {
    const n = projectenInUitvoering(regels, 2027)
    expect(n[39]).toBe(2)
    expect(n[40]).toBe(1)
    expect(n[14]).toBe(0)
  })

  it('tijdlijn: looptijd en per fase van eerste tot laatste inzet', () => {
    const t = tijdlijn(regels, 2027).find((x) => x.regel.project.id === 'kbw')
    expect(t?.fases).toEqual([
      { fase: 'voorbereiding', periode: { startdatum: '2027-04-05', einddatum: '2027-05-16' } },
      { fase: 'uitvoering', periode: { startdatum: '2027-10-04', einddatum: '2027-10-10' } },
    ])
  })

  it('budget per afdeling en tak', () => {
    const b = budgetPerTak(regels, afdelingen, takken)
    expect(b).toHaveLength(1)
    expect(b[0]).toMatchObject({ projecten: 2, akkoord: 1000, ingediend: 0, zonderBudget: 1, zonderInzet: 0 })
  })

  it('signalen', () => {
    const s = plansignalen(regels, d, { jaar: 2027, werkjaarBekend: true, capaciteitBekend: true })
    expect(s.map((x) => x.soort)).toEqual(['te-vol', 'capaciteit-onbekend', 'geen-budget'])
    expect(plansignalen([], [], { jaar: 2027, werkjaarBekend: false, capaciteitBekend: true }).map((x) => x.soort)).toEqual([
      'geen-werkjaar',
    ])
  })
})
