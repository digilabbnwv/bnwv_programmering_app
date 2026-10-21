/**
 * Menu-items met het recht dat nodig is om ze te zien. Een nieuw onderdeel
 * van de app krijgt hier een regel en een route in router.tsx.
 */
export interface NavItem {
  pad: string
  label: string
  recht: string
}

export const NAV_ITEMS: readonly NavItem[] = [
  { pad: '/', label: 'Start', recht: 'app.gebruiken' },
  { pad: '/gebruikers', label: 'Gebruikers', recht: 'gebruikers.bekijken' },
  { pad: '/auditlog', label: 'Auditlog', recht: 'auditlog.lezen' },
]

export function zichtbareItems(
  items: readonly NavItem[],
  heeftRecht: (recht: string) => boolean,
): NavItem[] {
  return items.filter((item) => heeftRecht(item.recht))
}
