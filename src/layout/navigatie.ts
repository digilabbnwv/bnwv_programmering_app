import { PAGINAS, paginaBij, type IcoonNaam, type PaginaDefinitie, type PaginaSleutel } from './paginas'

/**
 * Het hoofdmenu (zijbalk), ingedeeld per onderwerp: zie docs/navigatie.md,
 * hoofdstuk 3. Pad, naam, icoon en recht komen uit PAGINAS (paginas.ts), net
 * als de routes; een groep zonder zichtbare items verdwijnt. Een nieuw
 * onderdeel van de app krijgt een regel in PAGINAS, een route in router.tsx en,
 * als het in het menu hoort, een plek hieronder.
 */
export interface NavItem {
  pad: string
  label: string
  recht: string
  icoon: IcoonNaam
}

export interface NavGroep {
  label: string
  items: readonly NavItem[]
}

export type NavRegel = NavItem | NavGroep

export const MENU: readonly NavRegel[] = [
  PAGINAS.start,
  PAGINAS.mijnWerkurenverdeling,
  {
    label: 'Werkbelasting',
    items: [PAGINAS.signalen, PAGINAS.verdelingMedewerkers, PAGINAS.verdelingProgrammas, PAGINAS.medewerkers],
  },
  {
    label: 'Inzet',
    items: [PAGINAS.scholen, PAGINAS.programmas, PAGINAS.projectgroepen, PAGINAS.taken],
  },
  {
    label: 'Projectplanner',
    items: [PAGINAS.projectplanner, PAGINAS.jaarplan],
  },
  {
    label: 'Inrichting',
    items: [PAGINAS.staffel, PAGINAS.organisatie],
  },
]

/** Onderaan de zijbalk: beheer van de app zelf. */
export const SYSTEEM: NavGroep = {
  label: 'Systeem',
  items: [PAGINAS.gebruikers, PAGINAS.auditlog],
}

/**
 * Bij zo weinig bestemmingen geen zijbalk, maar links in de kopbalk
 * (bijvoorbeeld een medewerker: Start en Mijn werkurenverdeling).
 */
export const MAX_ZONDER_ZIJBALK = 2

/** "Jasper Geertsma" → "JG", "Anna de Vries" → "AV". */
export function initialen(naam: string | null): string {
  const delen = (naam ?? '').trim().split(/\s+/).filter(Boolean)
  const eerste = delen[0]?.[0] ?? ''
  const laatste = delen.length > 1 ? (delen.at(-1)?.[0] ?? '') : ''
  return (eerste + laatste).toUpperCase() || '?'
}

export function isGroep(regel: NavRegel): regel is NavGroep {
  return 'items' in regel
}

/**
 * Het menu met alleen de items waar je recht op hebt; `verborgen` zijn paden
 * die er om een andere reden niet in horen (Mijn werkurenverdeling zonder
 * gekoppelde medewerker).
 */
export function zichtbaarMenu(
  menu: readonly NavRegel[],
  heeftRecht: (recht: string) => boolean,
  verborgen: readonly string[] = [],
): NavRegel[] {
  const zichtbaar = (item: NavItem) => heeftRecht(item.recht) && !verborgen.includes(item.pad)
  return menu.flatMap<NavRegel>((regel) => {
    if (!isGroep(regel)) return zichtbaar(regel) ? [regel] : []
    const items = regel.items.filter(zichtbaar)
    return items.length > 0 ? [{ ...regel, items }] : []
  })
}

/** Alle items van een menu als platte lijst. */
export function alleItems(menu: readonly NavRegel[]): NavItem[] {
  return menu.flatMap((regel) => (isGroep(regel) ? regel.items : [regel]))
}

/** Hoort de pagina bij dit item? Ook detailpagina's, bijv. /scholen/123 bij /scholen. */
export function hoortBij(pad: string, pathname: string): boolean {
  return pad === '/' ? pathname === '/' : pathname === pad || pathname.startsWith(`${pad}/`)
}

/** De menugroep waar een pagina in staat, of undefined (losse items als Start). */
export function groepVan(pagina: PaginaDefinitie): NavGroep | undefined {
  return [...MENU, SYSTEEM].filter(isGroep).find((g) => g.items.some((i) => i.pad === pagina.pad))
}

export interface Kruimel {
  label: string
  /** Zonder pad: alleen tekst (een groep is geen pagina). */
  pad?: string
}

/**
 * Het kruimelpad boven de titel, zonder de pagina zelf: de groep en, bij een
 * detailpagina, het overzicht erboven als je dat mag zien. Leeg voor Start,
 * losse items en onbekende adressen; ook leeg als het overzicht erboven niet
 * te zien is, want dan zegt de groep alleen niets.
 */
export function kruimels(pathname: string, heeftRecht: (recht: string) => boolean): Kruimel[] {
  const pagina = paginaBij(pathname)
  if (!pagina) return []
  const ouder: PaginaDefinitie | undefined = pagina.ouder ? PAGINAS[pagina.ouder as PaginaSleutel] : undefined
  if (ouder && !heeftRecht(ouder.recht)) return []
  const groep = groepVan(ouder ?? pagina)
  return [
    ...(groep ? [{ label: groep.label }] : []),
    ...(ouder?.label ? [{ label: ouder.label, pad: ouder.pad }] : []),
  ]
}
