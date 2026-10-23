import { useId, type TextareaHTMLAttributes } from 'react'

export function TextArea({
  label,
  hint,
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  hint?: string
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
      <textarea
        id={id}
        rows={3}
        aria-describedby={hint ? hintId : undefined}
        className="mt-2 block w-full rounded-md border-2 border-neutral-500 bg-neutral-0 px-3 py-2.5 text-ui-md"
        {...props}
      />
    </div>
  )
}
