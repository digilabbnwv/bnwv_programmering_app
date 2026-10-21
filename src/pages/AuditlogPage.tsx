import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { formatDatumTijd, haalGebruikers, haalRollen, type Gebruiker, type Rol } from '../beheer/api'
import { beschrijfActie, type AuditRegel } from '../beheer/auditlog'
import { Button } from '../components/Button'
import { Melding } from '../components/Melding'
import { Pagina } from '../layout/Pagina'

const PER_PAGINA = 50

/** Auditlog (auditlog.lezen). Alleen lezen: de database staat wijzigen niet toe. */
export function AuditlogPage() {
  const { client } = useAuth()
  const [pagina, setPagina] = useState(0)
  const [resultaat, setResultaat] = useState<{ pagina: number; regels: AuditRegel[]; totaal: number } | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  const [namen, setNamen] = useState<Map<string, Gebruiker>>(new Map())
  const [rollen, setRollen] = useState<Rol[]>([])

  useEffect(() => {
    let actueel = true
    void Promise.all([haalGebruikers(client), haalRollen(client)]).then(([g, r]) => {
      if (!actueel) return
      if (g.ok) setNamen(new Map(g.data.map((x) => [x.user_id, x])))
      setRollen(r)
    })
    return () => {
      actueel = false
    }
  }, [client])

  useEffect(() => {
    let actueel = true
    void (async () => {
      const van = pagina * PER_PAGINA
      const { data, error, count } = await client
        .from('audit_log')
        .select('id, created_at, actor_id, action, target_user_id, details', { count: 'exact' })
        .order('id', { ascending: false })
        .range(van, van + PER_PAGINA - 1)
      if (!actueel) return
      if (error) {
        setFout('De auditlog laden lukt nu niet. Probeer het later opnieuw.')
        return
      }
      setFout(null)
      setResultaat({ pagina, regels: (data ?? []) as AuditRegel[], totaal: count ?? 0 })
    })()
    return () => {
      actueel = false
    }
  }, [client, pagina])

  const naam = (id: string | null) => {
    if (!id) return 'Systeem'
    return namen.get(id)?.weergavenaam ?? 'Onbekende gebruiker'
  }
  const rolNaam = (id: string) => rollen.find((r) => r.id === id)?.naam ?? id

  const laden = !resultaat || resultaat.pagina !== pagina
  const totaalPaginas = resultaat ? Math.max(1, Math.ceil(resultaat.totaal / PER_PAGINA)) : 1

  return (
    <Pagina titel="Auditlog" intro="Inloggen, wachtwoordwijzigingen en beheeracties, nieuwste eerst.">
      {fout && <Melding soort="fout">{fout}</Melding>}
      {laden && !fout && <p role="status">Bezig met laden…</p>}

      {resultaat && !laden && (
        <>
          {resultaat.regels.length === 0 ? (
            <p>Er staat nog niets in de auditlog.</p>
          ) : (
            <ol className="divide-y divide-neutral-100 rounded-card bg-neutral-0 shadow-card">
              {resultaat.regels.map((r) => {
                const door = naam(r.actor_id)
                const betreft = r.target_user_id && r.target_user_id !== r.actor_id ? naam(r.target_user_id) : null
                return (
                  <li key={r.id} className="px-4 py-3 md:flex md:items-baseline md:gap-6">
                    <time dateTime={r.created_at} className="block shrink-0 text-ui-sm text-neutral-700 md:w-44">
                      {formatDatumTijd(r.created_at)}
                    </time>
                    <p>
                      <span className="font-semibold">{beschrijfActie(r, rolNaam)}</span>{' '}
                      <span className="block text-ui-sm text-neutral-700 md:inline md:before:content-['_·_']">
                        door {door}
                        {betreft && <> · betreft {betreft}</>}
                      </span>
                    </p>
                  </li>
                )
              })}
            </ol>
          )}

          {totaalPaginas > 1 && (
            <nav aria-label="Pagina's van de auditlog" className="mt-6 flex flex-wrap items-center gap-4">
              <Button variant="secundair" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
                Nieuwer
              </Button>
              <span>
                Pagina {pagina + 1} van {totaalPaginas}
              </span>
              <Button
                variant="secundair"
                disabled={pagina + 1 >= totaalPaginas}
                onClick={() => setPagina((p) => p + 1)}
              >
                Ouder
              </Button>
            </nav>
          )}
        </>
      )}
    </Pagina>
  )
}
