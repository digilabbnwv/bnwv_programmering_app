import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { RechtenProvider, useRechten } from '../auth/RechtenProvider'
import { Button } from '../components/Button'
import { NAV_ITEMS, zichtbareItems } from './navigatie'

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
          Bibliotheek Noordwest Veluwe · Intern
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
  const items = zichtbareItems(NAV_ITEMS, heeftRecht)

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
    items.map((item) => (
      <li key={item.pad}>
        <NavLink
          to={item.pad}
          end={item.pad === '/'}
          className={({ isActive }) =>
            `block font-semibold ${opMobiel ? 'rounded-md px-3 py-3' : 'border-b-4 py-5'} ${
              isActive
                ? opMobiel
                  ? 'bg-neutral-100 underline decoration-orange decoration-4 underline-offset-8'
                  : 'border-orange'
                : opMobiel
                  ? 'hover:bg-neutral-100'
                  : 'border-transparent hover:border-neutral-300'
            }`
          }
        >
          {item.label}
        </NavLink>
      </li>
    ))

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
            <span className="block text-ui-lg font-extrabold">Intern</span>
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
