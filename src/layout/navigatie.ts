/**
 * Het hoofdmenu: losse items en groepen (op een groot scherm een uitklapmenu).
 * Elk item heeft het recht dat nodig is om het te zien; een groep zonder
 * zichtbare items verdwijnt. Een nieuw onderdeel van de app krijgt hier een
 * regel en een route in router.tsx met hetzelfde recht.
 */
export interface NavItem {
  pad: string
  label: string
  recht: string
}

export interface NavGroep {
  label: string
  items: readonly NavItem[]
}

export type NavRegel = NavItem | NavGroep

export const MENU: readonly NavRegel[] = [
  { pad: '/', label: 'Start', recht: 'app.gebruiken' },
  {
    label: 'Beheer',
    items: [
      { pad: '/scholen', label: 'Scholen', recht: 'werkbelasting.beheren' },
      { pad: '/medewerkers', label: 'Medewerkers', recht: 'werkbelasting.beheren' },
      { pad: '/projectgroepen', label: 'Projectgroepen', recht: 'werkbelasting.beheren' },
      { pad: '/staffel', label: 'Jaar en staffel', recht: 'werkbelasting.beheren' },
    ],
  },
  {
    label: 'Instellingen',
    items: [
      { pad: '/gebruikers', label: 'Gebruikers', recht: 'gebruikers.beheren' },
      { pad: '/auditlog', label: 'Auditlog', recht: 'auditlog.lezen' },
    ],
  },
]

export function isGroep(regel: NavRegel): regel is NavGroep {
  return 'items' in regel
}

export function zichtbaarMenu(menu: readonly NavRegel[], heeftRecht: (recht: string) => boolean): NavRegel[] {
  return menu.flatMap<NavRegel>((regel) => {
    if (!isGroep(regel)) return heeftRecht(regel.recht) ? [regel] : []
    const items = regel.items.filter((item) => heeftRecht(item.recht))
    return items.length > 0 ? [{ ...regel, items }] : []
  })
}

/** Hoort de pagina bij dit item? Ook detailpagina's, bijv. /scholen/123 bij /scholen. */
export function hoortBij(pad: string, pathname: string): boolean {
  return pad === '/' ? pathname === '/' : pathname === pad || pathname.startsWith(`${pad}/`)
}
