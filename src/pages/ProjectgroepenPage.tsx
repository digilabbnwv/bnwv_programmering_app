import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'
import { Selectievakje } from '../components/Selectievakje'
import { Tabel } from '../components/Tabel'
import { Pagina } from '../layout/Pagina'
import { lees, type Deelnemer, type Medewerker, type Projectgroep } from '../werkbelasting/api'
import { formatUren } from '../werkbelasting/berekening'
import { Laadstatus } from '../werkbelasting/onderdelen'
import { formatPeriode, loopt, opNaam, vandaag } from '../werkbelasting/opmaak'
import { ProjectgroepFormulier } from '../werkbelasting/ProjectgroepFormulier'
import { alles, useGegevens } from '../werkbelasting/useGegevens'

/** Overzicht van projectgroepen met deelnemers en uren (werkbelasting.beheren). */
export function ProjectgroepenPage() {
  const { client } = useAuth()
  const navigate = useNavigate()
  const laden = useCallback(
    async () =>
      alles<[Projectgroep[], Deelnemer[], Medewerker[]]>(
        await Promise.all([
          lees<Projectgroep>(client, 'projectgroepen', 'naam'),
          lees<Deelnemer>(client, 'projectgroep_deelnemers', 'startdatum'),
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
      <Pagina titel="Projectgroepen">
        <Laadstatus fout={fout} />
      </Pagina>
    )
  }

  const [projectgroepen, deelnemers, medewerkers] = data
  const huidigeDeelnemers = (id: string) => deelnemers.filter((d) => d.projectgroep_id === id && loopt(d))
  // Afgelopen: einddatum in het verleden. Toekomstige groepen blijven zichtbaar.
  const zichtbaar = projectgroepen.filter((p) => ookAfgelopen || p.einddatum === null || p.einddatum >= vandaag()).sort(opNaam)

  return (
    <Pagina titel="Projectgroepen" intro="Projectgroepen met hun deelnemers en de uren die ze per jaar vragen.">
      <div className="mb-6 flex flex-wrap items-center gap-6">
        <Button onClick={() => setNieuw(true)}>Nieuwe projectgroep</Button>
        <Selectievakje label="Ook afgelopen projectgroepen" checked={ookAfgelopen} onChange={(e) => setOokAfgelopen(e.target.checked)} />
      </div>

      <Tabel
        bijschrift="Projectgroepen"
        rijen={zichtbaar}
        sleutel={(p) => p.id}
        leeg={projectgroepen.length === 0 ? 'Er zijn nog geen projectgroepen.' : 'Geen lopende projectgroepen.'}
        kolommen={[
          {
            kop: 'Projectgroep',
            inhoud: (p) => (
              <Link to={`/projectgroepen/${p.id}`} className="font-semibold underline underline-offset-4 hover:no-underline">
                {p.naam}
              </Link>
            ),
          },
          { kop: 'Periode', inhoud: (p) => formatPeriode(p.startdatum, p.einddatum) },
          { kop: 'Trekker', inhoud: (p) => medewerkers.find((m) => m.id === p.trekker_id)?.naam ?? '' },
          {
            kop: 'Deelnemers nu',
            inhoud: (p) => {
              const n = huidigeDeelnemers(p.id).length
              return n === 0 ? <span className="font-semibold">Geen</span> : n
            },
            getal: true,
          },
          {
            kop: 'Uren per jaar',
            inhoud: (p) => formatUren(huidigeDeelnemers(p.id).reduce((som, d) => som + d.uren_per_jaar, 0)),
            getal: true,
          },
        ]}
      />

      {nieuw && (
        <ProjectgroepFormulier
          projectgroep={null}
          medewerkers={[...medewerkers].sort(opNaam)}
          onSluiten={() => setNieuw(false)}
          onGelukt={(id) => void navigate(`/projectgroepen/${id}`)}
        />
      )}
    </Pagina>
  )
}
