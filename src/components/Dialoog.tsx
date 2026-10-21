import { useEffect, useId, useRef, type ReactNode } from 'react'

/**
 * Modale dialoog op basis van <dialog>: de browser houdt de focus erin; na
 * het sluiten gaat hij terug naar de knop die de dialoog opende. Escape en de
 * sluitknop roepen onSluiten aan.
 */
export function Dialoog({
  titel,
  onSluiten,
  children,
}: {
  titel: string
  onSluiten: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titelId = useId()

  useEffect(() => {
    const el = ref.current
    // De browser zet de focus alleen terug bij close(), niet als React de
    // dialoog weghaalt. Daarom zelf onthouden wat de dialoog opende.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (el && !el.open) el.showModal()
    return () => {
      el?.close()
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titelId}
      onCancel={(e) => {
        e.preventDefault()
        onSluiten()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-card bg-neutral-0 p-0 text-anthracite shadow-raised backdrop:bg-anthracite/60"
    >
      <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-6 py-4">
        <h2 id={titelId} className="text-subkop font-bold">
          {titel}
        </h2>
        <button
          type="button"
          onClick={onSluiten}
          className="-mr-2 cursor-pointer rounded-md p-2 hover:bg-neutral-100"
          aria-label="Sluiten"
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="px-6 py-5">{children}</div>
    </dialog>
  )
}
