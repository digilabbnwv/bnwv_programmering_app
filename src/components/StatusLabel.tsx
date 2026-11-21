import type { ReactNode } from 'react'

/**
 * Kort label naast een titel (Pagina, prop status): de stand van wat de
 * pagina toont, zoals "Concept", "Definitief" of "Inactief". `let-op` voor een
 * stand die aandacht vraagt; de tekst blijft antraciet, het oranje alleen als
 * achtergrond (contrast, zie styles/index.css).
 */
export function StatusLabel({ soort = 'neutraal', children }: { soort?: 'neutraal' | 'let-op'; children: ReactNode }) {
  return (
    <span
      className={`inline-block rounded-pill px-3 py-1 text-ui-sm font-semibold ${
        soort === 'let-op' ? 'bg-orange-40 text-anthracite' : 'bg-neutral-100 text-anthracite'
      }`}
    >
      {children}
    </span>
  )
}
