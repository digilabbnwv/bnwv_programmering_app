import { Link, useLocation, useParams } from 'react-router'
import type { TabbladDefinitie } from './paginas'

/**
 * Het actieve tabblad uit het adres (`:tab?` in de route), of null bij een
 * onbekend tabblad. Het eerste tabblad heeft een leeg pad.
 */
export function useTabblad(tabbladen: readonly TabbladDefinitie[]): string | null {
  const { tab = '' } = useParams()
  return tabbladen.some((t) => t.pad === tab) ? tab : null
}

/**
 * Tabbladen van een pagina (docs/navigatie.md, hoofdstuk 4): links met
 * aria-current, elk met een eigen adres, zodat de terugknop en gedeelde links
 * werken. De zoekparameters (zoals ?jaar=) blijven staan. Met minder dan twee
 * zichtbare tabbladen niets. Een teller toont het aantal meldingen in een
 * tabblad, zodat die niet verstopt raken.
 */
export function Tabbladen({
  tabbladen,
  actief,
  tellers = {},
  verborgen = [],
}: {
  tabbladen: readonly TabbladDefinitie[]
  actief: string
  tellers?: Record<string, number>
  verborgen?: readonly string[]
}) {
  const { pathname, search } = useLocation()
  const zichtbaar = tabbladen.filter((t) => !verborgen.includes(t.pad))
  if (zichtbaar.length < 2) return null
  const basis = actief ? pathname.slice(0, -(actief.length + 1)) : pathname

  return (
    <nav aria-label="Onderdelen van deze pagina" className="mb-8 border-b border-neutral-200 print:hidden">
      <ul className="-mb-px flex gap-6 overflow-x-auto">
        {zichtbaar.map((t) => {
          const isActief = t.pad === actief
          const teller = tellers[t.pad] ?? 0
          return (
            <li key={t.pad} className="flex">
              <Link
                to={{ pathname: t.pad ? `${basis}/${t.pad}` : basis, search }}
                aria-current={isActief ? 'page' : undefined}
                className={`flex items-center gap-2 border-b-[3px] pt-1 pb-3 whitespace-nowrap ${
                  isActief ? 'border-orange font-semibold' : 'border-transparent font-medium text-neutral-700 hover:text-anthracite'
                }`}
              >
                {t.label}
                {teller > 0 && (
                  <span className="rounded-pill bg-neutral-100 px-2 py-0.5 text-ui-xs font-semibold text-anthracite tabular-nums">
                    {teller}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
