import { describe, expect, it } from 'vitest'
import {
  aandeelInJaar,
  berekenWerkbelasting,
  contractPeriodes,
  formatPercentage,
  formatPerWeek,
  formatUren,
  perWeek,
  staffelUren,
  type Invoer,
  type SchoolInzet,
  type StaffelSchijf,
} from './berekening'

const WERKJAAR = { jaar: 2026, werkweken: 47, mijmer_percentage: 20 }

// Staffel waarmee de schooluren uit de memo 2026 van Ingeborg uitkomen.
const STAFFEL: StaffelSchijf[] = [
  { jaar: 2026, schoolsoort: 'PO', min_leerlingen: 0, max_leerlingen: 149, uren: 80 },
  { jaar: 2026, schoolsoort: 'PO', min_leerlingen: 150, max_leerlingen: 299, uren: 100 },
  { jaar: 2026, schoolsoort: 'PO', min_leerlingen: 300, max_leerlingen: null, uren: 120 },
]

function school(naam: string, leerlingen: number, correctie = 0, periode = { startdatum: '2026-01-01', einddatum: null as string | null }): SchoolInzet {
  return {
    schoolId: naam,
    naam,
    soort: 'PO',
    jaargegevens: { leerlingaantal: leerlingen, uren_correctie: correctie },
    ...periode,
  }
}

const MEMO: Invoer = {
  werkjaar: WERKJAAR,
  contracten: [{ ingangsdatum: '2020-08-01', uren_per_week: 32, werkweken: null, mijmer_percentage: null }],
  staffel: STAFFEL,
  scholen: [
    school('De Brug Harderwijk', 320, 30),
    school('Al Islaah Harderwijk', 310, 30),
    school('Petraschool Nunspeet', 400),
    school('Morgenster Nunspeet', 200),
    school('Speulderbrink Ermelo', 90),
    school('Da Costa Elspeet', 180),
  ],
  projecten: [
    { projectgroepId: 'a', naam: 'Groepsbezoeken DigiLab', uren_per_jaar: 10, startdatum: '2026-01-01', einddatum: null },
    { projectgroepId: 'b', naam: 'Groepsbezoeken PO', uren_per_jaar: 10, startdatum: '2026-01-01', einddatum: null },
    { projectgroepId: 'c', naam: 'Podcasting', uren_per_jaar: 10, startdatum: '2026-01-01', einddatum: null },
    { projectgroepId: 'd', naam: 'Open Boek', uren_per_jaar: 40, startdatum: '2026-01-01', einddatum: null },
  ],
  taken: [],
  extraUren: [{ omschrijving: 'NPO Speulderbrink', uren: 40, financier: 'NPO' }],
}

describe('berekenWerkbelasting: de memo 2026', () => {
  const w = berekenWerkbelasting(MEMO)

  it('rekent contracturen, mijmertijd en beschikbare tijd zoals de memo', () => {
    expect(w.contracturen).toBeCloseTo(1504)
    expect(w.mijmertijd).toBeCloseTo(300.8)
    expect(w.beschikbaar).toBeCloseTo(1203.2)
    expect(w.werkweken).toBeCloseTo(47)
  })

  it('telt de schooluren uit staffel plus correctie', () => {
    expect(w.scholen.map((s) => s.jaaruren)).toEqual([150, 150, 120, 100, 80, 100])
    expect(w.schooluren).toBeCloseTo(700)
    expect(formatPerWeek(perWeek(w.schooluren, w.werkweken))).toBe('14,89')
    expect(formatPercentage(w.percentage.scholen)).toBe('46,5%')
  })

  it('verdeelt de rest over projecten en overig', () => {
    expect(w.projecturen).toBeCloseTo(70)
    expect(formatPerWeek(perWeek(w.projecturen, w.werkweken))).toBe('1,49')
    expect(w.overig).toBeCloseTo(433.2)
    expect(formatUren(w.projecturen + w.overig)).toBe('503,2')
    expect(formatPercentage(w.percentage.mijmertijd)).toBe('20,0%')
    expect(w.percentage.scholen + w.percentage.projecten + w.percentage.overig + w.percentage.mijmertijd).toBeCloseTo(100)
  })

  it('houdt extra uren buiten het contract', () => {
    expect(w.extraTotaal).toBe(40)
    expect(w.contracturen).toBeCloseTo(1504)
    expect(w.signalen).toEqual([])
  })
})

describe('overige taken', () => {
  it('telt als eigen post en verkleint wat nog niet ingevuld is', () => {
    const w = berekenWerkbelasting({
      ...MEMO,
      taken: [
        { taakId: 'bhv', naam: 'BHV', uren_per_jaar: 20, startdatum: '2026-01-01', einddatum: null },
        // Halverwege overgedragen: telt voor 181 van de 365 dagen.
        { taakId: 'coord', naam: 'Coördinatie', uren_per_jaar: 100, startdatum: '2025-01-01', einddatum: '2026-06-30' },
        { taakId: 'oud', naam: 'Oud', uren_per_jaar: 50, startdatum: '2024-01-01', einddatum: '2025-12-31' },
      ],
    })
    expect(w.taken.map((t) => t.naam)).toEqual(['BHV', 'Coördinatie'])
    expect(w.takenuren).toBeCloseTo(20 + (100 * 181) / 365)
    expect(w.overig).toBeCloseTo(433.2 - w.takenuren)
    expect(
      w.percentage.scholen + w.percentage.projecten + w.percentage.taken + w.percentage.overig + w.percentage.mijmertijd,
    ).toBeCloseTo(100)
  })
})

describe('naar rato', () => {
  it('telt een school die per 1 oktober overkomt voor 92 van de 365 dagen', () => {
    const w = berekenWerkbelasting({
      ...MEMO,
      scholen: [school('Da Costa', 180, 0, { startdatum: '2026-10-01', einddatum: null })],
    })
    expect(w.scholen[0]?.aandeel).toBeCloseTo(92 / 365)
    expect(w.schooluren).toBeCloseTo((100 * 92) / 365)
  })

  it('telt een school die halverwege het jaar overgaat tot en met de einddatum', () => {
    expect(aandeelInJaar({ startdatum: '2025-08-01', einddatum: '2026-06-30' }, 2026)).toBeCloseTo(181 / 365)
  })

  it('laat periodes buiten het jaar weg', () => {
    const w = berekenWerkbelasting({
      ...MEMO,
      scholen: [school('Oud', 180, 0, { startdatum: '2024-01-01', einddatum: '2025-12-31' })],
      projecten: [],
    })
    expect(w.scholen).toEqual([])
  })

  it('rekent een contractwijziging per periode', () => {
    const w = berekenWerkbelasting({
      ...MEMO,
      contracten: [
        { ingangsdatum: '2026-07-01', uren_per_week: 24, werkweken: null, mijmer_percentage: null },
        { ingangsdatum: '2024-01-01', uren_per_week: 32, werkweken: null, mijmer_percentage: null },
      ],
    })
    const eerste = 181 / 365
    expect(w.contracturen).toBeCloseTo(32 * 47 * eerste + 24 * 47 * (1 - eerste))
    expect(w.werkweken).toBeCloseTo(47)
  })

  it('gebruikt een afwijkend mijmerpercentage en werkweken van het contract', () => {
    const w = berekenWerkbelasting({
      ...MEMO,
      contracten: [{ ingangsdatum: '2026-01-01', uren_per_week: 20, werkweken: 40, mijmer_percentage: 10 }],
    })
    expect(w.contracturen).toBeCloseTo(800)
    expect(w.mijmertijd).toBeCloseTo(80)
  })

  it('rekent per week met de weken waarin iemand in dienst is', () => {
    const w = berekenWerkbelasting({
      ...MEMO,
      contracten: [{ ingangsdatum: '2026-07-02', uren_per_week: 32, werkweken: null, mijmer_percentage: null }],
      scholen: [],
      projecten: [],
    })
    expect(perWeek(w.contracturen, w.werkweken)).toBeCloseTo(32)
  })
})

describe('signalen', () => {
  it('meldt overbelasting', () => {
    const w = berekenWerkbelasting({
      ...MEMO,
      contracten: [{ ingangsdatum: '2026-01-01', uren_per_week: 16, werkweken: null, mijmer_percentage: null }],
    })
    expect(w.overig).toBeLessThan(0)
    expect(w.signalen).toContainEqual({ soort: 'overbelast', tekortUren: -w.overig })
  })

  it('meldt een ontbrekend contract zonder percentages te delen door nul', () => {
    const w = berekenWerkbelasting({ ...MEMO, contracten: [] })
    expect(w.signalen[0]).toEqual({ soort: 'geen-contract' })
    expect(w.percentage.scholen).toBe(0)
    expect(w.signalen.some((s) => s.soort === 'overbelast')).toBe(false)
  })

  it('meldt een school zonder leerlingaantal of buiten de staffel', () => {
    const w = berekenWerkbelasting({
      ...MEMO,
      staffel: STAFFEL.slice(0, 1),
      scholen: [{ ...school('Leeg', 0), jaargegevens: null }, school('Groot', 500)],
    })
    expect(w.signalen).toEqual([
      { soort: 'school-zonder-gegevens', schoolId: 'Leeg', naam: 'Leeg' },
      { soort: 'school-buiten-staffel', schoolId: 'Groot', naam: 'Groot' },
    ])
  })
})

describe('hulpfuncties', () => {
  it('kiest de staffelschijf op jaar, soort en leerlingaantal', () => {
    expect(staffelUren(STAFFEL, 2026, 'PO', 149)).toBe(80)
    expect(staffelUren(STAFFEL, 2026, 'PO', 150)).toBe(100)
    expect(staffelUren(STAFFEL, 2026, 'PO', 5000)).toBe(120)
    expect(staffelUren(STAFFEL, 2026, 'VO', 200)).toBeNull()
    expect(staffelUren(STAFFEL, 2027, 'PO', 200)).toBeNull()
  })

  it('laat een contract lopen tot de dag voor het volgende', () => {
    const p = contractPeriodes([
      { ingangsdatum: '2026-03-01', uren_per_week: 24, werkweken: null, mijmer_percentage: null },
      { ingangsdatum: '2025-01-01', uren_per_week: 32, werkweken: null, mijmer_percentage: null },
    ])
    expect(p.map((c) => [c.startdatum, c.einddatum])).toEqual([
      ['2025-01-01', '2026-02-28'],
      ['2026-03-01', null],
    ])
  })

  it('formatteert zoals de memo', () => {
    expect(formatUren(1504)).toBe('1.504,0')
    expect(formatPerWeek(700 / 47)).toBe('14,89')
    expect(formatPercentage((700 / 1504) * 100)).toBe('46,5%')
  })
})
