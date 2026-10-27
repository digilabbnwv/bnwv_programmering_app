import { useState, type ReactNode } from 'react'
import { SelectField } from './SelectField'

export interface Kolom<T> {
  kop: string
  inhoud: (rij: T) => ReactNode
  /** Rechts uitlijnen, bijv. voor getallen. */
  getal?: boolean
  /** Waarde om op te sorteren. Zonder: de kolom is niet sorteerbaar. */
  sorteer?: (rij: T) => number | string
}

export type Richting = 'oplopend' | 'aflopend'

export interface Sortering {
  kop: string
  richting: Richting
}

/** Rijen gesorteerd op de waarde van een kolom; tekst op z'n Nederlands, gelijke waarden in de oude volgorde. */
export function sorteerRijen<T>(rijen: readonly T[], kolom: Kolom<T> | undefined, richting: Richting): T[] {
  const waarde = kolom?.sorteer
  if (!waarde) return [...rijen]
  const factor = richting === 'oplopend' ? 1 : -1
  return [...rijen].sort((a, b) => {
    const x = waarde(a)
    const y = waarde(b)
    const verschil = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'nl')
    return verschil * factor
  })
}

/**
 * Tabel op een groot scherm, kaartjes op een klein scherm. De eerste kolom is
 * de titel van het kaartje. Acties staan in de laatste kolom of onder het kaartje.
 * Kolommen met `sorteer` zijn sorteerbaar: via de kop, of op een klein scherm
 * via een keuzelijst.
 */
export function Tabel<T>({
  bijschrift,
  kolommen,
  rijen,
  sleutel,
  acties,
  leeg = 'Er is nog niets toegevoegd.',
  standaardSortering,
}: {
  bijschrift: string
  kolommen: Kolom<T>[]
  rijen: readonly T[]
  sleutel: (rij: T) => string
  acties?: (rij: T) => ReactNode
  leeg?: string
  standaardSortering?: Sortering
}) {
  const [sortering, setSortering] = useState<Sortering | null>(standaardSortering ?? null)
  if (rijen.length === 0) return <p className="text-neutral-700">{leeg}</p>
  const [eerste, ...rest] = kolommen
  const sorteerbaar = kolommen.filter((k) => k.sorteer)
  const zichtbaar = sortering
    ? sorteerRijen(
        rijen,
        kolommen.find((k) => k.kop === sortering.kop),
        sortering.richting,
      )
    : rijen

  // Eerste klik: tekst oplopend, getallen aflopend (grootste eerst). Daarna omdraaien.
  const klik = (k: Kolom<T>) =>
    setSortering((oud) =>
      oud?.kop === k.kop
        ? { kop: k.kop, richting: oud.richting === 'oplopend' ? 'aflopend' : 'oplopend' }
        : { kop: k.kop, richting: k.getal ? 'aflopend' : 'oplopend' },
    )

  return (
    <>
      <div className="hidden overflow-x-auto rounded-card bg-neutral-0 shadow-card md:block">
        <table className="w-full text-left">
          <caption className="sr-only">{bijschrift}</caption>
          <thead className="border-b border-neutral-200 text-ui-sm">
            <tr>
              {kolommen.map((k) => {
                const actief = sortering?.kop === k.kop ? sortering.richting : null
                return (
                  <th
                    key={k.kop}
                    scope="col"
                    aria-sort={actief === 'oplopend' ? 'ascending' : actief === 'aflopend' ? 'descending' : undefined}
                    className={`px-4 py-3 font-semibold ${k.getal ? 'text-right' : ''}`}
                  >
                    {k.sorteer ? (
                      <button
                        type="button"
                        onClick={() => klik(k)}
                        className={`inline-flex items-center gap-1 font-semibold hover:underline ${k.getal ? 'flex-row-reverse' : ''}`}
                      >
                        {k.kop}
                        <span aria-hidden="true" className={actief ? '' : 'text-neutral-400'}>
                          {actief === 'oplopend' ? '▲' : actief === 'aflopend' ? '▼' : '↕'}
                        </span>
                      </button>
                    ) : (
                      k.kop
                    )}
                  </th>
                )
              })}
              {acties && (
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Acties</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {zichtbaar.map((rij) => (
              <tr key={sleutel(rij)} className="border-b border-neutral-100 last:border-0">
                {kolommen.map((k) => (
                  <td key={k.kop} className={`px-4 py-3 ${k.getal ? 'text-right tabular-nums' : ''}`}>
                    {k.inhoud(rij)}
                  </td>
                ))}
                {acties && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-4">{acties(rij)}</div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        {sorteerbaar.length > 0 && (
          <SelectField
            label="Sorteren op"
            className="mb-4"
            value={sortering ? `${sortering.kop}|${sortering.richting}` : ''}
            opties={[
              { waarde: '', label: 'Standaard' },
              ...sorteerbaar.flatMap((k) => [
                { waarde: `${k.kop}|oplopend`, label: `${k.kop}, ${k.getal ? 'laag naar hoog' : 'A tot Z'}` },
                { waarde: `${k.kop}|aflopend`, label: `${k.kop}, ${k.getal ? 'hoog naar laag' : 'Z tot A'}` },
              ]),
            ]}
            onChange={(e) => {
              const [kop = '', richting] = e.target.value.split('|')
              setSortering(kop ? { kop, richting: richting === 'aflopend' ? 'aflopend' : 'oplopend' } : null)
            }}
          />
        )}
        <ul className="space-y-3" aria-label={bijschrift}>
          {zichtbaar.map((rij) => (
            <li key={sleutel(rij)} className="rounded-card bg-neutral-0 p-4 shadow-card">
              {eerste && <div className="font-semibold">{eerste.inhoud(rij)}</div>}
              {rest.length > 0 && (
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-ui-sm">
                  {rest.map((k) => (
                    <div key={k.kop} className="contents">
                      <dt className="text-neutral-700">{k.kop}</dt>
                      <dd className={k.getal ? 'tabular-nums' : ''}>{k.inhoud(rij)}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {acties && <div className="mt-4 flex flex-wrap gap-4">{acties(rij)}</div>}
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
