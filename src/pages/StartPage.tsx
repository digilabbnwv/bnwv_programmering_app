import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useRechten } from '../auth/RechtenProvider'
import { Pagina } from '../layout/Pagina'

export function StartPage() {
  const { weergavenaam, rolNaam, heeftRecht } = useRechten()
  const eigen = useEigenMedewerkerId()
  return (
    <Pagina
      titel={weergavenaam ? `Welkom, ${weergavenaam}` : 'Welkom'}
      intro="Hier komen straks de onderdelen van BNWV Team Programmering."
    >
      {rolNaam && <p className="text-neutral-700">Je rol: {rolNaam}</p>}
      <ul className="mt-6 space-y-2">
        {eigen && (
          <li>
            <Link to={`/werkbelasting/${eigen}`} className="font-semibold underline underline-offset-4 hover:no-underline">
              Mijn werkurenverdeling
            </Link>
          </li>
        )}
        {heeftRecht('werkbelasting.bekijken') && (
          <li>
            <Link to="/rapportage" className="font-semibold underline underline-offset-4 hover:no-underline">
              Rapportage van het team
            </Link>
          </li>
        )}
      </ul>
    </Pagina>
  )
}

/** De medewerker die aan het eigen account gekoppeld is, of null. */
function useEigenMedewerkerId(): string | null {
  const { client, claims } = useAuth()
  const userId = claims?.sub
  const [eigen, setEigen] = useState<{ userId: string; id: string } | null>(null)
  useEffect(() => {
    if (!userId) return
    let actueel = true
    void client
      .from('medewerkers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (actueel && data) setEigen({ userId, id: data.id as string })
      })
    return () => {
      actueel = false
    }
  }, [client, userId])
  return eigen && eigen.userId === userId ? eigen.id : null
}
