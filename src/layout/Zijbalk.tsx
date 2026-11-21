import { useId, useState, type FocusEvent, type PointerEvent } from 'react'
import { NavLink, useLocation } from 'react-router'
import { Icoon } from './Icoon'
import { hoortBij, isGroep, type NavItem, type NavRegel } from './navigatie'

const SLEUTEL = 'bnwv.zijbalk'

function leesIngeklapt(): boolean {
  try {
    return localStorage.getItem(SLEUTEL) === 'ingeklapt'
  } catch {
    return false
  }
}

function bewaarIngeklapt(ingeklapt: boolean): void {
  try {
    if (ingeklapt) localStorage.setItem(SLEUTEL, 'ingeklapt')
    else localStorage.removeItem(SLEUTEL)
  } catch {
    // Geen opslag: de keuze geldt tot de pagina sluit.
  }
}

/**
 * Het hoofdmenu op een groot scherm: groepen per onderwerp, onderaan Systeem
 * en de knop om in te klappen tot iconen (docs/navigatie.md, hoofdstuk 3).
 * Ingeklapt staat de naam van een item in sr-only en, bij hover of focus, in
 * een tooltip naast de balk.
 */
export function Zijbalk({ menu, systeem }: { menu: NavRegel[]; systeem: NavRegel[] }) {
  const [ingeklapt, setIngeklapt] = useState(leesIngeklapt)
  const [tooltip, setTooltip] = useState<{ label: string; top: number } | null>(null)
  const navId = useId()

  const wissel = () => {
    setIngeklapt((oud) => {
      bewaarIngeklapt(!oud)
      return !oud
    })
    setTooltip(null)
  }

  // De tooltip staat buiten de scrollende lijst (die zou hem afknippen), op de hoogte van het item.
  const toon = (label: string) => (e: PointerEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
    if (!ingeklapt) return
    const vak = e.currentTarget.getBoundingClientRect()
    setTooltip({ label, top: vak.top + vak.height / 2 })
  }
  const verberg = () => setTooltip(null)

  const regels = (lijst: NavRegel[]) =>
    lijst.map((regel) =>
      isGroep(regel) ? (
        <li key={regel.label}>
          {ingeklapt ? (
            <hr aria-hidden="true" className="mx-3 my-3 border-neutral-200" />
          ) : (
            <span aria-hidden="true" className="block px-5 pt-4 pb-1.5 text-ui-xs font-semibold text-neutral-700">
              {regel.label}
            </span>
          )}
          <ul aria-label={regel.label}>
            {regel.items.map((item) => (
              <li key={item.pad}>
                <ZijbalkLink item={item} ingeklapt={ingeklapt} onToon={toon(item.label)} onVerberg={verberg} />
              </li>
            ))}
          </ul>
        </li>
      ) : (
        <li key={regel.pad}>
          <ZijbalkLink item={regel} ingeklapt={ingeklapt} onToon={toon(regel.label)} onVerberg={verberg} />
        </li>
      ),
    )

  return (
    <aside
      className={`sticky top-16 hidden h-[calc(100dvh-4rem)] shrink-0 flex-col border-r border-neutral-200 bg-neutral-0 md:flex print:hidden ${
        ingeklapt ? 'w-16' : 'w-72'
      }`}
    >
      <div id={navId} className="flex min-h-0 flex-1 flex-col">
        <nav aria-label="Hoofdmenu" className="min-h-0 flex-1 overflow-y-auto py-4" onScroll={verberg}>
          <ul>{regels(menu)}</ul>
        </nav>
        {systeem.length > 0 && (
          <nav aria-label="Systeem" className="border-t border-neutral-200 py-2">
            <ul>{regels(systeem)}</ul>
          </nav>
        )}
      </div>
      <button
        type="button"
        aria-expanded={!ingeklapt}
        aria-controls={navId}
        onClick={wissel}
        onPointerEnter={toon('Menu uitklappen')}
        onPointerLeave={verberg}
        onFocus={toon('Menu uitklappen')}
        onBlur={verberg}
        className={`flex cursor-pointer items-center gap-3 border-t border-neutral-200 py-3 text-ui-sm font-semibold text-neutral-700 hover:bg-neutral-100 hover:text-anthracite ${
          ingeklapt ? 'justify-center' : 'px-5'
        }`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
          {ingeklapt ? <path d="M6 6l6 6-6 6M13 6l6 6-6 6" /> : <path d="M18 6l-6 6 6 6M11 6l-6 6 6 6" />}
        </svg>
        <span className={ingeklapt ? 'sr-only' : ''}>{ingeklapt ? 'Menu uitklappen' : 'Menu inklappen'}</span>
      </button>

      {ingeklapt && tooltip && (
        <span
          aria-hidden="true"
          style={{ top: tooltip.top }}
          className="pointer-events-none fixed left-18 z-40 -translate-y-1/2 rounded-md bg-anthracite px-2.5 py-1 text-ui-sm font-semibold whitespace-nowrap text-white shadow-raised"
        >
          {tooltip.label}
        </span>
      )}
    </aside>
  )
}

function ZijbalkLink({
  item,
  ingeklapt,
  onToon,
  onVerberg,
}: {
  item: NavItem
  ingeklapt: boolean
  onToon: (e: PointerEvent<HTMLElement> | FocusEvent<HTMLElement>) => void
  onVerberg: () => void
}) {
  const { pathname } = useLocation()
  const actief = hoortBij(item.pad, pathname)
  return (
    // NavLink zet aria-current; zonder `end` hoort /scholen/123 ook bij /scholen, net als hoortBij().
    <NavLink
      to={item.pad}
      end={item.pad === '/'}
      onPointerEnter={onToon}
      onPointerLeave={onVerberg}
      onFocus={onToon}
      onBlur={onVerberg}
      className={`flex items-center gap-3.5 border-l-[3px] py-2 ${ingeklapt ? 'justify-center pr-[3px]' : 'pr-4 pl-[1.0625rem]'} ${
        actief
          ? 'border-orange bg-neutral-100 font-semibold'
          : 'border-transparent font-medium text-neutral-700 hover:bg-neutral-100 hover:text-anthracite'
      }`}
    >
      <Icoon naam={item.icoon} />
      <span className={ingeklapt ? 'sr-only' : 'truncate'}>{item.label}</span>
    </NavLink>
  )
}
