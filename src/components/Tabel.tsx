import type { ReactNode } from 'react'

export interface Kolom<T> {
  kop: string
  inhoud: (rij: T) => ReactNode
  /** Rechts uitlijnen, bijv. voor getallen. */
  getal?: boolean
}

/**
 * Tabel op een groot scherm, kaartjes op een klein scherm. De eerste kolom is
 * de titel van het kaartje. Acties staan in de laatste kolom of onder het kaartje.
 */
export function Tabel<T>({
  bijschrift,
  kolommen,
  rijen,
  sleutel,
  acties,
  leeg = 'Er is nog niets toegevoegd.',
}: {
  bijschrift: string
  kolommen: Kolom<T>[]
  rijen: readonly T[]
  sleutel: (rij: T) => string
  acties?: (rij: T) => ReactNode
  leeg?: string
}) {
  if (rijen.length === 0) return <p className="text-neutral-700">{leeg}</p>
  const [eerste, ...rest] = kolommen

  return (
    <>
      <div className="hidden overflow-x-auto rounded-card bg-neutral-0 shadow-card md:block">
        <table className="w-full text-left">
          <caption className="sr-only">{bijschrift}</caption>
          <thead className="border-b border-neutral-200 text-ui-sm">
            <tr>
              {kolommen.map((k) => (
                <th key={k.kop} scope="col" className={`px-4 py-3 font-semibold ${k.getal ? 'text-right' : ''}`}>
                  {k.kop}
                </th>
              ))}
              {acties && (
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Acties</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rijen.map((rij) => (
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

      <ul className="space-y-3 md:hidden" aria-label={bijschrift}>
        {rijen.map((rij) => (
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
    </>
  )
}
