import { describe, expect, it } from 'vitest'
import { hoortBij, isGroep, MENU, zichtbaarMenu } from './navigatie'

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
  it('beheerder ziet beheer en instellingen', () => {
    expect(menu('beheerder')).toEqual([
      'Start',
      'Beheer: Scholen, Medewerkers, Projectgroepen, Jaar en staffel',
      'Instellingen: Gebruikers, Auditlog',
    ])
  })

  it('teamleider ziet beheer, maar geen instellingen', () => {
    expect(menu('teamleider')).toEqual(['Start', 'Beheer: Scholen, Medewerkers, Projectgroepen, Jaar en staffel'])
  })

  it('medewerker en alleen-lezen zien alleen Start', () => {
    expect(menu('medewerker')).toEqual(['Start'])
    expect(menu('alleen-lezen')).toEqual(['Start'])
  })

  it('zonder rechten (nog aan het laden) niets', () => {
    expect(menu('onbekend')).toEqual([])
  })

  it('laat in een groep alleen de items zien waar je recht op hebt', () => {
    const alleenAuditlog = zichtbaarMenu(MENU, (r) => r === 'auditlog.lezen')
    expect(alleenAuditlog).toEqual([{ label: 'Instellingen', items: [{ pad: '/auditlog', label: 'Auditlog', recht: 'auditlog.lezen' }] }])
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
