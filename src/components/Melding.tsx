import type { ReactNode } from 'react'

type Soort = 'fout' | 'info'

/** Meldingsblok. Fouten worden direct voorgelezen (role="alert"). */
export function Melding({ soort, children }: { soort: Soort; children: ReactNode }) {
  return (
    <div
      role={soort === 'fout' ? 'alert' : 'status'}
      className={`rounded-md border-l-4 bg-neutral-50 px-4 py-3 ${
        soort === 'fout' ? 'border-pijler-doe' : 'border-pijler-vraag'
      }`}
    >
      {children}
    </div>
  )
}
