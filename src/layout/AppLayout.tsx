import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { leesThema, THEMAS, zetThema, type Thema } from '../lib/thema'
import { RechtenProvider, useRechten } from '../auth/RechtenProvider'
import { Button } from '../components/Button'
import logo from '../assets/logo-bnwv.webp'
import logoDonker from '../assets/logo-bnwv-donker.webp'
import { EigenMedewerkerProvider, useEigenMedewerker } from './EigenMedewerker'
import { JaarProvider, useJaar } from './JaarProvider'
import { alleItems, hoortBij, initialen, isGroep, MAX_ZONDER_ZIJBALK, MENU, SYSTEEM, zichtbaarMenu, type NavItem, type NavRegel } from './navigatie'
import { metJaar, PAGINAS, plekBij } from './paginas'
import { Zijbalk } from './Zijbalk'

/** Layout voor alle pagina's na het inloggen: kopbalk, zijbalk en inhoud (docs/navigatie.md). */
export function AppLayout() {
  return (
    <RechtenProvider>
      <EigenMedewerkerProvider>
        <JaarProvider>
          <Kader />
        </JaarProvider>
      </EigenMedewerkerProvider>
    </RechtenProvider>
  )
}

/** Het menu dat deze gebruiker ziet: hoofdmenu, systeem en of er een zijbalk is. */
function useMenu(): { menu: NavRegel[]; systeem: NavRegel[]; metZijbalk: boolean } {
  const { heeftRecht } = useRechten()
  const eigen = useEigenMedewerker()
  const verborgen = typeof eigen === 'string' ? [] : [PAGINAS.mijnWerkurenverdeling.pad]
  const menu = zichtbaarMenu(MENU, heeftRecht, verborgen)
  const systeem = zichtbaarMenu([SYSTEEM], heeftRecht)
  return { menu, systeem, metZijbalk: alleItems([...menu, ...systeem]).length > MAX_ZONDER_ZIJBALK }
}

function Kader() {
  const { pathname } = useLocation()
  const main = useRef<HTMLElement>(null)
  const eersteRender = useRef(true)
  const { menu, systeem, metZijbalk } = useMenu()
  // Een ander tabblad is dezelfde pagina: dan blijft de focus op het tabblad.
  const paginaAdres = plekBij(pathname)?.basis ?? pathname

  // Bij een andere pagina de focus naar de inhoud, zodat toetsenbord- en
  // schermlezergebruikers niet bovenaan het menu blijven hangen.
  useEffect(() => {
    if (eersteRender.current) {
      eersteRender.current = false
      return
    }
    main.current?.focus()
  }, [paginaAdres])

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
      <Kop key={pathname} menu={menu} systeem={systeem} metZijbalk={metZijbalk} />
      <div className="flex flex-1">
        {metZijbalk && <Zijbalk menu={menu} systeem={systeem} />}
        {/* De pagina bepaalt zelf hoe breed de inhoud is (Pagina, prop breedte). */}
        <main
          ref={main}
          id="inhoud"
          tabIndex={-1}
          className="w-full min-w-0 flex-1 px-4 py-8 outline-none md:px-8 md:py-10 print:p-0"
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function Kop({ menu, systeem, metZijbalk }: { menu: NavRegel[]; systeem: NavRegel[]; metZijbalk: boolean }) {
  const { uitloggen } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // Terug naar het dashboard: wie hierna inlogt, komt niet op een pagina van de vorige gebruiker.
  const uitloggenNaarStart = () => void uitloggen().then(() => navigate('/', { replace: true }))
  const { weergavenaam, rolNaam } = useRechten()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()
  const knop = useRef<HTMLButtonElement>(null)
  const toonJaar = metJaar(plekBij(pathname))

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
  const mobieleRegels = (regels: NavRegel[]) =>
    regels.map((regel) =>
      isGroep(regel) ? (
        <li key={regel.label} className="pt-3">
          <span className="block px-3 pb-1 text-ui-sm font-semibold text-neutral-700">{regel.label}</span>
          <ul aria-label={regel.label} className="space-y-1">
            {regel.items.map((item) => (
              <li key={item.pad}>
                <MenuLink item={item} soort="mobiel" />
              </li>
            ))}
          </ul>
        </li>
      ) : (
        <li key={regel.pad}>
          <MenuLink item={regel} soort="mobiel" />
        </li>
      ),
    )

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-neutral-0 print:hidden">
      <div className="flex h-16 items-center gap-4 px-4 md:gap-8 md:px-6">
        {/* Gewone Link: het logo is geen menu-item en krijgt geen aria-current. */}
        <Link to="/" className="shrink-0">
          <img
            src={logo}
            alt="Bibliotheek Noordwest Veluwe – Team Programmering, naar de startpagina"
            width={640}
            height={227}
            className="h-9 w-auto md:h-10 donker:hidden"
          />
          {/* Dezelfde afbeelding met lichte letters, voor de donkere modus. */}
          <img
            src={logoDonker}
            alt="Bibliotheek Noordwest Veluwe – Team Programmering, naar de startpagina"
            width={640}
            height={227}
            className="hidden h-9 w-auto md:h-10 donker:block"
          />
        </Link>

        {/* Weinig bestemmingen: geen zijbalk, de links staan in de kopbalk. */}
        {!metZijbalk && (
          <nav aria-label="Hoofdmenu" className="hidden h-full md:block">
            <ul className="flex h-full items-stretch gap-8">
              {alleItems(menu).map((item) => (
                <li key={item.pad} className="flex">
                  <MenuLink item={item} soort="balk" />
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className="ml-auto flex items-center gap-4 md:gap-6">
          {toonJaar && <JaarKeuze />}
          <span aria-hidden="true" className="hidden h-8 w-px bg-neutral-200 md:block" />
          <Gebruikersmenu naam={weergavenaam} rol={rolNaam} onUitloggen={uitloggenNaarStart} />

          {/* Klein scherm: inklapbaar menu */}
          <button
            ref={knop}
            type="button"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((open) => !open)}
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 font-semibold hover:bg-neutral-100 md:hidden"
          >
            <MenuIcoon open={menuOpen} />
            Menu
          </button>
        </div>
      </div>

      <div id={menuId} hidden={!menuOpen} className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-neutral-200 px-4 pt-2 pb-4 md:hidden">
        <nav aria-label="Hoofdmenu">
          <ul className="space-y-1">
            {mobieleRegels(menu)}
            {mobieleRegels(systeem)}
          </ul>
        </nav>
        <div className="mt-4 border-t border-neutral-200 pt-4">
          <ThemaKeuze />
        </div>
        <div className="mt-4 flex items-center justify-between gap-4 border-t border-neutral-200 pt-4">
          <p className="text-ui-sm leading-tight">
            <span className="block font-semibold">{weergavenaam ?? 'Ingelogd'}</span>
            {rolNaam && <span className="block text-neutral-700">{rolNaam}</span>}
          </p>
          <Button variant="secundair" onClick={uitloggenNaarStart}>
            Uitloggen
          </Button>
        </div>
      </div>
    </header>
  )
}

/** Het jaar voor de hele app (layout/JaarProvider.tsx); alleen op pagina's die van het jaar afhangen. */
function JaarKeuze() {
  const { jaar, jaren, zetJaar } = useJaar()
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-ui-sm font-semibold">
        Jaar
      </label>
      <select
        id={id}
        value={String(jaar)}
        onChange={(e) => zetJaar(Number(e.target.value))}
        className="rounded-md border-2 border-neutral-500 bg-neutral-0 py-1.5 pr-2 pl-2.5 text-ui-md font-semibold"
      >
        {jaren.map((j) => (
          <option key={j} value={String(j)}>
            {j}
          </option>
        ))}
      </select>
    </div>
  )
}

type LinkSoort = 'balk' | 'mobiel'

const LINK_STIJL: Record<LinkSoort, (actief: boolean) => string> = {
  // Streep onderaan de balk; alleen het actieve item is vet.
  balk: (actief) =>
    `flex items-center border-y-[3px] border-t-transparent ${
      actief ? 'border-b-orange font-semibold' : 'border-b-transparent font-medium text-neutral-700 hover:text-anthracite'
    }`,
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
 * ernaast of als de focus het geheel verlaat.
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

/** Rondje met initialen; klapt naam, rol, weergave en uitloggen open. */
function Gebruikersmenu({ naam, rol, onUitloggen }: { naam: string | null; rol: string | null; onUitloggen: () => void }) {
  const { open, setOpen, paneelId, geheel, knop } = useUitklap<HTMLDivElement>()

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
        <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-pill bg-beige font-bold">
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
        <div className="border-b border-neutral-200 px-4 py-3">
          <ThemaKeuze />
        </div>
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

/** Licht, donker of de systeeminstelling volgen. */
function ThemaKeuze() {
  const [thema, setThema] = useState<Thema>(leesThema)
  const naam = useId()
  return (
    <fieldset>
      <legend className="text-ui-xs font-semibold text-neutral-700">Weergave</legend>
      <div className="mt-2 flex rounded-md border-2 border-neutral-300 p-0.5">
        {THEMAS.map((t) => (
          <label
            key={t.waarde}
            className={`flex-1 cursor-pointer rounded-sm px-2 py-1.5 text-center text-ui-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${
              thema === t.waarde ? 'bg-anthracite font-semibold text-white' : 'hover:bg-neutral-100'
            }`}
          >
            <input
              type="radio"
              name={naam}
              value={t.waarde}
              checked={thema === t.waarde}
              onChange={() => {
                setThema(t.waarde)
                zetThema(t.waarde)
              }}
              className="sr-only"
            />
            {t.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function MenuIcoon({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
    </svg>
  )
}
