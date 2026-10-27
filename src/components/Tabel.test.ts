import { describe, expect, it } from 'vitest'
import { sorteerRijen, type Kolom } from './Tabel'

type Rij = { naam: string; uren: number }

const RIJEN: Rij[] = [
  { naam: 'Ömer', uren: 10 },
  { naam: 'anna', uren: 30 },
  { naam: 'Bram', uren: 10 },
]
const naam: Kolom<Rij> = { kop: 'Naam', inhoud: (r) => r.naam, sorteer: (r) => r.naam }
const uren: Kolom<Rij> = { kop: 'Uren', inhoud: (r) => r.uren, getal: true, sorteer: (r) => r.uren }

describe('sorteerRijen', () => {
  it('sorteert tekst op z’n Nederlands, oplopend en aflopend', () => {
    expect(sorteerRijen(RIJEN, naam, 'oplopend').map((r) => r.naam)).toEqual(['anna', 'Bram', 'Ömer'])
    expect(sorteerRijen(RIJEN, naam, 'aflopend').map((r) => r.naam)).toEqual(['Ömer', 'Bram', 'anna'])
  })

  it('sorteert getallen en laat gelijke waarden in de oude volgorde', () => {
    expect(sorteerRijen(RIJEN, uren, 'oplopend').map((r) => r.naam)).toEqual(['Ömer', 'Bram', 'anna'])
    expect(sorteerRijen(RIJEN, uren, 'aflopend').map((r) => r.naam)).toEqual(['anna', 'Ömer', 'Bram'])
  })

  it('laat de volgorde staan voor een kolom zonder sorteerwaarde', () => {
    expect(sorteerRijen(RIJEN, { kop: 'X', inhoud: () => '' }, 'oplopend')).toEqual(RIJEN)
  })
})
