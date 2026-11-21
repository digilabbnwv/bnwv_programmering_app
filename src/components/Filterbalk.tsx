import type { ReactNode } from 'react'

/**
 * Balk boven de inhoud met de keuzes en knoppen die voor de hele pagina gelden,
 * zoals het jaar en Afdrukken. Op papier niet zichtbaar.
 */
export function Filterbalk({ children }: { children: ReactNode }) {
  return <div className="mb-8 flex flex-wrap items-end gap-3 print:hidden">{children}</div>
}
