import { describe, expect, it } from 'vitest'
import { afdelingNaFunctiekeuze, functieNaam, functieOpties, indeling, type Afdeling, type Functie } from './api'

const afdelingen: Afdeling[] = [
  { id: 'ldv', naam: 'Lokale Dienstverlening', afkorting: 'LDV', volgorde: 1 },
  { id: 'prog', naam: 'Programmering', afkorting: 'PROG', volgorde: 2 },
]

const functie = (id: string, naam: string, afdeling_id: string, extra: Partial<Functie> = {}): Functie => ({
  id,
  naam,
  afkorting: '',
  afdeling_id,
  extern: false,
  actief: true,
  ...extra,
})

const functies: Functie[] = [
  functie('spec', 'Specialist', 'prog'),
  functie('lmc', 'Leesmediacoach', 'prog', { afkorting: 'LMC' }),
  functie('bm', 'Bibliotheekmedewerker', 'ldv', { afkorting: 'BM' }),
  functie('oud', 'Oude functie', 'ldv', { actief: false }),
]

describe('functieNaam', () => {
  it('zet de afkorting erachter als die er is', () => {
    expect(functieNaam({ naam: 'Leesmediacoach', afkorting: 'LMC' })).toBe('Leesmediacoach (LMC)')
    expect(functieNaam({ naam: 'Specialist', afkorting: '' })).toBe('Specialist')
  })
})

describe('functieOpties', () => {
  it('sorteert op afdeling en dan op naam, zonder inactieve functies', () => {
    expect(functieOpties(functies, afdelingen).map((o) => o.label)).toEqual([
      'Bibliotheekmedewerker (BM) · Lokale Dienstverlening',
      'Leesmediacoach (LMC) · Programmering',
      'Specialist · Programmering',
    ])
  })

  it('houdt de huidige functie in de lijst, ook als die inactief is', () => {
    expect(functieOpties(functies, afdelingen, 'oud').map((o) => o.waarde)).toEqual(['bm', 'oud', 'lmc', 'spec'])
    expect(functieOpties(functies, afdelingen, 'oud')[1]?.label).toBe('Oude functie · Lokale Dienstverlening – inactief')
  })
})

describe('afdelingNaFunctiekeuze', () => {
  const lmc = functies[1]
  const bm = functies[2]

  it('neemt de afdeling van de functie over als er nog geen afdeling is', () => {
    expect(afdelingNaFunctiekeuze('', undefined, lmc)).toBe('prog')
  })

  it('volgt de functie als de afdeling die van de oude functie was', () => {
    expect(afdelingNaFunctiekeuze('prog', lmc, bm)).toBe('ldv')
  })

  it('laat een bewust gekozen andere afdeling staan', () => {
    expect(afdelingNaFunctiekeuze('ldv', lmc, functies[0])).toBe('ldv')
  })

  it('laat de afdeling staan als de functie leeg wordt', () => {
    expect(afdelingNaFunctiekeuze('prog', lmc, undefined)).toBe('prog')
  })
})

describe('indeling', () => {
  it('toont functie en afdeling', () => {
    expect(indeling({ functie_id: 'lmc', afdeling_id: 'prog' }, functies, afdelingen)).toBe('Leesmediacoach · Programmering')
  })

  it('toont wat er is, of null als er niets is', () => {
    expect(indeling({ functie_id: null, afdeling_id: 'ldv' }, functies, afdelingen)).toBe('Lokale Dienstverlening')
    expect(indeling({ functie_id: null, afdeling_id: null }, functies, afdelingen)).toBeNull()
  })
})
