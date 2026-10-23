import { describe, expect, it } from 'vitest'
import { foutmelding } from './api'
import { formatDatum, formatPeriode, getalAlsTekst, leesGetal, loopt } from './opmaak'

describe('leesGetal', () => {
  it('accepteert komma en punt', () => {
    expect(leesGetal('32')).toBe(32)
    expect(leesGetal('32,5')).toBe(32.5)
    expect(leesGetal(' 1.5 ')).toBe(1.5)
    expect(leesGetal('-20')).toBe(-20)
  })

  it('geeft null bij leeg of ongeldig', () => {
    expect(leesGetal('')).toBeNull()
    expect(leesGetal('abc')).toBeNull()
    expect(leesGetal('1.504,0')).toBeNull()
  })

  it('zet getallen terug om naar invoer', () => {
    expect(getalAlsTekst(32.5)).toBe('32,5')
    expect(getalAlsTekst(null)).toBe('')
  })
})

describe('datums', () => {
  it('formatteert een datum en een periode', () => {
    expect(formatDatum('2026-10-01')).toBe('1 okt 2026')
    expect(formatPeriode('2026-01-01', null)).toBe('1 jan 2026 – lopend')
  })

  it('bepaalt of een periode loopt, met inclusieve einddatum', () => {
    expect(loopt({ startdatum: '2026-01-01', einddatum: null }, '2026-05-01')).toBe(true)
    expect(loopt({ startdatum: '2026-01-01', einddatum: '2026-05-01' }, '2026-05-01')).toBe(true)
    expect(loopt({ startdatum: '2026-01-01', einddatum: '2026-04-30' }, '2026-05-01')).toBe(false)
    expect(loopt({ startdatum: '2026-06-01', einddatum: null }, '2026-05-01')).toBe(false)
  })
})

describe('foutmelding', () => {
  it('vertaalt foutcodes naar vaste teksten, met eigen teksten voorrang', () => {
    expect(foutmelding('23P01')).toBe('Dit overlapt met een bestaande periode.')
    expect(foutmelding('23505', { '23505': 'Er is al een school met deze naam.' })).toBe(
      'Er is al een school met deze naam.',
    )
    expect(foutmelding('XX000')).toBe('Dat lukt nu niet. Probeer het later opnieuw.')
    expect(foutmelding(undefined)).toBe('Dat lukt nu niet. Probeer het later opnieuw.')
  })
})
