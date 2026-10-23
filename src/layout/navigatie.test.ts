import { describe, expect, it } from 'vitest'
import { hoortBij, initialen, isGroep, MENU, zichtbaarMenu, zichtbareInstellingen } from './navigatie'

// Rechten per rol, gelijk aan de seed in de migraties basis_rechten en werkbelasting.
const WERKBELASTING = ['werkbelasting.bekijken', 'werkbelasting.beheren']
const ROLLEN: Record<string, string[]> = {
  beheerder: ['app.gebruiken', 'gebruikers.bekijken', 'gebruikers.beheren', 'auditlog.lezen', ...WERKBELASTING],
  teamleider: ['app.gebruiken', 'gebruikers.bekijken', ...WERKBELASTING],
  medewerker: ['app.gebruiken'],
  'alleen-lezen': ['app.gebruiken'],
}

/** Het menu als tekst: "Beheer: Scholen, ..." voor een groep. */
const menu = (rol: string) =>
  zichtbaarMenu(MENU, (r) => ROLLEN[rol]?.includes(r) ?? false).map((regel) =>
    isGroep(regel) ? `${regel.label}: ${regel.items.map((i) => i.label).join(', ')}` : regel.label,
  )

describe('zichtbaarMenu', () => {
  it('beheerder en teamleider zien rapportage en beheer', () => {
    const verwacht = ['Start', 'Rapportage', 'Beheer: Scholen, Medewerkers, Projectgroepen, Overige taken, Jaar en staffel']
    expect(menu('beheerder')).toEqual(verwacht)
    expect(menu('teamleider')).toEqual(verwacht)
  })

  it('medewerker en alleen-lezen zien alleen Start', () => {
    expect(menu('medewerker')).toEqual(['Start'])
    expect(menu('alleen-lezen')).toEqual(['Start'])
  })

  it('zonder rechten (nog aan het laden) niets', () => {
    expect(menu('onbekend')).toEqual([])
  })

  it('laat een groep zonder zichtbare items weg', () => {
    expect(zichtbaarMenu(MENU, (r) => r === 'app.gebruiken').map((r) => r.label)).toEqual(['Start'])
  })
})

describe('zichtbareInstellingen', () => {
  const instellingen = (rol: string) =>
    zichtbareInstellingen((r) => ROLLEN[rol]?.includes(r) ?? false).map((i) => i.label)

  it('alleen de beheerder heeft instellingen', () => {
    expect(instellingen('beheerder')).toEqual(['Gebruikers', 'Auditlog'])
    expect(instellingen('teamleider')).toEqual([])
    expect(instellingen('medewerker')).toEqual([])
  })
})

describe('initialen', () => {
  it('neemt de eerste letter van de eerste en de laatste naam', () => {
    expect(initialen('Jasper Geertsma')).toBe('JG')
    expect(initialen('Anna de Vries')).toBe('AV')
    expect(initialen('  ingeborg ')).toBe('I')
    expect(initialen(null)).toBe('?')
  })
})

describe('hoortBij', () => {
  it('rekent detailpagina’s tot hun overzicht', () => {
    expect(hoortBij('/scholen', '/scholen')).toBe(true)
    expect(hoortBij('/scholen', '/scholen/123')).toBe(true)
    expect(hoortBij('/scholen', '/scholenoverzicht')).toBe(false)
  })

  it('Start hoort alleen bij de startpagina', () => {
    expect(hoortBij('/', '/')).toBe(true)
    expect(hoortBij('/', '/scholen')).toBe(false)
  })
})
