/**
 * Alle pagina's van de app na het inloggen: pad, het recht om de pagina te
 * zien en, voor pagina's in het menu, de naam en het icoon. De router
 * (router.tsx), het menu (navigatie.ts) en het kruimelpad lezen hieruit, zodat
 * een recht maar op één plek staat. Alleen UX: zonder recht geeft de database
 * ook geen gegevens (RLS).
 */
export type IcoonNaam =
  | 'start'
  | 'persoon'
  | 'signaal'
  | 'balken'
  | 'taart'
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

  signalen: { pad: '/rapportage/signalen', recht: 'werkbelasting.bekijken', label: 'Signalen', icoon: 'signaal', metJaar: true },
  verdelingMedewerkers: {
    pad: '/rapportage/medewerkers',
    recht: 'werkbelasting.bekijken',
    label: 'Verdeling per medewerker',
    icoon: 'balken',
    metJaar: true,
  },
  verdelingProgrammas: {
    pad: '/rapportage/programmas',
    recht: 'werkbelasting.bekijken',
    label: 'Verdeling per programma',
    icoon: 'taart',
    metJaar: true,
  },
  // Eigen verdeling voor iedereen; die van anderen laat RLS alleen zien met werkbelasting.bekijken.
  werkbelasting: { pad: '/werkbelasting/:id', recht: 'app.gebruiken', ouder: 'verdelingMedewerkers', metJaar: true },
  medewerkers: { pad: '/medewerkers', recht: 'werkbelasting.beheren', label: 'Medewerkers', icoon: 'personen' },
  medewerker: { pad: '/medewerkers/:id', recht: 'werkbelasting.beheren', ouder: 'medewerkers' },

  scholen: { pad: '/scholen', recht: 'werkbelasting.beheren', label: 'Scholen', icoon: 'school', metJaar: true },
  school: { pad: '/scholen/:id', recht: 'werkbelasting.beheren', ouder: 'scholen' },
  programmas: { pad: '/programmas', recht: 'werkbelasting.beheren', label: 'Programma’s', icoon: 'lagen' },
  programma: { pad: '/programmas/:id', recht: 'werkbelasting.beheren', ouder: 'programmas' },
  projectgroepen: { pad: '/projectgroepen', recht: 'werkbelasting.beheren', label: 'Projectgroepen', icoon: 'groep' },
  projectgroep: { pad: '/projectgroepen/:id', recht: 'werkbelasting.beheren', ouder: 'projectgroepen' },
  taken: { pad: '/taken', recht: 'werkbelasting.beheren', label: 'Overige taken', icoon: 'lijst' },
  taak: { pad: '/taken/:id', recht: 'werkbelasting.beheren', ouder: 'taken' },

  projectplanner: { pad: '/projectplanner', recht: 'projectplan.bekijken', label: 'Dashboard', icoon: 'dashboard', metJaar: true },
  jaarplan: { pad: '/jaarplan', recht: 'projectplan.bekijken', label: 'Jaarplan', icoon: 'kalender', metJaar: true },
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

/** De pagina bij een pathname, of undefined (bijv. een onbekend adres). */
export function paginaBij(pathname: string): PaginaDefinitie | undefined {
  return Object.values(PAGINAS).find((p: PaginaDefinitie) => padPast(p.pad, pathname))
}
