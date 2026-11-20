import { useState } from 'react'
import { Link } from 'react-router'
import { functieNaam } from '../organisatie/api'
import { formatPercentage, formatUren } from '../werkbelasting/berekening'
import { formatDatum } from '../werkbelasting/opmaak'
import { inzetfaseLabel } from './api'
import { maandagVan, positieInJaar, stap, wekenInJaar, weekVanDag, type Functiedrukte, type Tijdlijnregel } from './drukte'

/**
 * Grafieken van het projectplanner-dashboard (docs/projectplanner.md, hoofdstuk 7).
 *
 * Kleuren (gecontroleerd met de dataviz-validator, licht en donker):
 * - drukte: één blauwe schaal (pijler-vraag) van licht naar donker voor de
 *   bezetting; "te vol" is een status en krijgt rood (pijler-doe) plus een
 *   uitroepteken, dus nooit alleen kleur;
 * - tijdlijn: voorbereiding groen (pijler-ontmoet), uitvoering blauw
 *   (pijler-vraag), altijd met legenda.
 * Elke grafiek heeft een uitleesregel bij hover en focus, en een tabel.
 */

const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

const STAPPEN = [
  { klasse: 'bg-neutral-100', label: 'Geen inzet' },
  { klasse: 'bg-pijler-vraag/20', label: 'tot 25%' },
  { klasse: 'bg-pijler-vraag/45', label: '25–50%' },
  { klasse: 'bg-pijler-vraag/70', label: '50–75%' },
  { klasse: 'bg-pijler-vraag', label: '75–100%' },
  { klasse: 'bg-pijler-doe', label: 'boven 100%' },
] as const

const linkStijl = 'font-semibold underline underline-offset-4 hover:no-underline'

/** "week 40 (4 okt)" */
export function weekLabel(jaar: number, week: number): string {
  const maandag = formatDatum(maandagVan(jaar, week)).replace(/\s\d{4}$/, '')
  return `week ${week} (${maandag})`
}

/** Kolom van de eerste week van elke maand, voor de koppen boven een weekraster. */
function maandkoppen(jaar: number): { maand: string; week: number }[] {
  return MAANDEN.map((maand, i) => ({ maand, week: weekVanDag(`${jaar}-${String(i + 1).padStart(2, '0')}-01`, jaar) }))
}

function Maandkop({ jaar, eersteKolom }: { jaar: number; eersteKolom: string }) {
  const n = wekenInJaar(jaar)
  return (
    <div className="grid gap-0.5 text-ui-xs text-neutral-700" style={{ gridTemplateColumns: `${eersteKolom} repeat(${n}, minmax(0, 1fr))` }} aria-hidden="true">
      <span />
      {maandkoppen(jaar).map((m, i, alle) => {
        const tot = alle[i + 1]?.week ?? n + 1
        return (
          <span key={m.maand} style={{ gridColumn: `${m.week + 1} / ${tot + 1}` }} className="truncate border-l border-neutral-300 pl-1">
            {m.maand}
          </span>
        )
      })}
    </div>
  )
}

function uitleg(d: Functiedrukte, w: number, jaar: number): string {
  const uren = d.nodig[w] ?? 0
  const kop = `${functieNaam(d.functie)}, ${weekLabel(jaar, w + 1)}: ${formatUren(uren)} uur nodig`
  if (!d.capaciteit || !d.bezetting) return `${kop}; capaciteit onbekend.`
  const b = d.bezetting[w] ?? 0
  return `${kop}, ${formatUren(d.capaciteit.perWeek)} beschikbaar: ${formatPercentage(b * 100)}${b > 1.0005 ? ', te vol' : ''}.`
}

/**
 * Heatmap functie × week. Een cel aanklikken toont welke projecten in die week
 * uren van die functie vragen.
 */
export function Drukteheatmap({ jaar, drukte }: { jaar: number; drukte: Functiedrukte[] }) {
  const [hover, setHover] = useState<string | null>(null)
  const [gekozen, setGekozen] = useState<{ functieId: string; week: number } | null>(null)
  const n = wekenInJaar(jaar)
  const eersteKolom = 'minmax(9rem, 14rem)'
  const keuze = gekozen ? drukte.find((d) => d.functie.id === gekozen.functieId) : undefined

  if (drukte.length === 0) return <p className="text-neutral-700">Nog geen inzet om te tonen.</p>

  return (
    <figure>
      <figcaption className="sr-only">Drukte per functie per week in {jaar}</figcaption>
      <Legenda />
      <p aria-live="polite" className="mt-3 min-h-6 text-ui-sm">
        {hover ?? 'Wijs een week aan voor de uren; klik om te zien welke projecten de uren vragen.'}
      </p>
      <div className="mt-2 overflow-x-auto pb-2">
        <div className="min-w-[46rem]">
          <Maandkop jaar={jaar} eersteKolom={eersteKolom} />
          {drukte.map((d) => (
            <div key={d.functie.id} className="mt-0.5 grid items-center gap-0.5" style={{ gridTemplateColumns: `${eersteKolom} repeat(${n}, minmax(0, 1fr))` }}>
              <div className="pr-3 text-ui-sm leading-tight">
                <span className="font-semibold">{d.functie.afkorting || d.functie.naam}</span>
                <span className="block text-ui-xs text-neutral-700">
                  {d.capaciteit ? `${formatUren(d.capaciteit.perWeek)} uur per week vrij` : 'capaciteit onbekend*'}
                </span>
              </div>
              {d.nodig.map((_, w) => {
                const s = stap(d, w)
                const actief = gekozen?.functieId === d.functie.id && gekozen.week === w + 1
                const tekst = uitleg(d, w, jaar)
                return (
                  <button
                    key={w}
                    type="button"
                    aria-label={tekst}
                    aria-pressed={actief}
                    className={`h-7 rounded-sm text-center text-ui-xs font-bold text-white print:[print-color-adjust:exact] ${STAPPEN[s].klasse} ${
                      actief ? 'ring-2 ring-anthracite ring-offset-1 ring-offset-neutral-0' : ''
                    }`}
                    onMouseEnter={() => setHover(tekst)}
                    onFocus={() => setHover(tekst)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => setGekozen(actief ? null : { functieId: d.functie.id, week: w + 1 })}
                  >
                    {s === 5 ? '!' : ''}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      {drukte.some((d) => !d.capaciteit) && (
        <p className="mt-2 text-ui-sm text-neutral-700">
          * Geen medewerkers met deze functie en een contract in de app (of een externe functie). De kleur is dan ten opzichte van de drukste week
          van die functie.
        </p>
      )}

      {keuze && gekozen && (
        <section className="mt-4 rounded-card bg-neutral-50 p-4" aria-live="polite">
          <h3 className="font-bold">
            {functieNaam(keuze.functie)}, {weekLabel(jaar, gekozen.week)}
          </h3>
          <p className="text-ui-sm">{uitleg(keuze, gekozen.week - 1, jaar)}</p>
          <ul className="mt-2 space-y-1">
            {(keuze.bijdragen[gekozen.week - 1] ?? []).map((b) => (
              <li key={b.projectId} className="flex flex-wrap justify-between gap-3">
                <Link to={`/projecten/${b.projectId}?jaar=${jaar}`} className={linkStijl}>
                  {b.naam}
                </Link>
                <span className="tabular-nums">
                  {formatUren(b.uren)} uur
                  {keuze.capaciteit && ` (${formatPercentage((b.uren / keuze.capaciteit.perWeek) * 100)})`}
                </span>
              </li>
            ))}
            {(keuze.bijdragen[gekozen.week - 1] ?? []).length === 0 && <li>Geen projecten in deze week.</li>}
          </ul>
        </section>
      )}

      <details className="mt-4 print:hidden">
        <summary className="cursor-pointer font-semibold">Drukte als tabel</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="text-ui-sm tabular-nums">
            <caption className="sr-only">Uren nodig per week en functie, met de bezetting</caption>
            <thead>
              <tr>
                <th scope="col" className="px-2 py-1 text-left">
                  Week
                </th>
                {drukte.map((d) => (
                  <th key={d.functie.id} scope="col" className="px-2 py-1 text-right">
                    {d.functie.afkorting || d.functie.naam}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: n }, (_, w) => (
                <tr key={w} className="border-t border-neutral-200">
                  <th scope="row" className="px-2 py-1 text-left font-normal whitespace-nowrap">
                    {weekLabel(jaar, w + 1)}
                  </th>
                  {drukte.map((d) => {
                    const b = d.bezetting?.[w]
                    return (
                      <td key={d.functie.id} className="px-2 py-1 text-right whitespace-nowrap">
                        {formatUren(d.nodig[w] ?? 0)}
                        {b !== undefined && ` (${formatPercentage(b * 100)}${b > 1.0005 ? ' !' : ''})`}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}

function Legenda() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-ui-sm" aria-label="Legenda bezetting">
      {STAPPEN.map((s, i) => (
        <li key={s.label} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`inline-flex size-4 items-center justify-center rounded-sm text-ui-xs font-bold text-white print:[print-color-adjust:exact] ${s.klasse}`}
          >
            {i === 5 ? '!' : ''}
          </span>
          {s.label}
        </li>
      ))}
    </ul>
  )
}

/** Kolomgrafiek: aantal projecten in uitvoering per week. Eén reeks, dus geen legenda. */
export function Gelijktijdig({ jaar, perWeek }: { jaar: number; perWeek: number[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...perWeek)
  const titel = `Aantal projecten in uitvoering per week in ${jaar}`
  const tekst = (w: number) => `${weekLabel(jaar, w + 1)}: ${perWeek[w] ?? 0} ${perWeek[w] === 1 ? 'project' : 'projecten'} in uitvoering`

  return (
    <figure>
      <figcaption className="sr-only">{titel}</figcaption>
      <p aria-live="polite" className="min-h-6 text-ui-sm">
        {hover === null ? `Hoogste: ${max} projecten tegelijk in uitvoering.` : tekst(hover)}
      </p>
      <div className="mt-2 flex gap-3">
        <div className="flex h-32 flex-col justify-between text-right text-ui-xs text-neutral-700 tabular-nums" aria-hidden="true">
          <span>{max}</span>
          <span>0</span>
        </div>
        <div className="flex-1">
          <div className="flex h-32 items-end gap-0.5 border-b border-neutral-300" aria-hidden="true">
            {perWeek.map((aantal, w) => (
              <div
                key={w}
                role="presentation"
                className="flex h-full flex-1 items-end"
                onMouseEnter={() => setHover(w)}
                onMouseLeave={() => setHover(null)}
              >
                <div
                  className={`w-full rounded-t-[4px] print:[print-color-adjust:exact] ${hover === w ? 'bg-pijler-vraag/70' : 'bg-pijler-vraag'}`}
                  style={{ height: `${(aantal / max) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className="relative mt-1 h-4 text-ui-xs text-neutral-700" aria-hidden="true">
            {maandkoppen(jaar).map((m) => (
              <span key={m.maand} className="absolute" style={{ left: `${((m.week - 1) / perWeek.length) * 100}%` }}>
                {m.maand}
              </span>
            ))}
          </div>
        </div>
      </div>
      <table className="sr-only">
        <caption>{titel}</caption>
        <tbody>
          {perWeek.map((aantal, w) => (
            <tr key={w}>
              <th scope="row">{weekLabel(jaar, w + 1)}</th>
              <td>{aantal}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

const FASEKLEUR = { voorbereiding: 'bg-pijler-ontmoet', uitvoering: 'bg-pijler-vraag' } as const

/** Tijdlijn: per project de looptijd, met voorbereiding en uitvoering als balken. */
export function Tijdlijn({ jaar, regels, groep }: { jaar: number; regels: Tijdlijnregel[]; groep: (r: Tijdlijnregel) => string }) {
  const [hover, setHover] = useState<string | null>(null)
  if (regels.length === 0) return <p className="text-neutral-700">Geen projecten in deze selectie.</p>
  const groepen = new Map<string, Tijdlijnregel[]>()
  for (const r of regels) groepen.set(groep(r), [...(groepen.get(groep(r)) ?? []), r])
  const maanden = MAANDEN.map((m, i) => ({ m, links: positieInJaar(`${jaar}-${String(i + 1).padStart(2, '0')}-01`, jaar) }))
  const breedte = (p: { startdatum: string; einddatum: string }) => {
    const links = positieInJaar(p.startdatum, jaar)
    const eind = positieInJaar(p.einddatum, jaar) + 100 / 365
    return { left: `${links}%`, width: `${Math.max(0.6, eind - links)}%` }
  }

  return (
    <figure>
      <figcaption className="sr-only">Tijdlijn van de projecten in {jaar}</figcaption>
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-ui-sm" aria-label="Legenda tijdlijn">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className={`h-3 w-6 rounded-[4px] ${FASEKLEUR.voorbereiding} print:[print-color-adjust:exact]`} />
          Voorbereiding
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className={`h-3 w-6 rounded-[4px] ${FASEKLEUR.uitvoering} print:[print-color-adjust:exact]`} />
          Uitvoering
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-1 w-6 rounded-full bg-neutral-300" />
          Looptijd (zonder inzet)
        </li>
      </ul>
      <p aria-live="polite" className="mt-3 min-h-6 text-ui-sm">
        {hover ?? 'Wijs een balk aan voor de periode.'}
      </p>

      <div className="mt-2 overflow-x-auto pb-2">
        <div className="min-w-[40rem]">
          <div className="grid grid-cols-[minmax(10rem,16rem)_1fr] gap-3 text-ui-xs text-neutral-700" aria-hidden="true">
            <span />
            <div className="relative h-4">
              {maanden.map(({ m, links }) => (
                <span key={m} className="absolute border-l border-neutral-300 pl-1" style={{ left: `${links}%` }}>
                  {m}
                </span>
              ))}
            </div>
          </div>
          {[...groepen].map(([naam, lijst]) => (
            <div key={naam} className="mt-4">
              <h3 className="mb-1 text-ui-sm font-bold">{naam}</h3>
              <ul>
                {lijst.map((r) => {
                  const omschrijving = [
                    `Looptijd ${formatDatum(r.looptijd.startdatum)} – ${formatDatum(r.looptijd.einddatum)}`,
                    ...r.fases.map((f) => `${inzetfaseLabel(f.fase).toLowerCase()} ${formatDatum(f.periode.startdatum)} – ${formatDatum(f.periode.einddatum)}`),
                  ].join(', ')
                  return (
                    <li key={r.regel.projectjaar.id} className="grid grid-cols-[minmax(10rem,16rem)_1fr] items-center gap-3 border-t border-neutral-100 py-1">
                      <Link to={`/projecten/${r.regel.project.id}?jaar=${jaar}`} className={`truncate text-ui-sm ${linkStijl}`}>
                        {r.regel.project.naam}
                        <span className="sr-only">: {omschrijving}</span>
                      </Link>
                      <div
                        role="presentation"
                        className="relative h-6"
                        aria-hidden="true"
                        onMouseEnter={() => setHover(`${r.regel.project.naam}: ${omschrijving}.`)}
                        onMouseLeave={() => setHover(null)}
                      >
                        {maanden.map(({ m, links }) => (
                          <span key={m} className="absolute inset-y-0 border-l border-neutral-100" style={{ left: `${links}%` }} />
                        ))}
                        <span className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-neutral-300" style={breedte(r.looptijd)} />
                        {r.fases.map((f) => (
                          <span
                            key={f.fase}
                            className={`absolute h-2.5 rounded-[4px] print:[print-color-adjust:exact] ${FASEKLEUR[f.fase]} ${f.fase === 'voorbereiding' ? 'top-0' : 'bottom-0'}`}
                            style={breedte(f.periode)}
                          />
                        ))}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </figure>
  )
}
