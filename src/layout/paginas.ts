/**
 * Alle pagina's van de app na het inloggen: pad, het recht om de pagina te
 * zien en, voor pagina's in het menu, de naam. De router (router.tsx) en het
 * menu (navigatie.ts) lezen hieruit, zodat een recht maar op één plek staat.
 * Alleen UX: zonder recht geeft de database ook geen gegevens (RLS).
 */
export interface PaginaDefinitie {
  pad: string
  recht: string
  /** Naam in het menu; alleen voor pagina's die in het menu staan. */
  label?: string
}

export const PAGINAS = {
  start: { pad: '/', recht: 'app.gebruiken', label: 'Start' },

  signalen: { pad: '/rapportage/signalen', recht: 'werkbelasting.bekijken', label: 'Signalen' },
  verdelingProgrammas: { pad: '/rapportage/programmas', recht: 'werkbelasting.bekijken', label: 'Verdeling per programma' },
  verdelingMedewerkers: { pad: '/rapportage/medewerkers', recht: 'werkbelasting.bekijken', label: 'Verdeling per medewerker' },
  projectplanner: { pad: '/rapportage/projectplanner', recht: 'projectplan.bekijken', label: 'Projectplanner' },
  // Eigen verdeling voor iedereen; die van anderen laat RLS alleen zien met werkbelasting.bekijken.
  werkbelasting: { pad: '/werkbelasting/:id', recht: 'app.gebruiken' },

  scholen: { pad: '/scholen', recht: 'werkbelasting.beheren', label: 'Scholen' },
  school: { pad: '/scholen/:id', recht: 'werkbelasting.beheren' },
  medewerkers: { pad: '/medewerkers', recht: 'werkbelasting.beheren', label: 'Medewerkers' },
  medewerker: { pad: '/medewerkers/:id', recht: 'werkbelasting.beheren' },
  projectgroepen: { pad: '/projectgroepen', recht: 'werkbelasting.beheren', label: 'Projectgroepen' },
  projectgroep: { pad: '/projectgroepen/:id', recht: 'werkbelasting.beheren' },
  taken: { pad: '/taken', recht: 'werkbelasting.beheren', label: 'Overige taken' },
  taak: { pad: '/taken/:id', recht: 'werkbelasting.beheren' },
  programmas: { pad: '/programmas', recht: 'werkbelasting.beheren', label: 'Programma’s' },
  programma: { pad: '/programmas/:id', recht: 'werkbelasting.beheren' },
  staffel: { pad: '/staffel', recht: 'werkbelasting.beheren', label: 'Jaar en staffel' },

  jaarplan: { pad: '/jaarplan', recht: 'projectplan.bekijken', label: 'Jaarplan' },
  project: { pad: '/projecten/:id', recht: 'projectplan.bekijken' },
  organisatie: { pad: '/organisatie', recht: 'projectplan.beheren', label: 'Organisatie' },

  gebruikers: { pad: '/gebruikers', recht: 'gebruikers.beheren', label: 'Gebruikers' },
  auditlog: { pad: '/auditlog', recht: 'auditlog.lezen', label: 'Auditlog' },
} as const satisfies Record<string, PaginaDefinitie>
