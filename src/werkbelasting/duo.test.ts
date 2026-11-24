import { describe, expect, it } from 'vitest'
import { duoCode, duoStatus, peiljaarBij, rondeTekst, standaardKeuze, type BrinVoorstel, type DuoRonde, type DuoTelling } from './duo'

const telling = (aantal: number | null): DuoTelling => ({
  vestigingscode: '21NK00',
  peiljaar: 2025,
  type_po: 'BO',
  aantal,
  opgehaald_op: '2026-01-09T07:00:00Z',
})

describe('duoCode', () => {
  it('maakt van een BRIN van 4 tekens de hoofdvestiging', () => {
    expect(duoCode('21NK')).toBe('21NK00')
    expect(duoCode('21NK01')).toBe('21NK01')
    expect(duoCode(null)).toBeNull()
  })
})

describe('peiljaarBij', () => {
  it('koppelt de telling van 1 oktober aan het werkjaar erna', () => {
    expect(peiljaarBij(2026)).toBe(2025)
  })
})

describe('duoStatus', () => {
  it('toont het label DUO bij een aantal van DUO', () => {
    expect(duoStatus({ leerlingaantal: 298, van_duo: true }, telling(298))).toEqual({ soort: 'duo' })
  })

  it('toont de telling van DUO als een handmatig aantal afwijkt', () => {
    expect(duoStatus({ leerlingaantal: 310, van_duo: false }, telling(298))).toEqual({ soort: 'verschil', aantal: 298 })
  })

  it('toont niets als het gelijk is, onbekend is of er geen telling is', () => {
    expect(duoStatus({ leerlingaantal: 298, van_duo: false }, telling(298))).toBeNull()
    expect(duoStatus({ leerlingaantal: 3, van_duo: false }, telling(null))).toBeNull()
    expect(duoStatus({ leerlingaantal: 298, van_duo: false }, undefined)).toBeNull()
    expect(duoStatus(undefined, telling(298))).toBeNull()
  })
})

describe('standaardKeuze', () => {
  const voorstel = (vestigingscode: string, score: number): BrinVoorstel => ({
    school_id: 's',
    vestigingscode,
    naam: '',
    adres: '',
    postcode: '',
    plaats: '',
    score,
  })

  it('kiest een duidelijk passend voorstel vooraf', () => {
    expect(standaardKeuze([voorstel('11AA00', 0.6), voorstel('22BB00', 1.2)])).toBe('22BB00')
  })

  it('kiest niets bij een zwakke of twijfelachtige overeenkomst', () => {
    expect(standaardKeuze([voorstel('11AA00', 0.8)])).toBe('')
    expect(standaardKeuze([voorstel('11AA00', 1.2), voorstel('22BB00', 1.1)])).toBe('')
    expect(standaardKeuze([])).toBe('')
  })
})

describe('rondeTekst', () => {
  const ronde: DuoRonde = {
    id: 1,
    gestart_op: '2026-11-24T10:00:00Z',
    door: null,
    gelukt: true,
    tellingen: 96,
    vestigingen: 968,
    ingevuld: 1,
    melding: '',
  }

  it('vat een gelukte ronde samen', () => {
    expect(rondeTekst(ronde)).toBe('Opgehaald bij DUO: 96 tellingen en 968 vestigingen. 1 aantal is ingevuld of bijgewerkt.')
    expect(rondeTekst({ ...ronde, ingevuld: 0 })).toContain('geen lege, overgenomen of gewijzigde aantallen')
  })

  it('meldt een mislukte ronde met de reden', () => {
    expect(rondeTekst({ ...ronde, gelukt: false, melding: 'DUO antwoordde met status 503' })).toBe(
      'Ophalen bij DUO is mislukt (DUO antwoordde met status 503). Er is niets gewijzigd.',
    )
  })
})
