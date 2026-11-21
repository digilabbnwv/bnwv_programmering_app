import { describe, expect, it } from 'vitest'
import { bepaalJaar, jarenInKeuze, leesJaar } from './jaarkeuze'

describe('leesJaar', () => {
  it('accepteert alleen een jaar van vier cijfers tussen 2000 en 2100', () => {
    expect(leesJaar('2027')).toBe(2027)
    expect(leesJaar('1999')).toBeNull()
    expect(leesJaar('2101')).toBeNull()
    expect(leesJaar('27')).toBeNull()
    expect(leesJaar('2027abc')).toBeNull()
    expect(leesJaar('')).toBeNull()
    expect(leesJaar(null)).toBeNull()
  })
})

describe('bepaalJaar', () => {
  it('de URL gaat voor, dan het onthouden jaar, dan het huidige jaar', () => {
    expect(bepaalJaar('2027', '2025', 2026)).toBe(2027)
    expect(bepaalJaar(null, '2025', 2026)).toBe(2025)
    expect(bepaalJaar(null, null, 2026)).toBe(2026)
  })

  it('slaat een ongeldige waarde over', () => {
    expect(bepaalJaar('kapot', '2025', 2026)).toBe(2025)
    expect(bepaalJaar('kapot', 'ook kapot', 2026)).toBe(2026)
  })
})

describe('jarenInKeuze', () => {
  it('bekende jaren, het huidige en het gekozen jaar, gesorteerd en zonder dubbele', () => {
    expect(jarenInKeuze([2027, 2025, 2026, 2027], 2026, 2026)).toEqual([2025, 2026, 2027])
    expect(jarenInKeuze([], 2026, 2030)).toEqual([2026, 2030])
  })
})
