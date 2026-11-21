import type { ReactNode } from 'react'

/**
 * Rij kengetallen. De kolommen vullen de breedte: vier, vijf of zes kaarten
 * naast elkaar op een groot scherm, twee op een telefoon.
 */
export function Kengetallen({ className = '', children }: { className?: string; children: ReactNode }) {
  return <dl className={`grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-4 ${className}`.trim()}>{children}</dl>
}

/** Eén kengetal: label, waarde en een toelichting eronder. Hoort in Kengetallen. */
export function Kengetal({ label, waarde, toelichting }: { label: string; waarde: string; toelichting: string }) {
  return (
    <div className="rounded-card bg-neutral-0 p-5 shadow-card print:border print:border-neutral-300 print:shadow-none">
      <dt className="text-ui-sm font-semibold text-neutral-700">{label}</dt>
      <dd className="mt-1 text-subkop font-bold tabular-nums">{waarde}</dd>
      <dd className="text-ui-sm text-neutral-700">{toelichting}</dd>
    </div>
  )
}
