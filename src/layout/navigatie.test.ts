import { describe, expect, it } from 'vitest'
import { NAV_ITEMS, zichtbareItems } from './navigatie'

// Rechten per rol, gelijk aan de seed in de migratie basis_rechten.
const ROLLEN: Record<string, string[]> = {
  beheerder: ['app.gebruiken', 'gebruikers.bekijken', 'gebruikers.beheren', 'auditlog.lezen'],
  teamleider: ['app.gebruiken', 'gebruikers.bekijken'],
  medewerker: ['app.gebruiken'],
  'alleen-lezen': ['app.gebruiken'],
}

const labels = (rol: string) =>
  zichtbareItems(NAV_ITEMS, (r) => ROLLEN[rol]?.includes(r) ?? false).map((i) => i.label)

describe('zichtbareItems', () => {
  it('beheerder ziet alles', () => {
    expect(labels('beheerder')).toEqual(['Start', 'Gebruikers', 'Auditlog'])
  })

  it('teamleider ziet gebruikers, niet de auditlog', () => {
    expect(labels('teamleider')).toEqual(['Start', 'Gebruikers'])
  })

  it('medewerker en alleen-lezen zien alleen Start', () => {
    expect(labels('medewerker')).toEqual(['Start'])
    expect(labels('alleen-lezen')).toEqual(['Start'])
  })

  it('zonder rechten (nog aan het laden) niets', () => {
    expect(labels('onbekend')).toEqual([])
  })
})
