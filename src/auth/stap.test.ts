import { describe, expect, it } from 'vitest'
import { bepaalStap, leesClaims, type TokenClaims } from './stap'

const basis: TokenClaims = {
  sub: '00000000-0000-0000-0000-000000000001',
  aal: 'aal2',
  user_role: 'medewerker',
  is_active: true,
  must_change_password: false,
}

function token(payload: object): string {
  const b64 = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${b64('{"alg":"none"}')}.${b64(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload))))}.x`
}

describe('bepaalStap', () => {
  it('zonder sessie: inloggen', () => {
    expect(bepaalStap({ claims: null, heeftGeverifieerdeFactor: false })).toBe('inloggen')
  })

  it('zonder rol of niet actief: inloggen', () => {
    expect(bepaalStap({ claims: { ...basis, user_role: undefined }, heeftGeverifieerdeFactor: true })).toBe('inloggen')
    expect(bepaalStap({ claims: { ...basis, is_active: false }, heeftGeverifieerdeFactor: true })).toBe('inloggen')
  })

  it('AAL1 zonder gekoppelde app: 2FA instellen', () => {
    expect(bepaalStap({ claims: { ...basis, aal: 'aal1' }, heeftGeverifieerdeFactor: false })).toBe('2fa-instellen')
  })

  it('AAL1 met gekoppelde app: code controleren', () => {
    expect(bepaalStap({ claims: { ...basis, aal: 'aal1' }, heeftGeverifieerdeFactor: true })).toBe('2fa-controleren')
  })

  it('2FA eerst, dan pas het tijdelijke wachtwoord wijzigen', () => {
    const tijdelijk = { ...basis, must_change_password: true }
    expect(bepaalStap({ claims: { ...tijdelijk, aal: 'aal1' }, heeftGeverifieerdeFactor: false })).toBe('2fa-instellen')
    expect(bepaalStap({ claims: tijdelijk, heeftGeverifieerdeFactor: true })).toBe('wachtwoord-wijzigen')
  })

  it('ontbrekende must_change_password-claim telt als tijdelijk', () => {
    expect(bepaalStap({ claims: { ...basis, must_change_password: undefined }, heeftGeverifieerdeFactor: true })).toBe(
      'wachtwoord-wijzigen',
    )
  })

  it('AAL2 met definitief wachtwoord: klaar', () => {
    expect(bepaalStap({ claims: basis, heeftGeverifieerdeFactor: true })).toBe('klaar')
  })
})

describe('leesClaims', () => {
  it('leest de payload, ook met tekens buiten ASCII', () => {
    expect(leesClaims(token({ ...basis, naam: 'Jörg' }))).toMatchObject({ ...basis, naam: 'Jörg' })
  })

  it('geeft een leeg object bij een ongeldig token', () => {
    expect(leesClaims('geen-token')).toEqual({})
    expect(leesClaims('a.!!!.c')).toEqual({})
  })
})
