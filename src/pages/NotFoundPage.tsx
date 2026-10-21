import { Link } from 'react-router'
import { Pagina } from '../layout/Pagina'

export function NotFoundPage() {
  return (
    <Pagina titel="Pagina niet gevonden">
      <Link to="/" className="font-semibold underline underline-offset-4 hover:no-underline">
        Naar de startpagina
      </Link>
    </Pagina>
  )
}
