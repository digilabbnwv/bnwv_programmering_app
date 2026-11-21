import { Tekstlink } from '../components/Tekstlink'
import { Pagina } from '../layout/Pagina'

export function NotFoundPage() {
  return (
    <Pagina titel="Pagina niet gevonden">
      <Tekstlink to="/">
        Naar de startpagina
      </Tekstlink>
    </Pagina>
  )
}
