import type { ReactNode } from 'react'

/** Deel van een pagina met een kop (h2) en eventueel acties rechts van de kop. */
export function Sectie({
  titel,
  acties,
  children,
}: {
  titel: string
  acties?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="mt-10 first:mt-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-subkop font-bold">{titel}</h2>
        {acties && <div className="flex flex-wrap gap-3">{acties}</div>}
      </div>
      {children}
    </section>
  )
}

/** Kaart met een kleine kop (h3) binnen een sectie, bijvoorbeeld om een grafiek. */
export function Blok({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <div className="rounded-card bg-neutral-0 p-5 shadow-card md:p-6">
      <h3 className="mb-4 font-bold">{titel}</h3>
      {children}
    </div>
  )
}

/** Gegevens als lijst van label en waarde. Lege waarden worden weggelaten. */
export function Gegevens({ regels }: { regels: [string, ReactNode][] }) {
  const gevuld = regels.filter(([, waarde]) => waarde !== '' && waarde !== null && waarde !== undefined)
  return (
    <dl className="grid gap-x-6 gap-y-2 rounded-card bg-neutral-0 p-5 shadow-card sm:grid-cols-[max-content_1fr]">
      {gevuld.map(([label, waarde]) => (
        <div key={label} className="contents">
          <dt className="font-semibold">{label}</dt>
          <dd className="mb-2 sm:mb-0">{waarde}</dd>
        </div>
      ))}
    </dl>
  )
}
