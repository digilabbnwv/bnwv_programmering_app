import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'
import { Selectievakje } from '../components/Selectievakje'
import { Tabel } from '../components/Tabel'
import { Pagina } from '../layout/Pagina'
import { lees, type Medewerker, type Taak, type TaakUitvoerder } from '../werkbelasting/api'
import { formatUren } from '../werkbelasting/berekening'
import { Laadstatus } from '../werkbelasting/onderdelen'
import { formatPeriode, loopt, opNaam, vandaag } from '../werkbelasting/opmaak'
import { TaakFormulier } from '../werkbelasting/TaakFormulier'
import { alles, useGegevens } from '../werkbelasting/useGegevens'

/** Overzicht van overige taken met hun uitvoerders en uren (werkbelasting.beheren). */
export function TakenPage() {
  const { client } = useAuth()
  const navigate = useNavigate()
  const laden = useCallback(
    async () =>
      alles<[Taak[], TaakUitvoerder[], Medewerker[]]>(
        await Promise.all([
          lees<Taak>(client, 'taken', 'naam'),
          lees<TaakUitvoerder>(client, 'taak_uitvoerders', 'startdatum'),
          lees<Medewerker>(client, 'medewerkers', 'naam'),
        ]),
      ),
    [client],
  )
  const { data, fout } = useGegevens(laden)
  const [ookAfgelopen, setOokAfgelopen] = useState(false)
  const [nieuw, setNieuw] = useState(false)

  if (!data) {
    return (
      <Pagina titel="Overige taken">
        <Laadstatus fout={fout} />
      </Pagina>
    )
  }

  const [taken, uitvoerders, medewerkers] = data
  const huidig = (id: string) => uitvoerders.filter((u) => u.taak_id === id && loopt(u))
  const naamVan = (id: string) => medewerkers.find((m) => m.id === id)?.naam ?? 'Onbekend'
  const zichtbaar = taken.filter((t) => ookAfgelopen || t.einddatum === null || t.einddatum >= vandaag()).sort(opNaam)
  const zonder = zichtbaar.filter((t) => loopt(t) && huidig(t.id).length === 0).length

  return (
    <Pagina
      titel="Overige taken"
      intro="Taken naast scholen en projectgroepen, met wie ze uitvoert en een inschatting van de uren per jaar."
    >
      <div className="mb-6 flex flex-wrap items-center gap-6">
        <Button onClick={() => setNieuw(true)}>Nieuwe taak</Button>
        <Selectievakje label="Ook afgelopen taken" checked={ookAfgelopen} onChange={(e) => setOokAfgelopen(e.target.checked)} />
      </div>

      {zonder > 0 && (
        <p role="status" className="mb-4 text-ui-sm text-neutral-700">
          {zonder === 1 ? '1 lopende taak heeft' : `${zonder} lopende taken hebben`} nu geen uitvoerder.
        </p>
      )}

      <Tabel
        bijschrift="Overige taken"
        rijen={zichtbaar}
        sleutel={(t) => t.id}
        leeg={taken.length === 0 ? 'Er zijn nog geen taken.' : 'Geen lopende taken.'}
        kolommen={[
          {
            kop: 'Taak',
            inhoud: (t) => (
              <Link to={`/taken/${t.id}`} className="font-semibold underline underline-offset-4 hover:no-underline">
                {t.naam}
              </Link>
            ),
          },
          { kop: 'Periode', inhoud: (t) => formatPeriode(t.startdatum, t.einddatum) },
          {
            kop: 'Uitvoerders nu',
            inhoud: (t) => {
              const nu = huidig(t.id)
              return nu.length === 0 ? (
                <span className="font-semibold">Niemand</span>
              ) : (
                nu
                  .map((u) => naamVan(u.medewerker_id))
                  .sort((a, b) => a.localeCompare(b, 'nl'))
                  .join(', ')
              )
            },
          },
          {
            kop: 'Uren per jaar',
            inhoud: (t) => formatUren(huidig(t.id).reduce((som, u) => som + u.uren_per_jaar, 0)),
            getal: true,
          },
        ]}
      />

      {nieuw && <TaakFormulier taak={null} onSluiten={() => setNieuw(false)} onGelukt={(id) => void navigate(`/taken/${id}`)} />}
    </Pagina>
  )
}
