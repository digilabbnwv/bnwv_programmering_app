import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { formatPercentage, formatPerWeek, formatUren, perWeek, type Werkbelasting } from './berekening'

/**
 * Grafieken van de werkbelasting. Kleuren per onderdeel liggen vast (nooit
 * per rang): scholen, projectgroepen, overige taken, nog niet ingevuld, mijmertijd. Het palet is
 * gecontroleerd op kleurenblindheid (scripts van de dataviz-richtlijnen);
 * lichtblauw heeft weinig contrast met wit, dus elke grafiek heeft een
 * legenda met waarden en een tabel voor schermlezers.
 */
export const ONDERDELEN = [
  { sleutel: 'scholen', label: 'Scholen', kleur: 'bg-pijler-vraag' },
  { sleutel: 'projecten', label: 'Projectgroepen', kleur: 'bg-pijler-leer' },
  { sleutel: 'taken', label: 'Overige taken', kleur: 'bg-paars' },
  { sleutel: 'overig', label: 'Nog niet ingevuld', kleur: 'bg-pijler-ontmoet' },
  { sleutel: 'mijmertijd', label: 'Mijmertijd', kleur: 'bg-orange-hover' },
] as const

type Onderdeel = (typeof ONDERDELEN)[number]['sleutel']

export function urenPerOnderdeel(w: Werkbelasting): Record<Onderdeel, number> {
  return {
    scholen: w.schooluren,
    projecten: w.projecturen,
    taken: w.takenuren,
    // Een tekort is geen deel van de balk; dat toont het overbelast-signaal.
    overig: Math.max(0, w.overig),
    mijmertijd: w.mijmertijd,
  }
}

/** Breedte en midden (in % van de balk) van opeenvolgende segmenten. */
function segmenten(waarden: readonly number[], schaal: number): { breedte: number; midden: number }[] {
  return waarden.reduce<{ breedte: number; midden: number; eind: number }[]>((acc, waarde) => {
    const begin = acc.at(-1)?.eind ?? 0
    const breedte = schaal > 0 ? (waarde / schaal) * 100 : 0
    return [...acc, { breedte, midden: begin + breedte / 2, eind: begin + breedte }]
  }, [])
}

interface Hover {
  links: number
  tekst: string
}

/** Tooltip boven een balk, op de plek van het segment waar de muis staat. */
function Tooltip({ hover }: { hover: Hover | null }) {
  if (!hover) return null
  return (
    <div
      className="pointer-events-none absolute bottom-full z-10 mb-2 -translate-x-1/2 rounded-md bg-anthracite px-3 py-1.5 text-ui-sm whitespace-nowrap text-white shadow-raised"
      style={{ left: `${Math.min(90, Math.max(10, hover.links))}%` }}
    >
      {hover.tekst}
    </div>
  )
}

/**
 * Verdeling van de contracturen als één gestapelde balk (100%), met legenda.
 * Segmenten hebben 2px ruimte ertussen; de uiteinden zijn afgerond.
 */
export function Verdelingsbalk({ w }: { w: Werkbelasting }) {
  const [hover, setHover] = useState<Hover | null>(null)
  if (w.contracturen <= 0) return null
  const uren = urenPerOnderdeel(w)
  const totaal = ONDERDELEN.reduce((s, o) => s + uren[o.sleutel], 0)
  const delen = segmenten(
    ONDERDELEN.map((o) => uren[o.sleutel]),
    totaal,
  )

  return (
    <figure>
      <div className="relative" aria-hidden="true">
        <Tooltip hover={hover} />
        <div className="flex h-6 gap-0.5 overflow-hidden rounded-sm bg-neutral-0 print:[print-color-adjust:exact]">
          {ONDERDELEN.map((o, i) => {
            const { breedte: deel, midden } = delen[i] ?? { breedte: 0, midden: 0 }
            if (deel === 0) return null
            return (
              <div
                key={o.sleutel}
                role="presentation"
                className={`${o.kleur} first:rounded-l-sm last:rounded-r-sm`}
                style={{ width: `${deel}%` }}
                onMouseEnter={() =>
                  setHover({
                    links: midden,
                    tekst: `${o.label}: ${formatUren(uren[o.sleutel])} uur (${formatPercentage((uren[o.sleutel] / w.contracturen) * 100)})`,
                  })
                }
                onMouseLeave={() => setHover(null)}
              />
            )
          })}
        </div>
      </div>
      <figcaption>
        <ul className="mt-3 grid gap-x-6 gap-y-1 text-ui-sm sm:grid-cols-2">
          {ONDERDELEN.map((o) => (
            <li key={o.sleutel} className="flex items-center gap-2">
              <span aria-hidden="true" className={`inline-block size-3 shrink-0 rounded-sm ${o.kleur} print:[print-color-adjust:exact]`} />
              <span>
                {o.label}: <span className="font-semibold">{formatUren(uren[o.sleutel])} uur</span>{' '}
                <span className="text-neutral-700">
                  ({formatPercentage((uren[o.sleutel] / w.contracturen) * 100)},{' '}
                  {formatPerWeek(perWeek(uren[o.sleutel], w.werkweken))} p/w)
                </span>
              </span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  )
}

export interface Staaf {
  id: string
  label: ReactNode
  /** Tekst voor tooltip en schermlezer. */
  naam: string
  waarde: number
  toelichting?: string
}

/** Horizontale staven voor één reeks (bijv. uren per school), waarde aan het eind. */
export function Staafdiagram({ titel, staven, eenheid = 'uur' }: { titel: string; staven: Staaf[]; eenheid?: string }) {
  const [hover, setHover] = useState<string | null>(null)
  const max = Math.max(...staven.map((s) => s.waarde), 0)
  if (staven.length === 0) return null

  return (
    <figure>
      <figcaption className="sr-only">{titel}</figcaption>
      <table className="w-full border-separate border-spacing-y-1.5 text-ui-sm">
        <caption className="sr-only">{titel}</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Naam</th>
            <th scope="col">Uren per jaar</th>
          </tr>
        </thead>
        <tbody>
          {staven.map((s) => (
            <tr key={s.id}>
              <th scope="row" className="w-2/5 pr-3 text-left font-normal align-middle">
                {s.label}
                {s.toelichting && <span className="block text-ui-xs text-neutral-700">{s.toelichting}</span>}
              </th>
              <td className="align-middle">
                <div className="relative flex items-center gap-2">
                  {hover === s.id && (
                    <div className="pointer-events-none absolute bottom-full left-0 z-10 mb-1 rounded-md bg-anthracite px-3 py-1.5 whitespace-nowrap text-white shadow-raised">
                      {s.naam}: {formatUren(s.waarde)} {eenheid}
                    </div>
                  )}
                  <div
                    role="presentation"
                    aria-hidden="true"
                    className="h-4 min-w-1 rounded-r-sm bg-pijler-vraag print:[print-color-adjust:exact]"
                    style={{ width: `${max > 0 ? (s.waarde / max) * 75 : 0}%` }}
                    onMouseEnter={() => setHover(s.id)}
                    onMouseLeave={() => setHover(null)}
                  />
                  <span className="tabular-nums">{formatUren(s.waarde)}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

export interface Teambalk {
  id: string
  naam: string
  link: string
  w: Werkbelasting
}

/**
 * Per medewerker een gestapelde balk als deel van de contracturen. De lijn
 * staat op 100% van het contract; wie erover gaat is overbelast en krijgt
 * een label (nooit alleen kleur).
 */
export function TeamBalken({ rijen }: { rijen: Teambalk[] }) {
  const [hover, setHover] = useState<{ id: string } & Hover | null>(null)
  const procent = (r: Teambalk, o: Onderdeel) => {
    if (r.w.contracturen <= 0) return 0
    const u = o === 'overig' ? Math.max(0, r.w.overig) : urenPerOnderdeel(r.w)[o]
    return (u / r.w.contracturen) * 100
  }
  const totaalProcent = (r: Teambalk) => ONDERDELEN.reduce((s, o) => s + procent(r, o.sleutel), 0)
  const schaal = Math.max(100, ...rijen.map(totaalProcent))
  const lijn = (100 / schaal) * 100

  return (
    <figure>
      <figcaption className="sr-only">Verdeling van de contracturen per medewerker</figcaption>
      <ul className="space-y-3">
        {rijen.map((r) => {
          const delen = segmenten(
            ONDERDELEN.map((o) => procent(r, o.sleutel)),
            schaal,
          )
          const overbelast = r.w.overig < -0.05
          return (
            <li key={r.id} className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[10rem_1fr]">
              <Link to={r.link} className="truncate text-ui-sm font-semibold underline underline-offset-4 hover:no-underline">
                {r.naam}
              </Link>
              <div>
                <div className="relative" aria-hidden="true">
                  {hover?.id === r.id && <Tooltip hover={hover} />}
                  <div className="flex h-4 gap-0.5 print:[print-color-adjust:exact]">
                    {r.w.contracturen > 0 &&
                      ONDERDELEN.map((o, i) => {
                        const { breedte, midden } = delen[i] ?? { breedte: 0, midden: 0 }
                        if (breedte === 0) return null
                        return (
                          <div
                            key={o.sleutel}
                            role="presentation"
                            className={`${o.kleur} first:rounded-l-sm last:rounded-r-sm`}
                            style={{ width: `${breedte}%` }}
                            onMouseEnter={() =>
                              setHover({
                                id: r.id,
                                links: midden,
                                tekst: `${r.naam} – ${o.label}: ${formatPercentage(procent(r, o.sleutel))}`,
                              })
                            }
                            onMouseLeave={() => setHover(null)}
                          />
                        )
                      })}
                  </div>
                  {/* 100% van het contract */}
                  <div className="absolute -top-1 -bottom-1 w-px bg-anthracite" style={{ left: `${lijn}%` }} />
                </div>
                <p className="mt-1 text-ui-xs text-neutral-700">
                  {r.w.contracturen <= 0 ? (
                    'Geen contract'
                  ) : overbelast ? (
                    <span className="font-semibold text-anthracite">
                      <span aria-hidden="true">⚠ </span>
                      Overbelast: {formatUren(-r.w.overig)} uur te veel
                    </span>
                  ) : (
                    `${formatUren(r.w.overig)} uur nog niet ingevuld (${formatPercentage(r.w.percentage.overig)})`
                  )}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-ui-sm">
        {ONDERDELEN.map((o) => (
          <span key={o.sleutel} className="flex items-center gap-2">
            <span aria-hidden="true" className={`inline-block size-3 rounded-sm ${o.kleur}`} />
            {o.label}
          </span>
        ))}
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-3 w-px bg-anthracite" />
          100% van het contract
        </span>
      </div>
      {/* Tabel voor schermlezers. sr-only op de div: op een <table> blijft het bijschrift soms zichtbaar. */}
      <div className="sr-only">
        <table>
          <caption>Verdeling van de contracturen per medewerker, in procenten</caption>
          <thead>
            <tr>
              <th scope="col">Medewerker</th>
              {ONDERDELEN.map((o) => (
                <th key={o.sleutel} scope="col">
                  {o.label}
                </th>
              ))}
              <th scope="col">Nog niet ingevuld of tekort (uren)</th>
            </tr>
          </thead>
          <tbody>
            {rijen.map((r) => (
              <tr key={r.id}>
                <th scope="row">{r.naam}</th>
                {ONDERDELEN.map((o) => (
                  <td key={o.sleutel}>{formatPercentage(procent(r, o.sleutel))}</td>
                ))}
                <td>{formatUren(r.w.overig)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
