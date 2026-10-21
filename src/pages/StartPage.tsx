import { useRechten } from '../auth/RechtenProvider'
import { Pagina } from '../layout/Pagina'

export function StartPage() {
  const { weergavenaam, rolNaam } = useRechten()
  return (
    <Pagina
      titel={weergavenaam ? `Welkom, ${weergavenaam}` : 'Welkom'}
      intro="Hier komen straks de onderdelen van BNWV Intern."
    >
      {rolNaam && <p className="text-neutral-700">Je rol: {rolNaam}</p>}
    </Pagina>
  )
}
