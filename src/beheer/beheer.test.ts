import { describe, expect, it } from 'vitest'
import { beschrijfActie } from './auditlog'
import { beheerMelding } from './api'

const ROLLEN: Record<string, string> = { medewerker: 'Medewerker', teamleider: 'Teamleider' }
const rolNaam = (id: string) => ROLLEN[id] ?? id

describe('beschrijfActie', () => {
  it('noemt de inlogmethode', () => {
    expect(beschrijfActie({ action: 'auth.ingelogd', details: { methode: 'password' } }, rolNaam)).toBe(
      'Ingelogd met wachtwoord',
    )
    expect(beschrijfActie({ action: 'auth.ingelogd', details: { methode: 'totp' } }, rolNaam)).toBe(
      'Ingelogd met code uit de app',
    )
  })

  it('toont een rolwijziging met rolnamen', () => {
    expect(
      beschrijfActie({ action: 'gebruiker.rol_gewijzigd', details: { van: 'medewerker', naar: 'teamleider' } }, rolNaam),
    ).toBe('Rol gewijzigd: Medewerker → Teamleider')
  })

  it('valt terug op de technische naam bij een onbekende actie', () => {
    expect(beschrijfActie({ action: 'iets.nieuws', details: {} }, rolNaam)).toBe('iets.nieuws')
  })

  it('negeert details van het verkeerde type', () => {
    expect(beschrijfActie({ action: 'gebruiker.aangemaakt', details: { rol: 42 } }, rolNaam)).toBe(
      'Gebruiker aangemaakt',
    )
  })
})

describe('beheerMelding', () => {
  it('vertaalt bekende codes', () => {
    expect(beheerMelding('laatste_beheerder')).toBe('Er moet minstens één actieve beheerder blijven.')
    expect(beheerMelding('email_bestaat')).toMatch(/al een account/)
  })

  it('geeft een algemene melding bij een onbekende of ontbrekende code', () => {
    expect(beheerMelding('iets_anders')).toMatch(/lukt nu niet/)
    expect(beheerMelding(undefined)).toMatch(/lukt nu niet/)
  })
})
