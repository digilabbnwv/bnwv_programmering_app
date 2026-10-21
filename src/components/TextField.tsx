import { useId, type InputHTMLAttributes } from 'react'

export function TextField({
  label,
  hint,
  fout,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
  fout?: string | null
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const foutId = `${id}-fout`
  const beschrijving = [hint ? hintId : null, fout ? foutId : null].filter(Boolean).join(' ')

  return (
    <div className={className}>
      <label htmlFor={id} className="block font-semibold">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="mt-1 text-ui-sm text-neutral-700">
          {hint}
        </p>
      )}
      <input
        id={id}
        aria-invalid={fout ? true : undefined}
        aria-describedby={beschrijving || undefined}
        className={`mt-2 block w-full rounded-md border-2 bg-neutral-0 px-3 py-2.5 text-ui-md ${
          fout ? 'border-pijler-doe' : 'border-neutral-500'
        }`}
        {...props}
      />
      {fout && (
        <p id={foutId} className="mt-2 text-ui-sm font-semibold">
          <span aria-hidden="true" className="mr-1 inline-block size-2 rounded-pill bg-pijler-doe" />
          {fout}
        </p>
      )}
    </div>
  )
}
