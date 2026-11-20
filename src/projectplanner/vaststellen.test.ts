import { describe, expect, it } from 'vitest'
import type { Afdeling, Functie } from '../organisatie/api'
import type { Projectgroep } from '../werkbelasting/api'
import type { Inzet, Momentopname, Project, Projectjaar } from './api'
import { projectregels } from './berekening'
import type { Werkblad } from './excel'
import { afwijkingen, controle, vergelijkMetExcel, voorgesteldeProjectgroep } from './vaststellen'

const afdelingen: Afdeling[] = [
  { id: 'ldv', naam: 'Lokale Dienstverlening', afkorting: 'LDV', volgorde: 1 },
  { id: 'prog', naam: 'Programmering', afkorting: 'PROG', volgorde: 2 },
]
const functies: Functie[] = [
  { id: 'lmc', naam: 'Leesmediacoach', afkorting: 'LMC', afdeling_id: 'prog', extern: false, actief: true },
  { id: 'bm', naam: 'Bibliotheekmedewerker', afkorting: 'BM', afdeling_id: 'ldv', extern: false, actief: true },
]
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
const jaar = (id: string, projectId: string, extra: Partial<Projectjaar> = {}): Projectjaar => ({
  id,
  project_id: projectId,
  jaar: 2027,
  status: 'akkoord',
  budget: 1000,
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
  startdatum: '2027-10-04',
  einddatum: '2027-10-10',
  ...extra,
})
const groep = (id: string, naam: string, extra: Partial<Projectgroep> = {}): Projectgroep => ({
  id,
  naam,
  omschrijving: '',
  matt_projectnummer: '',
  startdatum: '2027-01-01',
  einddatum: null,
  trekker_id: null,
  project_id: null,
  ...extra,
})

describe('voorgesteldeProjectgroep', () => {
  const groepen = [
    groep('g1', 'Dikke Pil 2027'),
    groep('g2', 'Kinderboekenweek', { project_id: 'ander' }),
    groep('g3', 'Podcast', { einddatum: '2026-12-31' }),
    groep('g4', 'Leesclubs'),
  ]

  it('stelt een niet-gekoppelde projectgroep met dezelfde naam voor', () => {
    expect(voorgesteldeProjectgroep(project('p', 'Dikke Pil'), groepen)?.id).toBe('g1')
    expect(voorgesteldeProjectgroep(project('p', ' leesclubs '), groepen)?.id).toBe('g4')
  })

  it('niet als de groep al gekoppeld is, de looptijd niet overlapt of de naam alleen lijkt', () => {
    expect(voorgesteldeProjectgroep(project('p', 'Kinderboekenweek'), groepen)).toBeNull()
    expect(voorgesteldeProjectgroep(project('p', 'Podcast'), groepen)).toBeNull()
    expect(voorgesteldeProjectgroep(project('p', 'Dikke'), groepen)).toBeNull()
  })
})

describe('controle en afwijkingen', () => {
  const projecten = [project('kbw', 'Kinderboekenweek'), project('dp', 'Dikke Pil'), project('pod', 'Podcast'), project('nieuw', 'Nieuw')]
  const regels = projectregels(
    2027,
    projecten,
    [
      jaar('j1', 'kbw', { budget: 2500 }),
      jaar('j2', 'dp', { budget: null }),
      jaar('j3', 'pod', { status: 'ingediend' }),
      jaar('j4', 'nieuw', { status: 'akkoord' }),
    ],
    [inzet('j1', 'lmc', 80), inzet('j3', 'bm', 10, { startdatum: '2027-11-01', einddatum: '2027-11-30' })],
  )

  it('controle: ingediend, akkoord zonder inzet of budget', () => {
    const c = controle(regels)
    expect(c.ingediend.map((r) => r.project.id)).toEqual(['pod'])
    expect(c.akkoordZonderInzet.map((r) => r.project.id)).toEqual(['dp', 'nieuw'])
    expect(c.akkoordZonderBudget.map((r) => r.project.id)).toEqual(['dp'])
  })

  it('afwijkingen ten opzichte van de momentopname', () => {
    const momentopname: Momentopname[] = [
      { project_id: 'kbw', naam: 'Kinderboekenweek', afdeling_id: 'prog', status: 'akkoord', budget: 2000, inzet: [{ functie_id: 'lmc', fase: 'uitvoering', uren: 60, startdatum: '2027-10-04', einddatum: '2027-10-10' }] },
      { project_id: 'dp', naam: 'Dikke Pil', afdeling_id: 'prog', status: 'akkoord', budget: null, inzet: [] },
      { project_id: 'pod', naam: 'Podcast', afdeling_id: 'prog', status: 'akkoord', budget: 1000, inzet: [{ functie_id: 'bm', fase: 'uitvoering', uren: 10, startdatum: '2027-10-01', einddatum: '2027-10-31' }] },
      { project_id: 'weg', naam: 'Verdwenen', afdeling_id: 'prog', status: 'akkoord', budget: 5, inzet: [] },
    ]
    expect(afwijkingen(momentopname, regels).map((a) => `${a.soort}:${a.projectId}`)).toEqual([
      'budget:kbw',
      'uren:kbw',
      'nieuw:nieuw',
      'status:pod',
      'inzet:pod',
      'weg:weg',
    ])
  })
})

describe('vergelijkMetExcel', () => {
  const blad: Werkblad = {
    naam: 'Programmering',
    cellen: new Map<string, string | number>([
      ['B4', 'PROJECT'],
      ['C4', 'FINANCIEEL BUDGET'],
      ['J4', 'INZET VAN'],
      ['K5', 1],
      ['L5', 2],
      ['B6', 'Kinderboekenweek'],
      ['C6', 2500],
      ['J6', 'LMC'],
      ['K6', 40],
      ['L6', 40],
      ['B7', 'Kinderboekenweek LDV'],
      ['J7', 'LDV'],
      ['K7', 10],
      ['B8', 'Kerst'],
      ['J8', 'MT'],
      ['K8', 3],
    ]),
    samengevoegd: [],
  }
  const regels = projectregels(
    2027,
    [project('kbw', 'Kinderboekenweek'), project('ldv-project', 'Iets', { afdeling_id: 'ldv' })],
    [jaar('j1', 'kbw', { budget: 2000 }), jaar('j2', 'ldv-project')],
    [inzet('j1', 'lmc', 80), inzet('j1', 'bm', 12), inzet('j2', 'bm', 99)],
  )

  it('budget, uren en uren per code naast elkaar', () => {
    const v = vergelijkMetExcel([blad], regels, afdelingen, functies).map((r) => `${r.afdeling.afkorting} ${r.wat}: ${r.excel} / ${r.app ?? '–'}`)
    expect(v).toEqual(['PROG Budget: 2500 / 2000', 'PROG Uren totaal: 93 / 92', 'PROG LDV: 10 / 12', 'PROG LMC: 80 / 80', 'PROG MT: 3 / –'])
  })
})
