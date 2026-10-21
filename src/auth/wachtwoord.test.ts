import { describe, expect, it } from 'vitest'
import { wachtwoordProblemen } from './wachtwoord'
import { inlogFout, normaliseerCode } from './foutmeldingen'

describe('wachtwoordProblemen', () => {
  it('accepteert een sterk wachtwoord', () => {
    expect(wachtwoordProblemen('Bibliotheek2026')).toEqual([])
  })

  it('noemt alles wat ontbreekt', () => {
    expect(wachtwoordProblemen('kort')).toEqual(['minstens 12 tekens', 'een hoofdletter', 'een cijfer'])
  })

  it('weigert meer dan 72 bytes (grens van bcrypt)', () => {
    expect(wachtwoordProblemen(`Aa1${'é'.repeat(35)}`)).toContain('niet langer dan 72 tekens')
  })
})

describe('foutmeldingen', () => {
  it('verraadt niet of het e-mailadres bestaat', () => {
    expect(inlogFout({ code: 'invalid_credentials', status: 400 })).toBe('E-mailadres of wachtwoord klopt niet.')
  })

  it('meldt een gedeactiveerd account (weigering door de hook)', () => {
    expect(inlogFout({ status: 403 })).toMatch(/niet actief/)
  })

  it('normaliseert een geplakte code', () => {
    expect(normaliseerCode('123 456')).toBe('123456')
    expect(normaliseerCode('12345')).toBeNull()
    expect(normaliseerCode('12345a')).toBeNull()
  })
})
