import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'
import { Selectievakje } from '../components/Selectievakje'
import { Tabel } from '../components/Tabel'
import { Pagina } from '../layout/Pagina'
import { lees, type Contract, type Deelnemer, type Medewerker, type Toewijzing } from '../werkbelasting/api'
import { contractPeriodes } from '../werkbelasting/berekening'
import { MedewerkerFormulier } from '../werkbelasting/MedewerkerFormulier'
import { Laadstatus } from '../werkbelasting/onderdelen'
import { getalAlsTekst, loopt, opNaam } from '../werkbelasting/opmaak'
import { alles, useGegevens } from '../werkbelasting/useGegevens'

/** Overzicht van medewerkers (werkbelasting.beheren). */
export function MedewerkersPage() {
  const { client } = useAuth()
  const navigate = useNavigate()
  const laden = useCallback(
    async () =>
      alles<[Medewerker[], Contract[], Toewijzing[], Deelnemer[]]>(
        await Promise.all([
          lees<Medewerker>(client, 'medewerkers', 'naam'),
          lees<Contract>(client, 'contracten', 'ingangsdatum'),
          lees<Toewijzing>(client, 'school_toewijzingen', 'startdatum'),
          lees<Deelnemer>(client, 'projectgroep_deelnemers', 'startdatum'),
        ]),
      ),
    [client],
  )
  const { data, fout } = useGegevens(laden)
  const [ookInactief, setOokInactief] = useState(false)
  const [nieuw, setNieuw] = useState(false)

  if (!data) {
    return (
      <Pagina titel="Medewerkers">
        <Laadstatus fout={fout} />
      </Pagina>
    )
  }

  const [medewerkers, contracten, toewijzingen, deelnemers] = data
  const urenPerWeek = (id: string) =>
    contractPeriodes(contracten.filter((c) => c.medewerker_id === id)).find((c) => loopt(c))?.uren_per_week ?? null
  const aantal = (rijen: { medewerker_id: string; startdatum: string; einddatum: string | null }[], id: string) =>
    rijen.filter((r) => r.medewerker_id === id && loopt(r)).length
  const zichtbaar = medewerkers.filter((m) => ookInactief || m.actief).sort(opNaam)

  return (
    <Pagina titel="Medewerkers" intro="Medewerkers met hun contract, scholen en projectgroepen.">
      <div className="mb-6 flex flex-wrap items-center gap-6">
        <Button onClick={() => setNieuw(true)}>Nieuwe medewerker</Button>
        <Selectievakje label="Ook inactieve medewerkers" checked={ookInactief} onChange={(e) => setOokInactief(e.target.checked)} />
      </div>

      <Tabel
        bijschrift="Medewerkers"
        rijen={zichtbaar}
        sleutel={(m) => m.id}
        leeg="Er zijn nog geen medewerkers."
        kolommen={[
          {
            kop: 'Naam',
            inhoud: (m) => (
              <Link to={`/medewerkers/${m.id}`} className="font-semibold underline underline-offset-4 hover:no-underline">
                {m.naam}
              </Link>
            ),
          },
          { kop: 'Functie', inhoud: (m) => m.functie },
          {
            kop: 'Uren per week',
            inhoud: (m) => {
              const u = urenPerWeek(m.id)
              return u === null ? <span className="font-semibold">Geen contract</span> : getalAlsTekst(u)
            },
            getal: true,
          },
          { kop: 'Scholen', inhoud: (m) => aantal(toewijzingen, m.id), getal: true },
          { kop: 'Projectgroepen', inhoud: (m) => aantal(deelnemers, m.id), getal: true },
          { kop: 'Account', inhoud: (m) => (m.user_id ? 'Gekoppeld' : 'Geen') },
          { kop: 'Status', inhoud: (m) => (m.actief ? 'Actief' : 'Inactief') },
        ]}
      />

      {nieuw && (
        <MedewerkerFormulier
          medewerker={null}
          gekoppeld={medewerkers.flatMap((m) => (m.user_id ? [m.user_id] : []))}
          onSluiten={() => setNieuw(false)}
          onGelukt={(id) => void navigate(`/medewerkers/${id}`)}
        />
      )}
    </Pagina>
  )
}
