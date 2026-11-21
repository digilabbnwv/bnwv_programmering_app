import { describe, expect, it } from 'vitest'
import { alleItems, hoortBij, initialen, isGroep, kruimels, MAX_ZONDER_ZIJBALK, MENU, SYSTEEM, zichtbaarMenu } from './navigatie'
import { metJaar, PAGINAS, paginaBij, padPast, plekBij, type PaginaDefinitie } from './paginas'

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
const rechtVan = (rol: string) => (recht: string) => ROLLEN[rol]?.includes(recht) ?? false

/** Het menu als tekst: "Inzet: Scholen, ..." voor een groep. */
const tekst = (regels: ReturnType<typeof zichtbaarMenu>) =>
  regels.map((regel) => (isGroep(regel) ? `${regel.label}: ${regel.items.map((i) => i.label).join(', ')}` : regel.label))
const menu = (rol: string) => tekst(zichtbaarMenu(MENU, rechtVan(rol)))
const systeem = (rol: string) => tekst(zichtbaarMenu([SYSTEEM], rechtVan(rol)))

describe('zichtbaarMenu', () => {
  const werkbelasting = 'Werkbelasting: Teamoverzicht, Medewerkers'
  const inzet = 'Inzet: Scholen, Programma’s, Projectgroepen, Overige taken'
  const projectplanner = 'Projectplanner: Dashboard, Jaarplan'

  it('beheerder en teamleider zien alle onderwerpen; alleen de beheerder ook organisatie en systeem', () => {
    expect(menu('beheerder')).toEqual([
      'Start',
      'Mijn werkurenverdeling',
      werkbelasting,
      inzet,
      projectplanner,
      'Inrichting: Jaar en staffel, Organisatie',
    ])
    expect(systeem('beheerder')).toEqual(['Systeem: Gebruikers, Auditlog'])
    expect(menu('teamleider')).toEqual([
      'Start',
      'Mijn werkurenverdeling',
      werkbelasting,
      inzet,
      projectplanner,
      'Inrichting: Jaar en staffel',
    ])
    expect(systeem('teamleider')).toEqual([])
  })

  it('het MT ziet de werkbelasting (ook de medewerkers, alleen-lezen), de projectplanner en de organisatie', () => {
    expect(menu('mt')).toEqual(['Start', 'Mijn werkurenverdeling', werkbelasting, projectplanner, 'Inrichting: Organisatie'])
  })

  it('medewerker en alleen-lezen zien Start en hun werkurenverdeling', () => {
    expect(menu('medewerker')).toEqual(['Start', 'Mijn werkurenverdeling'])
    expect(menu('alleen-lezen')).toEqual(['Start', 'Mijn werkurenverdeling'])
  })

  it('laat verborgen paden weg, bijv. Mijn werkurenverdeling zonder gekoppelde medewerker', () => {
    expect(tekst(zichtbaarMenu(MENU, rechtVan('medewerker'), [PAGINAS.mijnWerkurenverdeling.pad]))).toEqual(['Start'])
  })

  it('zonder rechten (nog aan het laden) niets', () => {
    expect(menu('onbekend')).toEqual([])
  })
})

describe('zijbalk of kopbalk', () => {
  const aantal = (rol: string) => alleItems([...zichtbaarMenu(MENU, rechtVan(rol)), ...zichtbaarMenu([SYSTEEM], rechtVan(rol))]).length

  it('een medewerker heeft te weinig bestemmingen voor een zijbalk', () => {
    expect(aantal('medewerker')).toBeLessThanOrEqual(MAX_ZONDER_ZIJBALK)
    expect(aantal('alleen-lezen')).toBeLessThanOrEqual(MAX_ZONDER_ZIJBALK)
  })

  it('MT, teamleider en beheerder krijgen een zijbalk', () => {
    for (const rol of ['mt', 'teamleider', 'beheerder']) expect(aantal(rol)).toBeGreaterThan(MAX_ZONDER_ZIJBALK)
  })
})

describe('PAGINAS', () => {
  const paginas: PaginaDefinitie[] = Object.values(PAGINAS)
  const items = alleItems([...MENU, SYSTEEM])

  it('heeft elk pad maar één keer', () => {
    const paden = paginas.map((p) => p.pad)
    expect(new Set(paden).size).toBe(paden.length)
  })

  it('menu en systeem tonen alleen pagina’s uit PAGINAS', () => {
    for (const item of items) expect(paginas).toContain(item)
  })

  it('elke pagina met een naam staat in het menu, met een icoon', () => {
    const metNaam = paginas.filter((p) => p.label !== undefined)
    expect(metNaam.filter((p) => !items.some((i) => i.pad === p.pad)).map((p) => p.pad)).toEqual([])
    expect(metNaam.filter((p) => !p.icoon).map((p) => p.pad)).toEqual([])
  })

  it('elke ouder bestaat en staat in het menu', () => {
    for (const p of paginas.filter((p) => p.ouder)) {
      const ouder: PaginaDefinitie | undefined = PAGINAS[p.ouder as keyof typeof PAGINAS]
      expect(ouder?.label, p.pad).toBeDefined()
    }
  })
})

describe('paginaBij', () => {
  it('vindt een pagina, ook met een id in het pad', () => {
    expect(paginaBij('/')).toBe(PAGINAS.start)
    expect(paginaBij('/scholen')).toBe(PAGINAS.scholen)
    expect(paginaBij('/scholen/abc-123')).toBe(PAGINAS.school)
    expect(paginaBij('/projectplanner')).toBe(PAGINAS.projectplanner)
  })

  it('geeft niets voor een onbekend adres', () => {
    expect(paginaBij('/bestaat-niet')).toBeUndefined()
    expect(paginaBij('/scholen/1/extra')).toBeUndefined()
  })

  it('padPast vergelijkt per deel', () => {
    expect(padPast('/taken/:id', '/taken/9')).toBe(true)
    expect(padPast('/taken/:id', '/taken')).toBe(false)
    expect(padPast('/', '/')).toBe(true)
  })
})

describe('plekBij en tabbladen', () => {
  it('vindt het tabblad en het adres van de pagina zonder tabblad', () => {
    const plek = plekBij('/medewerkers/12/werk')
    expect(plek?.pagina).toBe(PAGINAS.medewerker)
    expect(plek?.tab?.label).toBe('Werk')
    expect(plek?.basis).toBe('/medewerkers/12')
  })

  it('zonder tabblad in het adres: het eerste tabblad', () => {
    const plek = plekBij('/teamoverzicht')
    expect(plek?.pagina).toBe(PAGINAS.teamoverzicht)
    expect(plek?.tab?.label).toBe('Signalen')
    expect(plek?.basis).toBe('/teamoverzicht')
  })

  it('een onbekend tabblad hoort bij geen pagina', () => {
    expect(plekBij('/medewerkers/12/bestaat-niet')).toBeUndefined()
    expect(plekBij('/scholen/12/werk')).toBeUndefined()
  })

  it('de jaarkeuze per pagina of per tabblad', () => {
    expect(metJaar(plekBij('/teamoverzicht/medewerkers'))).toBe(true)
    expect(metJaar(plekBij('/medewerkers/12'))).toBe(false)
    expect(metJaar(plekBij('/medewerkers/12/werkurenverdeling'))).toBe(true)
    expect(metJaar(plekBij('/organisatie'))).toBe(false)
    expect(metJaar(undefined)).toBe(false)
  })

  it('elk tabblad heeft een uniek pad en het eerste een leeg pad', () => {
    for (const p of Object.values(PAGINAS) as PaginaDefinitie[]) {
      if (!p.tabbladen) continue
      expect(p.tabbladen[0]?.pad, p.pad).toBe('')
      expect(new Set(p.tabbladen.map((t) => t.pad)).size, p.pad).toBe(p.tabbladen.length)
    }
  })
})

describe('kruimels', () => {
  it('een overzicht: alleen de groep', () => {
    expect(kruimels('/scholen', rechtVan('beheerder'))).toEqual([{ label: 'Inzet' }])
    expect(kruimels('/gebruikers', rechtVan('beheerder'))).toEqual([{ label: 'Systeem' }])
  })

  it('een detailpagina: de groep en het overzicht erboven als link', () => {
    expect(kruimels('/scholen/1', rechtVan('beheerder'))).toEqual([{ label: 'Inzet' }, { label: 'Scholen', pad: '/scholen' }])
    expect(kruimels('/projecten/1', rechtVan('mt'))).toEqual([{ label: 'Projectplanner' }, { label: 'Jaarplan', pad: '/jaarplan' }])
    expect(kruimels('/medewerkers/1/werkurenverdeling', rechtVan('mt'))).toEqual([
      { label: 'Werkbelasting' },
      { label: 'Medewerkers', pad: '/medewerkers' },
    ])
    expect(kruimels('/teamoverzicht/programmas', rechtVan('mt'))).toEqual([{ label: 'Werkbelasting' }])
  })

  it('geen kruimelpad als je het overzicht erboven niet mag zien', () => {
    expect(kruimels('/medewerkers/1', rechtVan('medewerker'))).toEqual([])
  })

  it('geen kruimelpad voor Start, losse items en onbekende adressen', () => {
    expect(kruimels('/', rechtVan('beheerder'))).toEqual([])
    expect(kruimels('/mijn-werkurenverdeling', rechtVan('medewerker'))).toEqual([])
    expect(kruimels('/bestaat-niet', rechtVan('beheerder'))).toEqual([])
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
