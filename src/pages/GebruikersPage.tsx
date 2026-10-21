import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useRechten } from '../auth/RechtenProvider'
import { formatDatumTijd, haalGebruikers, haalRollen, type Gebruiker, type Rol } from '../beheer/api'
import { GebruikerAanmaken } from '../beheer/GebruikerAanmaken'
import { GebruikerBeheren } from '../beheer/GebruikerBeheren'
import { Button } from '../components/Button'
import { Melding } from '../components/Melding'
import { Pagina } from '../layout/Pagina'

/**
 * Overzicht van gebruikers (gebruikers.bekijken). Met gebruikers.beheren ook
 * aanmaken en beheren; dat loopt via de Edge Function admin-users.
 */
export function GebruikersPage() {
  const { client, claims } = useAuth()
  const { heeftRecht } = useRechten()
  const magBeheren = heeftRecht('gebruikers.beheren')

  const [gebruikers, setGebruikers] = useState<Gebruiker[] | null>(null)
  const [rollen, setRollen] = useState<Rol[]>([])
  const [fout, setFout] = useState<string | null>(null)
  const [aanmaken, setAanmaken] = useState(false)
  const [beherenId, setBeherenId] = useState<string | null>(null)

  const laad = useCallback(async () => {
    const [res, r] = await Promise.all([haalGebruikers(client), haalRollen(client)])
    setRollen(r)
    if (res.ok) {
      setGebruikers(res.data)
      setFout(null)
    } else {
      setFout(res.melding)
    }
  }, [client])

  useEffect(() => {
    let actueel = true
    void Promise.all([haalGebruikers(client), haalRollen(client)]).then(([res, r]) => {
      if (!actueel) return
      setRollen(r)
      if (res.ok) setGebruikers(res.data)
      else setFout(res.melding)
    })
    return () => {
      actueel = false
    }
  }, [client])

  const rolNaam = (id: string | null) => rollen.find((r) => r.id === id)?.naam ?? id ?? 'Geen rol'
  const beheren = gebruikers?.find((g) => g.user_id === beherenId) ?? null

  return (
    <Pagina
      titel="Gebruikers"
      intro={magBeheren ? 'Maak accounts aan en beheer rollen, wachtwoorden en tweestapsverificatie.' : 'Overzicht van alle accounts.'}
    >
      {magBeheren && (
        <div className="mb-6">
          <Button onClick={() => setAanmaken(true)} disabled={rollen.length === 0}>
            Nieuwe gebruiker
          </Button>
        </div>
      )}

      {fout && <Melding soort="fout">{fout}</Melding>}
      {!gebruikers && !fout && <p role="status">Bezig met laden…</p>}

      {gebruikers && (
        <>
          <p role="status" className="sr-only">
            {gebruikers.length} gebruikers
          </p>

          {/* Groot scherm: tabel */}
          <div className="hidden overflow-x-auto rounded-card bg-neutral-0 shadow-card md:block">
            <table className="w-full text-left">
              <caption className="sr-only">Gebruikers</caption>
              <thead className="border-b border-neutral-200 text-ui-sm">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Naam</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Rol</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold">2FA</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Laatst ingelogd</th>
                  {magBeheren && (
                    <th scope="col" className="px-4 py-3">
                      <span className="sr-only">Acties</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {gebruikers.map((g) => (
                  <tr key={g.user_id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-3">
                      <span className="block font-semibold">{g.weergavenaam}</span>
                      <span className="block text-ui-sm text-neutral-700">{g.email}</span>
                    </td>
                    <td className="px-4 py-3">{rolNaam(g.role_id)}</td>
                    <td className="px-4 py-3">
                      <Status gebruiker={g} />
                    </td>
                    <td className="px-4 py-3">{g.heeft_2fa ? 'Ingesteld' : 'Nog niet'}</td>
                    <td className="px-4 py-3 text-ui-sm">{formatDatumTijd(g.laatst_ingelogd)}</td>
                    {magBeheren && (
                      <td className="px-4 py-3 text-right">
                        <Button variant="link" onClick={() => setBeherenId(g.user_id)}>
                          Beheren<span className="sr-only"> {g.weergavenaam}</span>
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Klein scherm: lijst */}
          <ul className="space-y-3 md:hidden">
            {gebruikers.map((g) => (
              <li key={g.user_id} className="rounded-card bg-neutral-0 p-4 shadow-card">
                <p className="font-semibold">{g.weergavenaam}</p>
                <p className="text-ui-sm break-all text-neutral-700">{g.email}</p>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-ui-sm">
                  <dt className="text-neutral-700">Rol</dt>
                  <dd>{rolNaam(g.role_id)}</dd>
                  <dt className="text-neutral-700">Status</dt>
                  <dd>
                    <Status gebruiker={g} />
                  </dd>
                  <dt className="text-neutral-700">2FA</dt>
                  <dd>{g.heeft_2fa ? 'Ingesteld' : 'Nog niet'}</dd>
                  <dt className="text-neutral-700">Laatst ingelogd</dt>
                  <dd>{formatDatumTijd(g.laatst_ingelogd)}</dd>
                </dl>
                {magBeheren && (
                  <Button variant="secundair" className="mt-4" onClick={() => setBeherenId(g.user_id)}>
                    Beheren<span className="sr-only"> {g.weergavenaam}</span>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {aanmaken && (
        <GebruikerAanmaken rollen={rollen} onSluiten={() => setAanmaken(false)} onAangemaakt={() => void laad()} />
      )}
      {beheren && (
        <GebruikerBeheren
          gebruiker={beheren}
          rollen={rollen}
          isZelf={beheren.user_id === claims?.sub}
          onSluiten={() => setBeherenId(null)}
          onGewijzigd={() => void laad()}
        />
      )}
    </Pagina>
  )
}

function Status({ gebruiker }: { gebruiker: Gebruiker }) {
  if (!gebruiker.is_active) return <span className="font-semibold">Gedeactiveerd</span>
  if (gebruiker.must_change_password) return <span>Tijdelijk wachtwoord</span>
  return <span>Actief</span>
}
