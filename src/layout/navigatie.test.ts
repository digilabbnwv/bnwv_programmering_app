import { describe, expect, it } from 'vitest'
import { hoortBij, initialen, INSTELLINGEN, isGroep, MENU, zichtbaarMenu, zichtbareInstellingen } from './navigatie'
import { PAGINAS } from './paginas'

// Rechten per rol, gelijk aan de seed in de migraties basis_rechten, werkbelasting en organisatie.
const WERKBELASTING = ['werkbelasting.bekijken', 'werkbelasting.beheren']
const PROJECTPLAN = ['projectplan.bekijken', 'projectplan.beheren']
const ROLLEN: Record<string, string[]> = {
  beheerder: ['app.gebruiken', 'gebruikers.bekijken', 'gebruikers.beheren', 'auditlog.lezen', ...WERKBELASTING, ...PROJECTPLAN],
  mt: ['app.gebruiken', 'werkbelasting.bekijken', ...PROJECTPLAN],
  teamleider: ['app.gebruiken', 'gebruikers.bekijken', ...WERKBELASTING, 'projectplan.bekijken'],
  medewerker: ['app.gebruiken'],
  'alleen-lezen': ['app.gebruiken'],
}

/** Het menu als tekst: "Beheer: Scholen, ..." voor een groep. */
const menu = (rol: string) =>
  zichtbaarMenu(MENU, (r) => ROLLEN[rol]?.includes(r) ?? false).map((regel) =>
    isGroep(regel) ? `${regel.label}: ${regel.items.map((i) => i.label).join(', ')}` : regel.label,
  )

describe('zichtbaarMenu', () => {
  it('beheerder en teamleider zien rapportage, beheer en het jaarplan; alleen de beheerder ook de organisatie', () => {
    const rapportage = 'Rapportage: Signalen, Verdeling per programma, Verdeling per medewerker, Projectplanner'
    const beheer = 'Beheer: Scholen, Medewerkers, Projectgroepen, Overige taken, Programma’s, Jaar en staffel'
    expect(menu('beheerder')).toEqual(['Start', rapportage, `${beheer}, Jaarplan, Organisatie`])
    expect(menu('teamleider')).toEqual(['Start', rapportage, `${beheer}, Jaarplan`])
  })

  it('het MT ziet de rapportage en beheert het jaarplan en de organisatie', () => {
    expect(menu('mt')).toEqual([
      'Start',
      'Rapportage: Signalen, Verdeling per programma, Verdeling per medewerker, Projectplanner',
      'Beheer: Jaarplan, Organisatie',
    ])
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

describe('PAGINAS', () => {
  const paginas = Object.values(PAGINAS)

  it('heeft elk pad maar één keer', () => {
    const paden = paginas.map((p) => p.pad)
    expect(new Set(paden).size).toBe(paden.length)
  })

  it('menu en instellingen tonen alleen pagina’s uit PAGINAS, met hun naam en recht', () => {
    const items = [...MENU.flatMap((regel) => (isGroep(regel) ? regel.items : [regel])), ...INSTELLINGEN.items]
    for (const item of items) expect(paginas).toContain(item)
  })

  it('elke pagina met een naam staat in het menu of bij de instellingen', () => {
    const items = [...MENU.flatMap((regel) => (isGroep(regel) ? regel.items : [regel])), ...INSTELLINGEN.items]
    const metNaam = paginas.filter((p) => 'label' in p)
    expect(metNaam.filter((p) => !items.includes(p)).map((p) => p.pad)).toEqual([])
  })
})

describe('zichtbareInstellingen', () => {
  const instellingen = (rol: string) =>
    zichtbareInstellingen((r) => ROLLEN[rol]?.includes(r) ?? false).map((i) => i.label)

  it('alleen de beheerder heeft instellingen', () => {
    expect(instellingen('beheerder')).toEqual(['Gebruikers', 'Auditlog'])
    expect(instellingen('teamleider')).toEqual([])
    expect(instellingen('mt')).toEqual([])
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
