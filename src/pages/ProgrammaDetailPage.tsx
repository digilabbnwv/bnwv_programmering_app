import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'
import { Selectievakje } from '../components/Selectievakje'
import { Tabel } from '../components/Tabel'
import { Pagina } from '../layout/Pagina'
import {
  lees,
  PROGRAMMATYPES,
  verwijder,
  type Medewerker,
  type Programma,
  type ProgrammaUitvoerder,
  type School,
  type Toewijzing,
} from '../werkbelasting/api'
import { formatUren } from '../werkbelasting/berekening'
import { Gegevens, Laadstatus, Sectie, VerwijderDialoog } from '../werkbelasting/onderdelen'
import { loopt, opNaam } from '../werkbelasting/opmaak'
import { ProgrammaFormulier } from '../werkbelasting/ProgrammaFormulier'
import { UitvoerdersSectie } from '../werkbelasting/Uitvoerders'
import { alles, useGegevens } from '../werkbelasting/useGegevens'

type Dialoog = 'wijzigen' | 'verwijderen'

/**
 * Eén programma (werkbelasting.beheren). Werkt het met scholen, dan staan hier
 * de scholen die eronder vallen; werkt het met vaste uitvoerders, dan de
 * uitvoerders met hun uren.
 */
export function ProgrammaDetailPage() {
  const { id = '' } = useParams()
  const { client } = useAuth()
  const navigate = useNavigate()
  const laden = useCallback(
    async () =>
      alles<[Programma[], School[], Toewijzing[], Medewerker[], ProgrammaUitvoerder[]]>(
        await Promise.all([
          lees<Programma>(client, 'programmas', 'naam', { kolom: 'id', waarde: id }),
          lees<School>(client, 'scholen', 'naam', { kolom: 'programma_id', waarde: id }),
          lees<Toewijzing>(client, 'school_toewijzingen', 'startdatum'),
          lees<Medewerker>(client, 'medewerkers', 'naam'),
          lees<ProgrammaUitvoerder>(client, 'programma_uitvoerders', 'startdatum', { kolom: 'programma_id', waarde: id }),
        ]),
      ),
    [client, id],
  )
  const { data, fout, herlaad } = useGegevens(laden)
  const [dialoog, setDialoog] = useState<Dialoog | null>(null)
  const [ookInactief, setOokInactief] = useState(false)
  const sluit = () => setDialoog(null)

  if (!data) {
    return (
      <Pagina titel="Programma">
        <Laadstatus fout={fout} />
      </Pagina>
    )
  }

  const [[programma], scholen, toewijzingen, medewerkers, uitvoerders] = data
  if (!programma) {
    return (
      <Pagina titel="Programma niet gevonden">
        <Link to="/programmas" className="font-semibold underline underline-offset-4">
          Terug naar programma’s
        </Link>
      </Pagina>
    )
  }

  const metScholen = programma.type === 'scholen'
  const medewerkerVan = (schoolId: string) => {
    const t = toewijzingen.find((t) => t.school_id === schoolId && loopt(t))
    return t ? medewerkers.find((m) => m.id === t.medewerker_id) : undefined
  }
  const actief = scholen.filter((s) => s.actief)
  const zichtbaar = scholen.filter((s) => ookInactief || s.actief).sort(opNaam)
  const urenNu = uitvoerders.filter((u) => loopt(u)).reduce((som, u) => som + u.uren_per_jaar, 0)

  return (
    <Pagina titel={programma.naam} intro={programma.omschrijving || undefined}>
      <p className="mb-8">
        <Link to="/programmas" className="font-semibold underline underline-offset-4 hover:no-underline">
          Alle programma’s
        </Link>
      </p>

      <Sectie
        titel="Gegevens"
        acties={
          <>
            <Button variant="secundair" onClick={() => setDialoog('wijzigen')}>
              Wijzigen
            </Button>
            <Button variant="secundair" onClick={() => setDialoog('verwijderen')}>
              Verwijderen
            </Button>
          </>
        }
      >
        <Gegevens
          regels={[
            ['Naam', programma.naam],
            ['Soort programma', PROGRAMMATYPES.find((t) => t.waarde === programma.type)?.label ?? programma.type],
            ['Omschrijving', programma.omschrijving || '–'],
            metScholen
              ? ['Actieve scholen', String(actief.length)]
              : ['Uren per jaar nu', `${formatUren(urenNu)} (alle huidige uitvoerders samen)`],
          ]}
        />
      </Sectie>

      {metScholen ? (
        <Sectie titel="Scholen">
          <p className="mb-4 max-w-prose text-neutral-700">
            Het programma kies je bij de school zelf, via Scholen. De uren komen uit de staffel.
          </p>
          <div className="mb-4">
            <Selectievakje label="Ook inactieve scholen" checked={ookInactief} onChange={(e) => setOokInactief(e.target.checked)} />
          </div>
          <Tabel
            bijschrift={`Scholen in ${programma.naam}`}
            rijen={zichtbaar}
            sleutel={(s) => s.id}
            leeg="Er vallen geen scholen onder dit programma."
            kolommen={[
              {
                kop: 'School',
                inhoud: (s) => (
                  <Link to={`/scholen/${s.id}`} className="font-semibold underline underline-offset-4 hover:no-underline">
                    {s.naam}
                  </Link>
                ),
              },
              { kop: 'Soort', inhoud: (s) => s.soort },
              { kop: 'Plaats', inhoud: (s) => s.plaats },
              { kop: 'Medewerker', inhoud: (s) => medewerkerVan(s.id)?.naam ?? <span className="font-semibold">Geen</span> },
              { kop: 'Status', inhoud: (s) => (s.actief ? 'Actief' : 'Inactief') },
            ]}
          />
        </Sectie>
      ) : (
        <UitvoerdersSectie
          ouder={{ soort: 'programma', id: programma.id }}
          uitvoerders={uitvoerders}
          medewerkers={medewerkers}
          onGewijzigd={herlaad}
        />
      )}

      {dialoog === 'wijzigen' && (
        <ProgrammaFormulier
          programma={programma}
          typeVast={scholen.length > 0 || uitvoerders.length > 0}
          onSluiten={sluit}
          onGelukt={herlaad}
        />
      )}
      {dialoog === 'verwijderen' && (
        <VerwijderDialoog
          wat={`Programma ${programma.naam}`}
          toelichting={
            scholen.length > 0
              ? 'Dit kan pas als er geen scholen meer onder het programma vallen, ook geen inactieve.'
              : uitvoerders.length > 0
                ? 'De uitvoerders worden ook verwijderd, met hun uren in eerdere jaren.'
                : undefined
          }
          onVerwijderen={() =>
            verwijder(client, 'programmas', programma.id, {
              '23503': 'Er zijn nog scholen die onder dit programma vallen.',
            })
          }
          onSluiten={sluit}
          onGelukt={() => void navigate('/programmas')}
        />
      )}
    </Pagina>
  )
}
