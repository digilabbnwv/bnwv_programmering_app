import { describe, expect, it } from 'vitest'
import {
  ACTIVITEIT_SLEUTEL,
  WAARSCHUWING_MS,
  bepaalInactiviteit,
  leesLaatsteActiviteit,
  registreerActiviteit,
} from './inactiviteit'

const MINUUT = 60_000
const TIMEOUT = 15 * MINUUT

describe('bepaalInactiviteit', () => {
  it('actief tot 2 minuten voor het einde', () => {
    expect(bepaalInactiviteit(0, 13 * MINUUT - 1, TIMEOUT)).toEqual({ soort: 'actief' })
  })

  it('waarschuwing in de laatste 2 minuten', () => {
    expect(bepaalInactiviteit(0, 13 * MINUUT, TIMEOUT)).toEqual({ soort: 'waarschuwing', resterendMs: WAARSCHUWING_MS })
    expect(bepaalInactiviteit(0, TIMEOUT - 1, TIMEOUT)).toEqual({ soort: 'waarschuwing', resterendMs: 1 })
  })

  it('verlopen na de timeout', () => {
    expect(bepaalInactiviteit(0, TIMEOUT, TIMEOUT)).toEqual({ soort: 'verlopen' })
  })

  it('zonder bekend tijdstip: verlopen', () => {
    expect(bepaalInactiviteit(null, 0, TIMEOUT)).toEqual({ soort: 'verlopen' })
  })
})

describe('opslag van de laatste activiteit', () => {
  function geheugen() {
    const data = new Map<string, string>()
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    }
  }

  it('schrijft en leest het tijdstip', () => {
    const opslag = geheugen()
    registreerActiviteit(opslag, 1234)
    expect(leesLaatsteActiviteit(opslag)).toBe(1234)
  })

  it('negeert ontbrekende of ongeldige waarden', () => {
    const opslag = geheugen()
    expect(leesLaatsteActiviteit(opslag)).toBeNull()
    opslag.setItem(ACTIVITEIT_SLEUTEL, 'onzin')
    expect(leesLaatsteActiviteit(opslag)).toBeNull()
  })
})
