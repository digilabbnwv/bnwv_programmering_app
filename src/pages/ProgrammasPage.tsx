import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'
import { Tabel } from '../components/Tabel'
import { Laadstatus } from '../components/Melding'
import { Tekstlink } from '../components/Tekstlink'
import { Pagina } from '../layout/Pagina'
import { lees, PROGRAMMATYPES, type Programma, type ProgrammaUitvoerder, type School } from '../werkbelasting/api'
import { loopt, opNaam } from '../werkbelasting/opmaak'
import { ProgrammaFormulier } from '../werkbelasting/ProgrammaFormulier'
import { alles, useGegevens } from '../werkbelasting/useGegevens'

/** Overzicht van programma's met het aantal scholen of uitvoerders (werkbelasting.beheren). */
export function ProgrammasPage() {
  const { client } = useAuth()
  const navigate = useNavigate()
  const laden = useCallback(
    async () =>
      alles<[Programma[], School[], ProgrammaUitvoerder[]]>(
        await Promise.all([
          lees<Programma>(client, 'programmas', 'naam'),
          lees<School>(client, 'scholen', 'naam'),
          lees<ProgrammaUitvoerder>(client, 'programma_uitvoerders', 'startdatum'),
        ]),
      ),
    [client],
  )
  const { data, fout } = useGegevens(laden)
  const [nieuw, setNieuw] = useState(false)

  if (!data) {
    return (
      <Pagina titel="Programma’s">
        <Laadstatus fout={fout} />
      </Pagina>
    )
  }

  const [programmas, scholen, uitvoerders] = data
  const omvang = (p: Programma) => {
    if (p.type === 'scholen') {
      const aantal = scholen.filter((s) => s.programma_id === p.id && s.actief).length
      return aantal === 1 ? '1 actieve school' : `${aantal} actieve scholen`
    }
    const aantal = new Set(uitvoerders.filter((u) => u.programma_id === p.id && loopt(u)).map((u) => u.medewerker_id)).size
    return aantal === 1 ? '1 uitvoerder' : `${aantal} uitvoerders`
  }

  return (
    <Pagina
      titel="Programma’s"
      intro="Een programma werkt met scholen, zoals dBos of BoekStart, of met vaste uitvoerders, zoals Digilabs. Het teamoverzicht verdeelt de uren per programma."
      acties={<Button onClick={() => setNieuw(true)}>Nieuw programma</Button>}
    >

      <Tabel
        bijschrift="Programma’s"
        rijen={[...programmas].sort(opNaam)}
        sleutel={(p) => p.id}
        leeg="Er zijn nog geen programma’s."
        kolommen={[
          {
            kop: 'Programma',
            inhoud: (p) => (
              <Tekstlink to={`/programmas/${p.id}`}>
                {p.naam}
              </Tekstlink>
            ),
          },
          { kop: 'Soort', inhoud: (p) => PROGRAMMATYPES.find((t) => t.waarde === p.type)?.label ?? p.type },
          { kop: 'Omschrijving', inhoud: (p) => p.omschrijving },
          { kop: 'Nu', inhoud: omvang },
        ]}
      />

      {nieuw && (
        <ProgrammaFormulier programma={null} onSluiten={() => setNieuw(false)} onGelukt={(id) => void navigate(`/programmas/${id}`)} />
      )}
    </Pagina>
  )
}
