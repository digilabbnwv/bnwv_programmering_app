import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'
import { Tabel } from '../components/Tabel'
import { Pagina } from '../layout/Pagina'
import { lees, type Programma, type School } from '../werkbelasting/api'
import { Laadstatus } from '../werkbelasting/onderdelen'
import { opNaam } from '../werkbelasting/opmaak'
import { ProgrammaFormulier } from '../werkbelasting/ProgrammaFormulier'
import { alles, useGegevens } from '../werkbelasting/useGegevens'

/** Overzicht van programma's met het aantal scholen (werkbelasting.beheren). */
export function ProgrammasPage() {
  const { client } = useAuth()
  const navigate = useNavigate()
  const laden = useCallback(
    async () =>
      alles<[Programma[], School[]]>(
        await Promise.all([lees<Programma>(client, 'programmas', 'naam'), lees<School>(client, 'scholen', 'naam')]),
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

  const [programmas, scholen] = data
  const actieveScholen = (id: string) => scholen.filter((s) => s.programma_id === id && s.actief).length
  const zonderProgramma = scholen.filter((s) => s.actief && s.programma_id === null).length

  return (
    <Pagina
      titel="Programma’s"
      intro="Programma’s waaronder scholen vallen, zoals dBos of BoekStart. De rapportage verdeelt de schooluren per programma."
    >
      <div className="mb-6">
        <Button onClick={() => setNieuw(true)}>Nieuw programma</Button>
      </div>

      {zonderProgramma > 0 && (
        <p role="status" className="mb-4 text-ui-sm text-neutral-700">
          {zonderProgramma === 1 ? '1 actieve school valt' : `${zonderProgramma} actieve scholen vallen`} onder geen programma.
        </p>
      )}

      <Tabel
        bijschrift="Programma’s"
        rijen={[...programmas].sort(opNaam)}
        sleutel={(p) => p.id}
        leeg="Er zijn nog geen programma’s."
        kolommen={[
          {
            kop: 'Programma',
            inhoud: (p) => (
              <Link to={`/programmas/${p.id}`} className="font-semibold underline underline-offset-4 hover:no-underline">
                {p.naam}
              </Link>
            ),
          },
          { kop: 'Omschrijving', inhoud: (p) => p.omschrijving },
          { kop: 'Actieve scholen', inhoud: (p) => actieveScholen(p.id), getal: true },
        ]}
      />

      {nieuw && (
        <ProgrammaFormulier programma={null} onSluiten={() => setNieuw(false)} onGelukt={(id) => void navigate(`/programmas/${id}`)} />
      )}
    </Pagina>
  )
}
