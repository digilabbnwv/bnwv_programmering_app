import { Tekstlink } from '../components/Tekstlink'
import { Pagina } from '../layout/Pagina'

export function NotFoundPage() {
  return (
    <Pagina titel="Pagina niet gevonden" breedte="smal">
      <Tekstlink to="/">
        Naar de startpagina
      </Tekstlink>
    </Pagina>
  )
}
