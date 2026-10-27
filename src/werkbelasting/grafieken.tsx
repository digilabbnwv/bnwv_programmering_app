import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Selectievakje } from '../components/Selectievakje'
import { formatPercentage, formatPerWeek, formatUren, perWeek, type Werkbelasting } from './berekening'
import { verdieping, type Deel } from './rapportage'

/**
 * Grafieken van de werkbelasting. Kleuren per onderdeel liggen vast (nooit
 * per rang): scholen, programma-uitvoering, projectgroepen, overige taken, nog niet ingevuld, mijmertijd. Het palet is
 * gecontroleerd op kleurenblindheid (scripts van de dataviz-richtlijnen);
 * lichtblauw heeft weinig contrast met wit, dus elke grafiek heeft een
 * legenda met waarden en een tabel voor schermlezers.
 */
export const ONDERDELEN = [
  { sleutel: 'scholen', label: 'Programma-scholen', kleur: 'bg-pijler-vraag' },
  { sleutel: 'uitvoering', label: 'Programma-uitvoering', kleur: 'bg-pijler-doe' },
  { sleutel: 'projecten', label: 'Projectgroepen', kleur: 'bg-pijler-leer' },
  { sleutel: 'taken', label: 'Overige taken', kleur: 'bg-paars' },
  { sleutel: 'overig', label: 'Nog niet ingevuld', kleur: 'bg-pijler-ontmoet' },
  { sleutel: 'mijmertijd', label: 'Mijmertijd', kleur: 'bg-orange-hover' },
] as const

type Onderdeel = (typeof ONDERDELEN)[number]['sleutel']

export function urenPerOnderdeel(w: Werkbelasting): Record<Onderdeel, number> {
  return {
    scholen: w.schooluren,
    uitvoering: w.uitvoeringsuren,
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

/** Een onderdeel opgesplitst in delen; mijmertijd en "nog niet ingevuld" zijn één deel. */
function delenVan(w: Werkbelasting, o: Onderdeel): Deel[] {
  if (o === 'overig' || o === 'mijmertijd') return [{ id: o, naam: '', uren: urenPerOnderdeel(w)[o] }]
  return verdieping(w)[o]
}

/**
 * Per medewerker een gestapelde balk als deel van de contracturen. Elk
 * onderdeel is opgedeeld in vakjes van dezelfde kleur (per programma,
 * projectgroep of taak), met een smalle lijn ertussen; de naam staat in de
 * tooltip en, met "Details tonen", als tekst onder de balk. Programma's
 * krijgen geen eigen kleur: dat worden er te veel om uit elkaar te houden.
 * Wie over het contract gaat is overbelast en krijgt een label (nooit alleen kleur).
 */
export function TeamBalken({ rijen }: { rijen: Teambalk[] }) {
  const [hover, setHover] = useState<{ id: string } & Hover | null>(null)
  const [details, setDetails] = useState(false)
  const procent = (r: Teambalk, uren: number) => (r.w.contracturen > 0 ? (uren / r.w.contracturen) * 100 : 0)
  const totaalProcent = (r: Teambalk) => ONDERDELEN.reduce((s, o) => s + procent(r, urenPerOnderdeel(r.w)[o.sleutel]), 0)
  const schaal = Math.max(100, ...rijen.map(totaalProcent))

  return (
    <figure>
      <figcaption className="sr-only">Verdeling van de contracturen per medewerker</figcaption>
      <Selectievakje
        label="Details tonen (per programma, projectgroep en taak)"
        checked={details}
        onChange={(e) => setDetails(e.target.checked)}
        className="mb-4 print:hidden"
      />
      <ul className="space-y-4">
        {rijen.map((r) => {
          const overbelast = r.w.overig < -0.05
          // Alle vakjes achter elkaar, met hun begin (in % van de balk) voor de tooltip.
          let begin = 0
          const blokken = ONDERDELEN.map((o) => {
            const delen = delenVan(r.w, o.sleutel).map((d) => {
              const breedte = schaal > 0 ? (procent(r, d.uren) / schaal) * 100 : 0
              const vak = { ...d, breedte, midden: begin + breedte / 2 }
              begin += breedte
              return vak
            })
            return { o, delen, breedte: delen.reduce((s, d) => s + d.breedte, 0) }
          }).filter((b) => b.breedte > 0)

          return (
            <li key={r.id} className="grid items-start gap-x-4 gap-y-1 sm:grid-cols-[10rem_1fr]">
              <Link to={r.link} className="truncate text-ui-sm font-semibold underline underline-offset-4 hover:no-underline">
                {r.naam}
              </Link>
              <div>
                <div className="relative" aria-hidden="true">
                  {hover?.id === r.id && <Tooltip hover={hover} />}
                  <div className="flex h-5 gap-0.5 print:[print-color-adjust:exact]">
                    {r.w.contracturen > 0 &&
                      blokken.map(({ o, delen, breedte }) => (
                        <div
                          key={o.sleutel}
                          className="flex gap-px overflow-hidden first:rounded-l-sm last:rounded-r-sm"
                          style={{ width: `${breedte}%` }}
                        >
                          {delen.map((d) => (
                            <div
                              key={d.id}
                              role="presentation"
                              className={`${o.kleur} min-w-0`}
                              style={{ flexGrow: d.uren, flexBasis: 0 }}
                              onMouseEnter={() =>
                                setHover({
                                  id: r.id,
                                  links: d.midden,
                                  tekst: `${r.naam} – ${o.label}${d.naam ? ` › ${d.naam}` : ''}: ${formatPercentage(
                                    procent(r, d.uren),
                                  )} (${formatUren(d.uren)} uur)`,
                                })
                              }
                              onMouseLeave={() => setHover(null)}
                            />
                          ))}
                        </div>
                      ))}
                  </div>
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
                {details && r.w.contracturen > 0 && (
                  <ul className="mt-2 space-y-1 text-ui-sm">
                    {blokken
                      .filter(({ o }) => o.sleutel !== 'overig' && o.sleutel !== 'mijmertijd')
                      .map(({ o, delen }) => (
                        <li key={o.sleutel} className="flex gap-2">
                          <span aria-hidden="true" className={`mt-1.5 inline-block size-3 shrink-0 rounded-sm ${o.kleur}`} />
                          <span>
                            <span className="font-semibold">
                              {o.label} {formatPercentage(procent(r, urenPerOnderdeel(r.w)[o.sleutel]))}
                            </span>
                            {': '}
                            {delen.map((d) => `${d.naam} ${formatPercentage(procent(r, d.uren))}`).join(' · ')}
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
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
                  <td key={o.sleutel}>{formatPercentage(procent(r, urenPerOnderdeel(r.w)[o.sleutel]))}</td>
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
