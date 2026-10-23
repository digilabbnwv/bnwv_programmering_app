import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { RechtenProvider, useRechten } from '../auth/RechtenProvider'
import { Button } from '../components/Button'
import { hoortBij, isGroep, MENU, zichtbaarMenu, type NavGroep, type NavItem } from './navigatie'

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
    <div className="flex min-h-dvh flex-col bg-neutral-50">
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
        className="mx-auto w-full max-w-page flex-1 px-4 py-8 outline-none md:px-8 md:py-12"
      >
        <Outlet />
      </main>
      <footer className="border-t border-neutral-200 bg-neutral-0">
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

  const links = (opMobiel: boolean) =>
    menu.map((regel) => {
      if (!isGroep(regel)) {
        return (
          <li key={regel.pad}>
            <MenuLink item={regel} opMobiel={opMobiel} />
          </li>
        )
      }
      if (!opMobiel) return <Uitklapmenu key={regel.label} groep={regel} />
      // Klein scherm: de groep als kopje met de items eronder, niets uit te klappen.
      return (
        <li key={regel.label} className="pt-3">
          <span className="block px-3 pb-1 text-ui-sm font-semibold text-neutral-700">{regel.label}</span>
          <ul aria-label={regel.label} className="space-y-1">
            {regel.items.map((item) => (
              <li key={item.pad}>
                <MenuLink item={item} opMobiel />
              </li>
            ))}
          </ul>
        </li>
      )
    })

  const gebruiker = (
    <p className="text-ui-sm leading-tight">
      <span className="block font-semibold">{weergavenaam ?? 'Ingelogd'}</span>
      {rolNaam && <span className="block text-neutral-700">{rolNaam}</span>}
    </p>
  )

  return (
    <header className="border-b border-neutral-200 bg-neutral-0">
      <div className="mx-auto flex max-w-page items-center gap-6 px-4 md:px-8">
        {/* Gewone Link: het logo is geen menu-item en krijgt geen aria-current. */}
        <Link to="/" className="flex shrink-0 items-center gap-3 py-4">
          <span aria-hidden="true" className="h-8 w-1.5 rounded-pill bg-orange" />
          <span className="leading-tight">
            <span className="block text-ui-sm font-semibold">Bibliotheek Noordwest Veluwe</span>{' '}
            <span className="block text-ui-lg font-extrabold">Team Programmering</span>
          </span>
        </Link>

        {/* Groot scherm: menu naast het logo */}
        <nav aria-label="Hoofdmenu" className="hidden flex-1 md:block">
          <ul className="flex gap-6">{links(false)}</ul>
        </nav>
        <div className="ml-auto hidden items-center gap-4 md:flex">
          {gebruiker}
          <Button variant="secundair" onClick={() => void uitloggen()}>
            Uitloggen
          </Button>
        </div>

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
          <ul className="space-y-1">{links(true)}</ul>
        </nav>
        <div className="mt-4 flex items-center justify-between gap-4 border-t border-neutral-200 pt-4">
          {gebruiker}
          <Button variant="secundair" onClick={() => void uitloggen()}>
            Uitloggen
          </Button>
        </div>
      </div>
    </header>
  )
}

function MenuLink({ item, opMobiel, inUitklapmenu = false }: { item: NavItem; opMobiel: boolean; inUitklapmenu?: boolean }) {
  const { pathname } = useLocation()
  const actief = hoortBij(item.pad, pathname)
  let stijl: string
  if (opMobiel) {
    stijl = `rounded-md px-3 py-3 ${actief ? 'bg-neutral-100 underline decoration-orange decoration-4 underline-offset-8' : 'hover:bg-neutral-100'}`
  } else if (inUitklapmenu) {
    stijl = `border-l-4 px-4 py-2.5 ${actief ? 'border-orange bg-neutral-50' : 'border-transparent hover:bg-neutral-100'}`
  } else {
    stijl = `border-b-4 py-5 ${actief ? 'border-orange' : 'border-transparent hover:border-neutral-300'}`
  }
  return (
    // NavLink zet aria-current; zonder `end` hoort /scholen/123 ook bij /scholen, net als hoortBij().
    <NavLink to={item.pad} end={item.pad === '/'} className={`block font-semibold ${stijl}`}>
      {item.label}
    </NavLink>
  )
}

/**
 * Groep in het menu op een groot scherm: een knop die een lijst met links
 * openklapt (disclosure, geen ARIA-menu: gewone links met Tab). Sluit met
 * Escape, bij een klik ernaast of als de focus de groep verlaat. Na het kiezen
 * van een pagina sluit hij vanzelf, omdat de kop dan opnieuw wordt opgebouwd.
 */
function Uitklapmenu({ groep }: { groep: NavGroep }) {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const lijstId = useId()
  const groepRef = useRef<HTMLLIElement>(null)
  const knop = useRef<HTMLButtonElement>(null)
  const actief = groep.items.some((item) => hoortBij(item.pad, pathname))

  useEffect(() => {
    if (!open) return
    const opToets = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      knop.current?.focus()
    }
    // Klik of focus buiten de groep (bijv. met Tab verder) sluit hem.
    const erbuiten = (e: Event) => {
      if (!groepRef.current?.contains(e.target as Node)) setOpen(false)
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

  return (
    <li ref={groepRef} className="relative">
      <button
        ref={knop}
        type="button"
        aria-expanded={open}
        aria-controls={lijstId}
        onClick={() => setOpen((o) => !o)}
        className={`flex cursor-pointer items-center gap-1.5 border-b-4 py-5 font-semibold ${
          actief ? 'border-orange' : 'border-transparent hover:border-neutral-300'
        }`}
      >
        {groep.label}
        <svg
          aria-hidden="true"
          width="16"
          height="16"
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
      </button>
      <ul
        id={lijstId}
        hidden={!open}
        className="absolute top-full left-0 z-40 min-w-56 overflow-hidden rounded-card bg-neutral-0 py-2 shadow-raised"
      >
        {groep.items.map((item) => (
          <li key={item.pad}>
            <MenuLink item={item} opMobiel={false} inUitklapmenu />
          </li>
        ))}
      </ul>
    </li>
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
