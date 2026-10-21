import type { ComponentProps } from 'react'

type Variant = 'primair' | 'secundair' | 'link'

const STIJLEN: Record<Variant, string> = {
  primair:
    'rounded-md bg-anthracite px-5 py-3 font-semibold text-white hover:bg-anthracite-hover disabled:bg-neutral-500',
  secundair:
    'rounded-md border-2 border-anthracite px-5 py-2.5 font-semibold text-anthracite hover:bg-neutral-100 disabled:border-neutral-500 disabled:text-neutral-500',
  link: 'font-semibold underline underline-offset-4 hover:no-underline disabled:text-neutral-500',
}

export function Button({
  variant = 'primair',
  className = '',
  type = 'button',
  ...props
}: ComponentProps<'button'> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`cursor-pointer disabled:cursor-not-allowed ${STIJLEN[variant]} ${className}`}
      {...props}
    />
  )
}
