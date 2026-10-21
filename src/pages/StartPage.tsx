import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'

interface Profiel {
  weergavenaam: string
  rol: string
}

export function StartPage() {
  const { client, claims, uitloggen } = useAuth()
  const [profiel, setProfiel] = useState<Profiel | null>(null)
  const userId = claims?.sub

  useEffect(() => {
    if (!userId) return
    let actueel = true
    void (async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        client.from('profiles').select('weergavenaam').eq('user_id', userId).maybeSingle(),
        client.from('user_roles').select('roles(naam)').eq('user_id', userId).maybeSingle(),
      ])
      if (!actueel || !p) return
      const rol = (r?.roles as { naam?: string } | null)?.naam ?? ''
      setProfiel({ weergavenaam: p.weergavenaam as string, rol })
    })()
    return () => {
      actueel = false
    }
  }, [client, userId])

  return (
    <main className="mx-auto max-w-page px-4 py-12 md:px-8">
      <div className="mb-6 h-1 w-16 rounded-pill bg-orange" aria-hidden="true" />
      <h1 className="text-kop-medium font-extrabold">
        {profiel ? `Welkom, ${profiel.weergavenaam}` : 'Welkom'}
      </h1>
      {profiel?.rol && <p className="mt-2 text-neutral-700">Je rol: {profiel.rol}</p>}
      <p className="mt-4 max-w-prose text-intro text-neutral-700">
        Je bent ingelogd. De layout en het gebruikersbeheer volgen.
      </p>
      <div className="mt-8">
        <Button variant="secundair" onClick={() => void uitloggen()}>
          Uitloggen
        </Button>
      </div>
    </main>
  )
}
