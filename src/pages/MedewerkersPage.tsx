import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useRechten } from '../auth/RechtenProvider'
import { Button } from '../components/Button'
import { Filterbalk } from '../components/Filterbalk'
import { Selectievakje } from '../components/Selectievakje'
import { Tabel } from '../components/Tabel'
import { Laadstatus } from '../components/Melding'
import { Tekstlink } from '../components/Tekstlink'
import { useJaar } from '../layout/JaarProvider'
import { Pagina } from '../layout/Pagina'
import { indeling, type Afdeling, type Functie } from '../organisatie/api'
import { lees, type Contract, type Deelnemer, type Medewerker, type Toewijzing } from '../werkbelasting/api'
import { berekenWerkbelasting, contractPeriodes, formatPerWeek, perWeek } from '../werkbelasting/berekening'
import { MedewerkerFormulier } from '../werkbelasting/MedewerkerFormulier'
import { loopt, opNaam } from '../werkbelasting/opmaak'
import { bouwInvoer, laadRapportage, type Rapportagegegevens } from '../werkbelasting/rapportage'
import { alles, useGegevens } from '../werkbelasting/useGegevens'

/**
 * Overzicht van medewerkers (werkbelasting.bekijken; wijzigen met
 * werkbelasting.beheren). Contracturen en de uren die nog niet ingevuld zijn,
 * per week in het gekozen jaar, zoals in het teamoverzicht.
 */
export function MedewerkersPage() {
  const { client } = useAuth()
  const navigate = useNavigate()
  const { jaar } = useJaar()
  const laden = useCallback(
    async () =>
      alles<[Medewerker[], Contract[], Toewijzing[], Deelnemer[], Afdeling[], Functie[], Rapportagegegevens]>(
        await Promise.all([
          lees<Medewerker>(client, 'medewerkers', 'naam'),
          lees<Contract>(client, 'contracten', 'ingangsdatum'),
          lees<Toewijzing>(client, 'school_toewijzingen', 'startdatum'),
          lees<Deelnemer>(client, 'projectgroep_deelnemers', 'startdatum'),
          lees<Afdeling>(client, 'afdelingen', 'volgorde'),
          lees<Functie>(client, 'functies', 'naam'),
          laadRapportage(client, jaar),
        ]),
      ),
    [client, jaar],
  )
  const { data, fout } = useGegevens(laden)
  const [ookInactief, setOokInactief] = useState(false)
  const [nieuw, setNieuw] = useState(false)
  // Met werkbelasting.bekijken (MT) alleen-lezen.
  const magBeheren = useRechten().heeftRecht('werkbelasting.beheren')

  if (!data) {
    return (
      <Pagina titel="Medewerkers">
        <Laadstatus fout={fout} />
      </Pagina>
    )
  }

  const [medewerkers, contracten, toewijzingen, deelnemers, afdelingen, functies, rapportage] = data
  const werkjaar = rapportage.werkjaren.find((w) => w.jaar === jaar)
  // Zonder werkjaar is er geen werkbelasting; dan het contract van nu en geen "niet ingevuld".
  const werkbelasting = new Map(
    werkjaar ? medewerkers.map((m) => [m.id, berekenWerkbelasting(bouwInvoer(rapportage, m.id, werkjaar))] as const) : [],
  )
  const contractNu = (id: string) =>
    contractPeriodes(contracten.filter((c) => c.medewerker_id === id)).find((c) => loopt(c))?.uren_per_week ?? null
  /** Contracturen per week: gemiddeld over het jaar (ook bij een wijziging halverwege), anders het contract van nu. */
  const contractPerWeek = (id: string): number | null => {
    const w = werkbelasting.get(id)
    if (!w) return contractNu(id)
    return w.contracturen > 0 ? perWeek(w.contracturen, w.werkweken) : null
  }
  const nietIngevuld = (id: string): number | null => {
    const w = werkbelasting.get(id)
    return w && w.contracturen > 0 ? perWeek(w.overig, w.werkweken) : null
  }
  const aantal = (rijen: { medewerker_id: string; startdatum: string; einddatum: string | null }[], id: string) =>
    rijen.filter((r) => r.medewerker_id === id && loopt(r)).length
  const zichtbaar = medewerkers.filter((m) => ookInactief || m.actief).sort(opNaam)

  return (
    <Pagina
      titel="Medewerkers"
      intro={
        werkjaar
          ? `Medewerkers met hun contract, de uren die nog niet ingevuld zijn, scholen en projectgroepen. Uren per week in ${jaar}.`
          : `Medewerkers met hun contract, scholen en projectgroepen. Voor ${jaar} zijn nog geen jaarinstellingen, dus de niet ingevulde uren zijn onbekend.`
      }
      acties={magBeheren && <Button onClick={() => setNieuw(true)}>Nieuwe medewerker</Button>}
    >
      <Filterbalk>
        <Selectievakje label="Ook inactieve medewerkers" checked={ookInactief} onChange={(e) => setOokInactief(e.target.checked)} />
      </Filterbalk>

      <Tabel
        bijschrift="Medewerkers"
        rijen={zichtbaar}
        sleutel={(m) => m.id}
        leeg="Er zijn nog geen medewerkers."
        kolommen={[
          {
            kop: 'Naam',
            inhoud: (m) => (
              <Tekstlink to={`/medewerkers/${m.id}`}>
                {m.naam}
              </Tekstlink>
            ),
          },
          {
            kop: 'Functie en afdeling',
            inhoud: (m) => indeling(m, functies, afdelingen) ?? <span className="font-semibold">Niet ingedeeld</span>,
            sorteer: (m) => indeling(m, functies, afdelingen) ?? '',
          },
          {
            kop: 'Contracturen per week',
            inhoud: (m) => {
              const u = contractPerWeek(m.id)
              return u === null ? <span className="font-semibold">Geen contract</span> : formatPerWeek(u)
            },
            getal: true,
            sorteer: (m) => contractPerWeek(m.id) ?? -1,
          },
          {
            kop: 'Uren niet ingevuld per week',
            inhoud: (m) => {
              const u = nietIngevuld(m.id)
              if (u === null) return '–'
              // Negatief is een tekort: vet, net als in het teamoverzicht.
              return u < -0.005 ? <strong>{formatPerWeek(u)}</strong> : formatPerWeek(u)
            },
            getal: true,
            sorteer: (m) => nietIngevuld(m.id) ?? Number.NEGATIVE_INFINITY,
          },
          { kop: 'Scholen', inhoud: (m) => aantal(toewijzingen, m.id), getal: true, sorteer: (m) => aantal(toewijzingen, m.id) },
          { kop: 'Projectgroepen', inhoud: (m) => aantal(deelnemers, m.id), getal: true, sorteer: (m) => aantal(deelnemers, m.id) },
        ]}
      />

      {nieuw && (
        <MedewerkerFormulier
          medewerker={null}
          gekoppeld={medewerkers.flatMap((m) => (m.user_id ? [m.user_id] : []))}
          afdelingen={afdelingen}
          functies={functies}
          onSluiten={() => setNieuw(false)}
          onGelukt={(id) => void navigate(`/medewerkers/${id}`)}
        />
      )}
    </Pagina>
  )
}
