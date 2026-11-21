import { Link, type LinkProps } from 'react-router'

/**
 * Link in lopende tekst of in een tabel: onderstreept, zonder streep bij hover.
 * Standaard vet; `licht` voor links in een tabelcel naast andere gegevens.
 */
export function Tekstlink({ licht = false, className = '', ...props }: LinkProps & { licht?: boolean }) {
  return (
    <Link
      {...props}
      className={`${licht ? '' : 'font-semibold'} underline underline-offset-4 hover:no-underline ${className}`.trim()}
    />
  )
}
