import { describe, expect, it } from 'vitest'
import type { Afdeling, Tak } from '../organisatie/api'
import type { Programma } from '../werkbelasting/api'
import { excelDatum, kolomLetters, kolomNummer, leesGedeeldeTeksten, leesWerkbladXml, leesZip, ontsnap, type Werkblad } from './excel'
import { alsImport, basisnaam, maakVoorstel, takPast } from './voorstel'

const afdelingen: Afdeling[] = [
  { id: 'ldv', naam: 'Lokale Dienstverlening', afkorting: 'LDV', volgorde: 1 },
  { id: 'prog', naam: 'Programmering', afkorting: 'PROG', volgorde: 2 },
  { id: 'staf', naam: 'Staf', afkorting: 'STAF', volgorde: 3 },
]
const takken: Tak[] = [
  { id: 'dll', afdeling_id: 'prog', naam: 'Doorgaande leeslijn', actief: true },
  { id: 'dig', afdeling_id: 'prog', naam: 'Digitaal', actief: true },
  { id: 'hr', afdeling_id: 'staf', naam: 'HR', actief: true },
  { id: 'loc', afdeling_id: 'ldv', naam: 'Locaties', actief: true },
]
const programmas: Programma[] = [{ id: 'p1', naam: 'Digilabs', omschrijving: '', type: 'uitvoerders' }]

/** Een werkblad met de opbouw van de projectplanner: kop in rij 4, weeknummers in rij 5. */
function blad(naam: string, cellen: Record<string, string | number>, samengevoegd: string[] = []): Werkblad {
  const kop = {
    B4: 'PROJECT',
    C4: 'FINANCIEEL BUDGET',
    D4: 'PROJECTLEDEN',
    E4: 'BEGIN PROJECTGROEP',
    J4: 'INZET VAN',
    K4: 'WEEKNUMMER',
    K5: 1,
    L5: 2,
  }
  return { naam, cellen: new Map(Object.entries({ ...kop, ...cellen })), samengevoegd: ['B4:B5', ...samengevoegd] }
}

describe('excel', () => {
  it('kolomletters en -nummers', () => {
    expect(kolomNummer('A')).toBe(1)
    expect(kolomNummer('BK')).toBe(63)
    expect(kolomLetters(63)).toBe('BK')
    expect(kolomLetters(26)).toBe('Z')
    expect(kolomLetters(27)).toBe('AA')
  })

  it('datums en entiteiten', () => {
    expect(excelDatum(46645)).toBe('2027-09-15')
    expect(ontsnap('Boekjes &amp; Babbels &#233;&#xE9;')).toBe('Boekjes & Babbels éé')
  })

  it('leest gedeelde teksten, ook met opmaak in delen', () => {
    const xml = '<sst><si><t>Digilabs</t></si><si><r><t>Taal</t></r><r><t xml:space="preserve">café</t></r></si></sst>'
    expect(leesGedeeldeTeksten(xml)).toEqual(['Digilabs', 'Taalcafé'])
  })

  it('leest cellen en samengevoegde bereiken', () => {
    const xml =
      '<worksheet><sheetData><row r="6"><c r="A6" t="s"><v>0</v></c><c r="B6" t="inlineStr"><is><t>Kerst</t></is></c>' +
      '<c r="C6" s="2"/><c r="D6"><v>12.5</v></c><c r="E6" t="str"><f>A1</f><v>x &amp; y</v></c></row></sheetData>' +
      '<mergeCells count="1"><mergeCell ref="A6:A8"/></mergeCells></worksheet>'
    const w = leesWerkbladXml('Staf', xml, ['HR'])
    expect([...w.cellen]).toEqual([
      ['A6', 'HR'],
      ['B6', 'Kerst'],
      ['D6', 12.5],
      ['E6', 'x & y'],
    ])
    expect(w.samengevoegd).toEqual(['A6:A8'])
  })

  it('weigert een bestand dat geen zip is', async () => {
    await expect(leesZip(new ArrayBuffer(100))).rejects.toThrow('geen Excel-bestand')
  })
})

describe('basisnaam en takken', () => {
  it('haalt de soort inzet van de naam af', () => {
    expect(basisnaam('Kinderboekenweek uitvoering LDV')).toBe('Kinderboekenweek')
    expect(basisnaam('Nationale Voorleesdagen programmering ')).toBe('Nationale Voorleesdagen')
    expect(basisnaam('Ondersteuning Spot-on Ermelo / Putten')).toBe('Spot-on Ermelo / Putten')
    expect(basisnaam('Werkgroep collectie LMC')).toBe('Werkgroep collectie')
    expect(basisnaam('Afstemming CL-ers')).toBe('Afstemming CL-ers')
  })

  it('herkent een afgekorte tak', () => {
    expect(takPast('D. Leeslijn', 'Doorgaande leeslijn')).toBe(true)
    expect(takPast('Digitaal', 'Digitaal')).toBe(true)
    expect(takPast('D. Leeslijn', 'Digitaal')).toBe(false)
  })
})

describe('maakVoorstel', () => {
  const programmering = blad(
    'Programmering',
    {
      A6: 'Doorgaande leeslijn',
      B6: 'Kinderboekenweek programmering ',
      B7: 'Kinderboekenweek uitvoering LDV',
      K7: 10,
      L7: 5,
      B8: 'Vakantielezen',
      C8: 750,
      A9: 'Digitaal',
      B9: 'Digilabs',
      B10: 'Digilabs extern aanbod',
      B11: 'Groepsbezoeken',
      B12: 'PROJECTBUDGET',
      J13: 'Inzet LMC-ers',
      B14: 'Projecten zonder uren',
      A15: 'D. Leeslijn',
      B15: 'Leescollege',
    },
    ['A6:A8', 'A9:A11'],
  )
  const staf = blad(
    'Staf',
    {
      A6: 'HR',
      B6: 'Vrijwilligersuitje',
      D6: 'projectleider en 3 anderen',
      E6: 'februari 2027',
      J6: 'LDV',
      J7: 'PROG',
      B8: 'Verbouwing Elspeet (met Open+)',
      J8: 'LDV',
    },
    ['A6:A7'],
  )
  const ldv = blad('LDV', { A6: 'Locaties', B6: 'Verbouwing Elspeet', J6: 'BV', B7: 'Groepsbezoeken', J7: 'PROG' })
  const overig = blad('TOTAAL INZET JAAR', { B6: 'Iets' })
  const voorstel = maakVoorstel([programmering, staf, ldv, overig], afdelingen, takken, programmas)
  const zoek = (naam: string, afdeling = 'prog') => voorstel.find((v) => v.naam === naam && v.afdeling.id === afdeling)

  it('alleen de afdelingstabbladen, totaalregels niet', () => {
    expect(voorstel.map((v) => `${v.afdeling.afkorting} ${v.naam}`)).toEqual([
      'PROG Kinderboekenweek',
      'PROG Vakantielezen',
      'PROG Digilabs',
      'PROG Digilabs extern aanbod',
      'PROG Groepsbezoeken',
      'PROG Leescollege',
      'STAF Vrijwilligersuitje',
      'STAF Verbouwing Elspeet (met Open+)',
      'LDV Verbouwing Elspeet',
      'LDV Groepsbezoeken',
    ])
  })

  it('voegt de rijen van één project samen, met de uren uit het weekraster', () => {
    const kbw = zoek('Kinderboekenweek')
    expect(kbw?.rijen).toEqual([
      'Kinderboekenweek programmering (Programmering, rij 6)',
      'Kinderboekenweek uitvoering LDV (Programmering, rij 7)',
    ])
    expect(kbw?.weekuren).toBe(15)
    expect(kbw?.tak?.id).toBe('dll')
  })

  it('een rij zonder naam direct onder een project hoort erbij', () => {
    const uitje = zoek('Vrijwilligersuitje', 'staf')
    expect(uitje?.inzetVan).toEqual(['LDV', 'PROG'])
    expect(uitje?.details).toEqual(['projectleden: projectleider en 3 anderen', 'begin: februari 2027'])
    expect(uitje?.tak?.id).toBe('hr')
  })

  it('een programma gaat standaard niet mee; een project bij een programma wel', () => {
    expect(zoek('Digilabs')?.overnemen).toBe(false)
    expect(zoek('Digilabs extern aanbod')?.programma?.id).toBe('p1')
    expect(zoek('Digilabs extern aanbod')?.overnemen).toBe(true)
  })

  it('projecten zonder uren met een afgekorte tak', () => {
    const lc = zoek('Leescollege')
    expect(lc?.zonderUren).toBe(true)
    expect(lc?.tak?.id).toBe('dll')
  })

  it('markeert projecten die op elkaar lijken, ook over tabbladen heen', () => {
    expect(zoek('Verbouwing Elspeet', 'ldv')?.lijktOp).toEqual(['Verbouwing Elspeet (met Open+) (STAF)'])
    expect(zoek('Groepsbezoeken')?.lijktOp).toEqual(['Groepsbezoeken (LDV)'])
    expect(zoek('Vakantielezen')?.lijktOp).toEqual([])
  })

  it('alsImport: alleen wat aangevinkt is, met de gegevens uit de Excel in de toelichting', () => {
    const rijen = alsImport(voorstel, 2027)
    expect(rijen.map((r) => r.naam)).not.toContain('Digilabs')
    const vakantie = rijen.find((r) => r.naam === 'Vakantielezen')
    expect(vakantie).toEqual({
      naam: 'Vakantielezen',
      afdeling: 'PROG',
      tak: 'Doorgaande leeslijn',
      programma: null,
      startdatum: '2027-01-01',
      einddatum: '2027-12-31',
      budget: 750,
      toelichting: 'Uit de Excel: Vakantielezen (Programmering, rij 8).',
    })
    expect(rijen.find((r) => r.naam === 'Vrijwilligersuitje')?.toelichting).toBe(
      'Uit de Excel: Vrijwilligersuitje (Staf, rij 6, 7).\nInzet van: LDV, PROG.\nProjectleden: projectleider en 3 anderen.\nBegin: februari 2027.',
    )
  })
})
