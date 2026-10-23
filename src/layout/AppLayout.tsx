import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { RechtenProvider, useRechten } from '../auth/RechtenProvider'
import { Button } from '../components/Button'
import logo from '../assets/logo-bnwv.webp'
import {
  hoortBij,
  initialen,
  INSTELLINGEN,
  isGroep,
  MENU,
  zichtbaarMenu,
  zichtbareInstellingen,
  type NavGroep,
  type NavItem,
} from './navigatie'

/** Layout voor alle pagina's na het inloggen. */
export function AppLayout() {
  return (
    <RechtenProvider>
      <Kader />
    </RechtenProvider>
  )
}

function Kader() {
  const { pathname } = useLocation()
  const main = useRef<HTMLElement>(null)
  const eersteRender = useRef(true)

  // Bij een andere pagina de focus naar de inhoud, zodat toetsenbord- en
  // schermlezergebruikers niet bovenaan het menu blijven hangen.
  useEffect(() => {
    if (eersteRender.current) {
      eersteRender.current = false
      return
    }
    main.current?.focus()
  }, [pathname])

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-50 print:bg-white">
      <a
        href="#inhoud"
        onClick={(e) => {
          // Hash-routing: een gewone ankerlink zou de route wijzigen.
          e.preventDefault()
          main.current?.focus()
        }}
        className="sr-only z-50 rounded-md bg-anthracite px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Naar de inhoud
      </a>
      {/* Remount bij een andere pagina: het mobiele menu klapt dan dicht. */}
      <Kop key={pathname} />
      <main
        ref={main}
        id="inhoud"
        tabIndex={-1}
        className="mx-auto w-full max-w-page flex-1 px-4 py-8 outline-none md:px-8 md:py-12 print:max-w-none print:p-0"
      >
        <Outlet />
      </main>
      <footer className="border-t border-neutral-200 bg-neutral-0 print:hidden">
        <p className="mx-auto max-w-page px-4 py-6 text-ui-sm text-neutral-700 md:px-8">
          Bibliotheek Noordwest Veluwe · Team Programmering
        </p>
      </footer>
    </div>
  )
}

function Kop() {
  const { uitloggen } = useAuth()
  const { heeftRecht, weergavenaam, rolNaam } = useRechten()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()
  const knop = useRef<HTMLButtonElement>(null)
  const menu = zichtbaarMenu(MENU, heeftRecht)
  const instellingen = zichtbareInstellingen(heeftRecht)

  // Escape sluit het mobiele menu en zet de focus terug op de knop.
  useEffect(() => {
    if (!menuOpen) return
    const opToets = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setMenuOpen(false)
      knop.current?.focus()
    }
    document.addEventListener('keydown', opToets)
    return () => document.removeEventListener('keydown', opToets)
  }, [menuOpen])

  // Klein scherm: een groep als kopje met de items eronder, niets uit te klappen.
  const mobieleGroep = (label: string, items: readonly NavItem[]) => (
    <li key={label} className="pt-3">
      <span className="block px-3 pb-1 text-ui-sm font-semibold text-neutral-700">{label}</span>
      <ul aria-label={label} className="space-y-1">
        {items.map((item) => (
          <li key={item.pad}>
            <MenuLink item={item} soort="mobiel" />
          </li>
        ))}
      </ul>
    </li>
  )

  return (
    <header className="border-b border-neutral-200 bg-neutral-0 print:hidden">
      <div className="mx-auto flex h-16 max-w-page items-center gap-10 px-4 md:h-20 md:px-8">
        {/* Gewone Link: het logo is geen menu-item en krijgt geen aria-current. */}
        <Link to="/" className="shrink-0">
          <img
            src={logo}
            alt="Bibliotheek Noordwest Veluwe – Team Programmering, naar de startpagina"
            width={640}
            height={227}
            className="h-10 w-auto md:h-12"
          />
        </Link>

        {/* Groot scherm: menu rechts, dan het gebruikersmenu */}
        <nav aria-label="Hoofdmenu" className="ml-auto hidden h-full md:block">
          <ul className="flex h-full items-stretch gap-8">
            {menu.map((regel) =>
              isGroep(regel) ? (
                <Uitklapmenu key={regel.label} groep={regel} />
              ) : (
                <li key={regel.pad} className="flex">
                  <MenuLink item={regel} soort="balk" />
                </li>
              ),
            )}
          </ul>
        </nav>
        <span aria-hidden="true" className="hidden h-8 w-px bg-neutral-200 md:block" />
        <Gebruikersmenu naam={weergavenaam} rol={rolNaam} instellingen={instellingen} onUitloggen={() => void uitloggen()} />

        {/* Klein scherm: inklapbaar menu */}
        <button
          ref={knop}
          type="button"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((open) => !open)}
          className="ml-auto flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 font-semibold hover:bg-neutral-100 md:hidden"
        >
          <MenuIcoon open={menuOpen} />
          Menu
        </button>
      </div>

      <div id={menuId} hidden={!menuOpen} className="border-t border-neutral-200 px-4 pt-2 pb-4 md:hidden">
        <nav aria-label="Hoofdmenu">
          <ul className="space-y-1">
            {menu.map((regel) =>
              isGroep(regel) ? (
                mobieleGroep(regel.label, regel.items)
              ) : (
                <li key={regel.pad}>
                  <MenuLink item={regel} soort="mobiel" />
                </li>
              ),
            )}
            {instellingen.length > 0 && mobieleGroep(INSTELLINGEN.label, instellingen)}
          </ul>
        </nav>
        <div className="mt-4 flex items-center justify-between gap-4 border-t border-neutral-200 pt-4">
          <p className="text-ui-sm leading-tight">
            <span className="block font-semibold">{weergavenaam ?? 'Ingelogd'}</span>
            {rolNaam && <span className="block text-neutral-700">{rolNaam}</span>}
          </p>
          <Button variant="secundair" onClick={() => void uitloggen()}>
            Uitloggen
          </Button>
        </div>
      </div>
    </header>
  )
}

type LinkSoort = 'balk' | 'uitklap' | 'mobiel'

const LINK_STIJL: Record<LinkSoort, (actief: boolean) => string> = {
  // Streep onderaan de balk; alleen het actieve item is vet.
  balk: (actief) =>
    `flex items-center border-y-[3px] border-t-transparent ${
      actief ? 'border-b-orange font-semibold' : 'border-b-transparent font-medium text-neutral-700 hover:text-anthracite'
    }`,
  uitklap: (actief) =>
    `border-l-[3px] px-4 py-2.5 ${actief ? 'border-orange bg-neutral-50 font-semibold' : 'border-transparent font-medium hover:bg-neutral-100'}`,
  mobiel: (actief) =>
    `rounded-md px-3 py-3 font-semibold ${actief ? 'bg-neutral-100 underline decoration-orange decoration-4 underline-offset-8' : 'hover:bg-neutral-100'}`,
}

function MenuLink({ item, soort }: { item: NavItem; soort: LinkSoort }) {
  const { pathname } = useLocation()
  return (
    // NavLink zet aria-current; zonder `end` hoort /scholen/123 ook bij /scholen, net als hoortBij().
    <NavLink to={item.pad} end={item.pad === '/'} className={`block ${LINK_STIJL[soort](hoortBij(item.pad, pathname))}`}>
      {item.label}
    </NavLink>
  )
}

/**
 * Open- en dichtklappen van een paneel onder een knop (disclosure, geen
 * ARIA-menu: gewone links en knoppen met Tab). Sluit met Escape, bij een klik
 * ernaast of als de focus het geheel verlaat. Na het kiezen van een pagina
 * sluit het vanzelf, omdat de kop dan opnieuw wordt opgebouwd.
 */
function useUitklap<T extends HTMLElement>() {
  const [open, setOpen] = useState(false)
  const paneelId = useId()
  const geheel = useRef<T>(null)
  const knop = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const opToets = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      knop.current?.focus()
    }
    const erbuiten = (e: Event) => {
      if (!geheel.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', opToets)
    document.addEventListener('pointerdown', erbuiten)
    document.addEventListener('focusin', erbuiten)
    return () => {
      document.removeEventListener('keydown', opToets)
      document.removeEventListener('pointerdown', erbuiten)
      document.removeEventListener('focusin', erbuiten)
    }
  }, [open])

  return { open, setOpen, paneelId, geheel, knop }
}

function Pijltje({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

/** Groep in het hoofdmenu op een groot scherm. */
function Uitklapmenu({ groep }: { groep: NavGroep }) {
  const { pathname } = useLocation()
  const { open, setOpen, paneelId, geheel, knop } = useUitklap<HTMLLIElement>()
  const actief = groep.items.some((item) => hoortBij(item.pad, pathname))

  return (
    <li ref={geheel} className="relative flex">
      <button
        ref={knop}
        type="button"
        aria-expanded={open}
        aria-controls={paneelId}
        onClick={() => setOpen((o) => !o)}
        className={`flex cursor-pointer items-center gap-1.5 border-y-[3px] border-t-transparent ${
          actief ? 'border-b-orange font-semibold' : 'border-b-transparent font-medium text-neutral-700 hover:text-anthracite'
        }`}
      >
        {groep.label}
        <Pijltje open={open} />
      </button>
      <ul
        id={paneelId}
        hidden={!open}
        className="absolute top-full left-0 z-40 mt-px min-w-56 overflow-hidden rounded-card bg-neutral-0 py-2 shadow-raised"
      >
        {groep.items.map((item) => (
          <li key={item.pad}>
            <MenuLink item={item} soort="uitklap" />
          </li>
        ))}
      </ul>
    </li>
  )
}

/** Rondje met initialen; klapt naam, rol, instellingen en uitloggen open. */
function Gebruikersmenu({
  naam,
  rol,
  instellingen,
  onUitloggen,
}: {
  naam: string | null
  rol: string | null
  instellingen: NavItem[]
  onUitloggen: () => void
}) {
  const { pathname } = useLocation()
  const { open, setOpen, paneelId, geheel, knop } = useUitklap<HTMLDivElement>()
  const actief = instellingen.some((item) => hoortBij(item.pad, pathname))

  return (
    <div ref={geheel} className="relative hidden md:block">
      <button
        ref={knop}
        type="button"
        aria-expanded={open}
        aria-controls={paneelId}
        onClick={() => setOpen((o) => !o)}
        className="flex cursor-pointer items-center gap-2 rounded-pill p-1 pr-2 hover:bg-neutral-100"
      >
        <span
          aria-hidden="true"
          className={`flex size-10 items-center justify-center rounded-pill bg-beige font-bold ${actief ? 'ring-2 ring-orange' : ''}`}
        >
          {initialen(naam)}
        </span>
        <span className="sr-only">Gebruikersmenu {naam ?? ''}</span>
        <Pijltje open={open} />
      </button>
      <div
        id={paneelId}
        hidden={!open}
        className="absolute top-full right-0 z-40 mt-3 w-64 overflow-hidden rounded-card bg-neutral-0 py-2 shadow-raised"
      >
        <div className="border-b border-neutral-200 px-4 pt-2 pb-3">
          <p className="font-semibold">{naam ?? 'Ingelogd'}</p>
          {rol && <p className="text-ui-sm text-neutral-700">{rol}</p>}
        </div>
        {instellingen.length > 0 && (
          <nav aria-label={INSTELLINGEN.label} className="border-b border-neutral-200 py-2">
            <p aria-hidden="true" className="px-4 pt-1 pb-1 text-ui-xs font-semibold text-neutral-700">
              {INSTELLINGEN.label}
            </p>
            <ul>
              {instellingen.map((item) => (
                <li key={item.pad}>
                  <MenuLink item={item} soort="uitklap" />
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div className="pt-2">
          <button
            type="button"
            onClick={onUitloggen}
            className="block w-full cursor-pointer border-l-[3px] border-transparent px-4 py-2.5 text-left font-medium hover:bg-neutral-100"
          >
            Uitloggen
          </button>
        </div>
      </div>
    </div>
  )
}

function MenuIcoon({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      {open ? (
        <path d="M6 6l12 12M18 6L6 18" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" />
      )}
    </svg>
  )
}
