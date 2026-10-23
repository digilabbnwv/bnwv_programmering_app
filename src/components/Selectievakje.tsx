import { useId, type InputHTMLAttributes } from 'react'

export function Selectievakje({
  label,
  className = '',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string }) {
  const id = useId()
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <input id={id} type="checkbox" className="size-5 accent-anthracite" {...props} />
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
    </div>
  )
}
