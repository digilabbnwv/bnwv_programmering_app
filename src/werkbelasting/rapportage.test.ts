import { describe, expect, it } from 'vitest'
import type { Medewerker, School, Toelichting } from './api'
import { berekenWerkbelasting } from './berekening'
import {
  bouwInvoer,
  isGewijzigd,
  memoTeksten,
  teamProgrammas,
  teamRijen,
  teamSignalen,
  totalenVan,
  type Rapportagegegevens,
} from './rapportage'

const WERKJAAR = { jaar: 2026, werkweken: 47, mijmer_percentage: 20 }

function medewerker(id: string, naam: string, actief = true): Medewerker {
  return { id, naam, email: '', functie: '', user_id: null, actief, opmerking: '' }
}

function school(id: string, naam: string, actief = true, programmaId: string | null = 'dbos'): School {
  return {
    id,
    naam,
    soort: 'PO',
    programma_id: programmaId,
    brin: null,
    matt_projectnummer: '',
    adres: '',
    postcode: '',
    plaats: '',
    contactpersoon: '',
    email: '',
    telefoon: '',
    opmerking: '',
    actief,
  }
}

function gegevens(): Rapportagegegevens {
  return {
    werkjaren: [WERKJAAR],
    medewerkers: [medewerker('ing', 'Ingeborg'), medewerker('hil', 'Hillyanne'), medewerker('oud', 'Oud', false)],
    contracten: [
      { id: 'c1', medewerker_id: 'ing', ingangsdatum: '2020-01-01', uren_per_week: 32, werkweken: null, mijmer_percentage: null },
      { id: 'c2', medewerker_id: 'hil', ingangsdatum: '2020-01-01', uren_per_week: 24, werkweken: null, mijmer_percentage: null },
    ],
    scholen: [school('brug', 'De Brug'), school('dok', 'Dok 19'), school('leeg', 'Zonder iemand'), school('weg', 'Gesloten', false)],
    programmas: [
      { id: 'dbos', naam: 'dBos', omschrijving: '' },
      { id: 'boekstart', naam: 'BoekStart', omschrijving: '' },
    ],
    jaargegevens: [
      { school_id: 'brug', jaar: 2026, leerlingaantal: 320, uren_correctie: 30, correctie_reden: 'PSZ' },
      { school_id: 'dok', jaar: 2026, leerlingaantal: 200, uren_correctie: 0, correctie_reden: '' },
      { school_id: 'brug', jaar: 2025, leerlingaantal: 1, uren_correctie: 0, correctie_reden: '' },
    ],
    staffel: [
      { id: 's1', jaar: 2026, schoolsoort: 'PO', min_leerlingen: 0, max_leerlingen: 299, uren: 100 },
      { id: 's2', jaar: 2026, schoolsoort: 'PO', min_leerlingen: 300, max_leerlingen: null, uren: 120 },
    ],
    toewijzingen: [
      { id: 't1', school_id: 'brug', medewerker_id: 'ing', startdatum: '2024-01-01', einddatum: null },
      // Dok 19 halverwege het jaar van Ingeborg naar Hillyanne.
      { id: 't2', school_id: 'dok', medewerker_id: 'ing', startdatum: '2024-01-01', einddatum: '2026-06-30' },
      { id: 't3', school_id: 'dok', medewerker_id: 'hil', startdatum: '2026-07-01', einddatum: null },
    ],
    projectgroepen: [
      { id: 'p1', naam: 'Open Boek', omschrijving: '', startdatum: '2026-01-01', einddatum: null, trekker_id: null },
      { id: 'p2', naam: 'Podcasting', omschrijving: '', startdatum: '2026-01-01', einddatum: null, trekker_id: null },
      { id: 'p3', naam: 'Afgelopen', omschrijving: '', startdatum: '2024-01-01', einddatum: '2025-12-31', trekker_id: null },
    ],
    deelnemers: [{ id: 'd1', projectgroep_id: 'p1', medewerker_id: 'ing', uren_per_jaar: 40, startdatum: '2026-01-01', einddatum: null }],
    taken: [
      { id: 'k1', naam: 'BHV', omschrijving: '', startdatum: '2026-01-01', einddatum: null },
      { id: 'k2', naam: 'Nog open', omschrijving: '', startdatum: '2026-01-01', einddatum: null },
    ],
    uitvoerders: [
      { id: 'u1', taak_id: 'k1', medewerker_id: 'ing', uren_per_jaar: 20, startdatum: '2026-01-01', einddatum: null },
      { id: 'u2', taak_id: 'k1', medewerker_id: 'hil', uren_per_jaar: 10, startdatum: '2026-01-01', einddatum: null },
    ],
    extraUren: [{ id: 'e1', medewerker_id: 'ing', jaar: 2026, omschrijving: 'NPO', uren: 40, financier: 'NPO', school_id: null }],
    toelichtingen: [],
  }
}

describe('bouwInvoer', () => {
  it('verzamelt contract, scholen met jaargegevens, projecten en extra uren van één medewerker', () => {
    const invoer = bouwInvoer(gegevens(), 'ing', WERKJAAR)
    expect(invoer.contracten).toHaveLength(1)
    expect(invoer.scholen.map((s) => [s.naam, s.jaargegevens?.leerlingaantal])).toEqual([
      ['De Brug', 320],
      ['Dok 19', 200],
    ])
    expect(invoer.projecten.map((p) => p.naam)).toEqual(['Open Boek'])
    expect(invoer.taken).toEqual([{ taakId: 'k1', naam: 'BHV', uren_per_jaar: 20, startdatum: '2026-01-01', einddatum: null }])
    expect(invoer.extraUren).toEqual([{ omschrijving: 'NPO', uren: 40, financier: 'NPO' }])
  })

  it('verdeelt een overgedragen school naar rato over beide medewerkers', () => {
    const g = gegevens()
    const ing = berekenWerkbelasting(bouwInvoer(g, 'ing', WERKJAAR))
    const hil = berekenWerkbelasting(bouwInvoer(g, 'hil', WERKJAAR))
    const dokIng = ing.scholen.find((s) => s.naam === 'Dok 19')?.jaaruren ?? 0
    const dokHil = hil.scholen.find((s) => s.naam === 'Dok 19')?.jaaruren ?? 0
    expect(dokIng + dokHil).toBeCloseTo(100)
    expect(dokIng).toBeCloseTo((100 * 181) / 365)
  })
})

describe('teamRijen', () => {
  it('toont actieve medewerkers op naam, niet een inactieve zonder inzet', () => {
    expect(teamRijen(gegevens(), WERKJAAR).map((r) => r.medewerker.naam)).toEqual(['Hillyanne', 'Ingeborg'])
  })
})

describe('teamProgrammas', () => {
  it('telt de schooluren van het team per programma, met scholen en medewerkers', () => {
    const g = gegevens()
    expect(bouwInvoer(g, 'ing', WERKJAAR).scholen.map((s) => s.programma?.naam)).toEqual(['dBos', 'dBos'])
    expect(teamProgrammas(teamRijen(g, WERKJAAR))).toEqual([
      { programma: { id: 'dbos', naam: 'dBos' }, uren: expect.closeTo(150 + 100, 5) as number, scholen: 2, medewerkers: 2 },
    ])
  })

  it('zet scholen zonder programma apart, als laatste', () => {
    const g = gegevens()
    g.scholen = g.scholen.map((s) => (s.id === 'dok' ? { ...s, programma_id: null } : s))
    g.toewijzingen.push({ id: 't4', school_id: 'leeg', medewerker_id: 'hil', startdatum: '2026-01-01', einddatum: null })
    g.scholen = g.scholen.map((s) => (s.id === 'leeg' ? { ...s, programma_id: 'boekstart' } : s))
    g.jaargegevens.push({ school_id: 'leeg', jaar: 2026, leerlingaantal: 50, uren_correctie: 0, correctie_reden: '' })
    const verdeling = teamProgrammas(teamRijen(g, WERKJAAR))
    expect(verdeling.map((p) => [p.programma?.naam ?? null, p.scholen, p.medewerkers])).toEqual([
      ['BoekStart', 1, 1],
      ['dBos', 1, 1],
      [null, 1, 2],
    ])
    expect(verdeling[2]?.uren).toBeCloseTo(100)
  })
})

describe('teamSignalen', () => {
  it('meldt actieve scholen zonder medewerker en lopende projectgroepen zonder deelnemers', () => {
    expect(teamSignalen(gegevens(), 2026)).toEqual([
      { soort: 'taak-zonder-uitvoerders', taakId: 'k2', naam: 'Nog open' },
      { soort: 'projectgroep-zonder-deelnemers', projectgroepId: 'p2', naam: 'Podcasting' },
      { soort: 'school-zonder-medewerker', schoolId: 'leeg', naam: 'Zonder iemand', aandeelZonder: 1 },
    ])
  })

  it('meldt een school die een deel van het jaar niemand heeft', () => {
    const g = gegevens()
    g.toewijzingen = g.toewijzingen.filter((t) => t.id !== 't3')
    const signaal = teamSignalen(g, 2026).find((s) => s.soort === 'school-zonder-medewerker' && s.schoolId === 'dok')
    expect(signaal && 'aandeelZonder' in signaal ? signaal.aandeelZonder : 0).toBeCloseTo(184 / 365)
  })
})

describe('vaststellen', () => {
  const w = berekenWerkbelasting(bouwInvoer(gegevens(), 'ing', WERKJAAR))
  const vastgesteld = (totalen: Toelichting['totalen']): Toelichting => ({
    medewerker_id: 'ing',
    jaar: 2026,
    toelichting: '',
    status: 'vastgesteld',
    vastgesteld_door: null,
    vastgesteld_op: '2026-10-01T10:00:00Z',
    totalen,
  })

  it('bewaart totalen afgerond op één decimaal', () => {
    expect(totalenVan(w).contracturen).toBe(1504)
    expect(totalenVan(w).schooluren).toBe(Math.round(w.schooluren * 10) / 10)
  })

  it('ziet geen wijziging als de uren gelijk zijn, wel als ze veranderd zijn', () => {
    expect(isGewijzigd(vastgesteld(totalenVan(w)), w)).toBe(false)
    expect(isGewijzigd(vastgesteld({ ...totalenVan(w), projecturen: 0 }), w)).toBe(true)
    expect(isGewijzigd(null, w)).toBe(false)
    expect(isGewijzigd({ ...vastgesteld(null), status: 'concept' }, w)).toBe(false)
  })
})

describe('memoTeksten', () => {
  it('schrijft de inleiding zoals de memo', () => {
    const w = berekenWerkbelasting(bouwInvoer(gegevens(), 'ing', WERKJAAR))
    const { inleiding, conclusie } = memoTeksten('Ingeborg', w)
    expect(inleiding).toContain('contractomvang van gemiddeld 32 uur per week en 47 werkweken')
    expect(inleiding).toContain('20% van de contracturen gereserveerd voor mijmertijd en is 80% beschikbaar')
    expect(conclusie).toContain('300,8 uur per jaar gereserveerd voor mijmertijd')
    expect(conclusie).toContain('Nog niet ingevuld is')
    expect(conclusie).toContain('aan overige taken')
  })

  it('benoemt overbelasting en een ontbrekend contract', () => {
    const g = gegevens()
    g.contracten = [{ id: 'c1', medewerker_id: 'ing', ingangsdatum: '2020-01-01', uren_per_week: 4, werkweken: null, mijmer_percentage: null }]
    expect(memoTeksten('Ingeborg', berekenWerkbelasting(bouwInvoer(g, 'ing', WERKJAAR))).conclusie).toContain(
      'hoger dan de beschikbare werktijd',
    )
    g.contracten = []
    const zonder = memoTeksten('Ingeborg', berekenWerkbelasting(bouwInvoer(g, 'ing', WERKJAAR)))
    expect(zonder.inleiding).toContain('geen contract')
    expect(zonder.conclusie).toBe('')
  })
})
