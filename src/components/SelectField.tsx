import { useId, type SelectHTMLAttributes } from 'react'

export function SelectField({
  label,
  hint,
  opties,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  hint?: string
  opties: { waarde: string; label: string }[]
}) {
  const id = useId()
  const hintId = `${id}-hint`
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
      <select
        id={id}
        aria-describedby={hint ? hintId : undefined}
        className="mt-2 block w-full rounded-md border-2 border-neutral-500 bg-neutral-0 px-3 py-2.5 text-ui-md disabled:border-neutral-300 disabled:text-neutral-500"
        {...props}
      >
        {opties.map((o) => (
          <option key={o.waarde} value={o.waarde}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
