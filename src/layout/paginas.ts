/**
 * Alle pagina's van de app na het inloggen: pad, het recht om de pagina te
 * zien en, voor pagina's in het menu, de naam en het icoon. De router
 * (router.tsx), het menu (navigatie.ts), het kruimelpad en de tabbladen lezen
 * hieruit, zodat een recht maar op één plek staat. Alleen UX: zonder recht
 * geeft de database ook geen gegevens (RLS).
 */
export type IcoonNaam =
  | 'start'
  | 'persoon'
  | 'balken'
  | 'personen'
  | 'school'
  | 'lagen'
  | 'groep'
  | 'lijst'
  | 'dashboard'
  | 'kalender'
  | 'schuiven'
  | 'organisatie'
  | 'schild'
  | 'logboek'

/**
 * Een tabblad van een pagina (docs/navigatie.md, hoofdstuk 4). Het eerste
 * tabblad heeft een leeg pad en staat op het adres van de pagina zelf; de
 * andere op het adres plus "/pad".
 */
export interface TabbladDefinitie {
  pad: string
  label: string
  /** Alleen dit tabblad hangt af van het jaar (de pagina als geheel niet). */
  metJaar?: boolean
}

export interface PaginaDefinitie {
  pad: string
  recht: string
  /** Naam in het menu; alleen voor pagina's die in het menu staan. */
  label?: string
  /** Icoon in de ingeklapte zijbalk; hoort bij een label. */
  icoon?: IcoonNaam
  /** Sleutel in PAGINAS van de pagina erboven in het kruimelpad, bij een detailpagina. */
  ouder?: string
  /** De pagina hangt af van het jaar; de kopbalk toont dan de jaarkeuze. */
  metJaar?: boolean
  tabbladen?: readonly TabbladDefinitie[]
}

export const PAGINAS = {
  start: { pad: '/', recht: 'app.gebruiken', label: 'Start', icoon: 'start', metJaar: true },
  mijnWerkurenverdeling: {
    pad: '/mijn-werkurenverdeling',
    recht: 'app.gebruiken',
    label: 'Mijn werkurenverdeling',
    icoon: 'persoon',
    metJaar: true,
  },

  teamoverzicht: {
    pad: '/teamoverzicht',
    recht: 'werkbelasting.bekijken',
    label: 'Teamoverzicht',
    icoon: 'balken',
    metJaar: true,
    tabbladen: [
      { pad: '', label: 'Signalen' },
      { pad: 'medewerkers', label: 'Per medewerker' },
      { pad: 'programmas', label: 'Per programma' },
    ],
  },
  // Met werkbelasting.bekijken alleen-lezen (MT); wijzigen met werkbelasting.beheren.
  medewerkers: { pad: '/medewerkers', recht: 'werkbelasting.bekijken', label: 'Medewerkers', icoon: 'personen', metJaar: true },
  medewerker: {
    pad: '/medewerkers/:id',
    recht: 'werkbelasting.bekijken',
    ouder: 'medewerkers',
    tabbladen: [
      { pad: '', label: 'Gegevens en contract' },
      { pad: 'werk', label: 'Werk' },
      { pad: 'extra-uren', label: 'Extra uren' },
      { pad: 'werkurenverdeling', label: 'Werkurenverdeling', metJaar: true },
    ],
  },

  scholen: { pad: '/scholen', recht: 'werkbelasting.beheren', label: 'Scholen', icoon: 'school', metJaar: true },
  school: { pad: '/scholen/:id', recht: 'werkbelasting.beheren', ouder: 'scholen' },
  programmas: { pad: '/programmas', recht: 'werkbelasting.beheren', label: 'Programma’s', icoon: 'lagen' },
  programma: { pad: '/programmas/:id', recht: 'werkbelasting.beheren', ouder: 'programmas' },
  projectgroepen: { pad: '/projectgroepen', recht: 'werkbelasting.beheren', label: 'Projectgroepen', icoon: 'groep' },
  projectgroep: { pad: '/projectgroepen/:id', recht: 'werkbelasting.beheren', ouder: 'projectgroepen' },
  taken: { pad: '/taken', recht: 'werkbelasting.beheren', label: 'Overige taken', icoon: 'lijst' },
  taak: { pad: '/taken/:id', recht: 'werkbelasting.beheren', ouder: 'taken' },

  projectplanner: {
    pad: '/projectplanner',
    recht: 'projectplan.bekijken',
    label: 'Dashboard',
    icoon: 'dashboard',
    metJaar: true,
    tabbladen: [
      { pad: '', label: 'Signalen' },
      { pad: 'drukte', label: 'Drukte' },
      { pad: 'budget', label: 'Budget' },
      { pad: 'tijdlijn', label: 'Tijdlijn' },
    ],
  },
  jaarplan: {
    pad: '/jaarplan',
    recht: 'projectplan.bekijken',
    label: 'Jaarplan',
    icoon: 'kalender',
    metJaar: true,
    tabbladen: [
      { pad: '', label: 'Projecten' },
      { pad: 'afwijkingen', label: 'Afwijkingen' },
      { pad: 'excel', label: 'Vergelijken met de Excel' },
    ],
  },
  project: { pad: '/projecten/:id', recht: 'projectplan.bekijken', ouder: 'jaarplan' },

  staffel: { pad: '/staffel', recht: 'werkbelasting.beheren', label: 'Jaar en staffel', icoon: 'schuiven', metJaar: true },
  organisatie: { pad: '/organisatie', recht: 'projectplan.beheren', label: 'Organisatie', icoon: 'organisatie' },

  gebruikers: { pad: '/gebruikers', recht: 'gebruikers.beheren', label: 'Gebruikers', icoon: 'schild' },
  auditlog: { pad: '/auditlog', recht: 'auditlog.lezen', label: 'Auditlog', icoon: 'logboek' },
} as const satisfies Record<string, PaginaDefinitie>

export type PaginaSleutel = keyof typeof PAGINAS

/** Past een pad uit PAGINAS (met :id) op een pathname? */
export function padPast(patroon: string, pathname: string): boolean {
  const p = patroon.split('/').filter(Boolean)
  const d = pathname.split('/').filter(Boolean)
  return p.length === d.length && p.every((deel, i) => deel.startsWith(':') || deel === d[i])
}

export interface Plek {
  pagina: PaginaDefinitie
  /** Het actieve tabblad, bij een pagina met tabbladen. */
  tab?: TabbladDefinitie
  /** Het adres van de pagina zonder tabblad, bijv. /medewerkers/12 bij /medewerkers/12/werk. */
  basis: string
}

/** Pagina en tabblad bij een pathname, of undefined (bijv. een onbekend adres). */
export function plekBij(pathname: string): Plek | undefined {
  const paginas: PaginaDefinitie[] = Object.values(PAGINAS)
  for (const pagina of paginas) {
    const tabbladen = pagina.tabbladen ?? []
    if (padPast(pagina.pad, pathname)) return { pagina, tab: tabbladen.find((t) => t.pad === ''), basis: pathname }
    const delen = pathname.split('/')
    const laatste = delen.pop() ?? ''
    const basis = delen.join('/')
    const tab = tabbladen.find((t) => t.pad !== '' && t.pad === laatste)
    if (tab && padPast(pagina.pad, basis)) return { pagina, tab, basis }
  }
  return undefined
}

/** De pagina bij een pathname, of undefined (bijv. een onbekend adres). */
export function paginaBij(pathname: string): PaginaDefinitie | undefined {
  return plekBij(pathname)?.pagina
}

/** Toont de kopbalk hier de jaarkeuze? */
export function metJaar(plek: Plek | undefined): boolean {
  return plek?.tab?.metJaar ?? plek?.pagina.metJaar ?? false
}
