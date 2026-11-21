import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'
import { Gegevens, Sectie } from '../components/Sectie'
import { Laadstatus } from '../components/Melding'
import { Tekstlink } from '../components/Tekstlink'
import { Pagina } from '../layout/Pagina'
import { lees, verwijder, type Medewerker, type Taak, type TaakUitvoerder } from '../werkbelasting/api'
import { formatUren } from '../werkbelasting/berekening'
import { VerwijderDialoog } from '../werkbelasting/onderdelen'
import { formatPeriode, loopt } from '../werkbelasting/opmaak'
import { TaakFormulier } from '../werkbelasting/TaakFormulier'
import { UitvoerdersSectie } from '../werkbelasting/Uitvoerders'
import { alles, useGegevens } from '../werkbelasting/useGegevens'

type Dialoog = { soort: 'wijzigen' } | { soort: 'verwijderen' }

export function TaakDetailPage() {
  const { id = '' } = useParams()
  const { client } = useAuth()
  const navigate = useNavigate()
  const laden = useCallback(
    async () =>
      alles<[Taak[], TaakUitvoerder[], Medewerker[]]>(
        await Promise.all([
          lees<Taak>(client, 'taken', 'naam', { kolom: 'id', waarde: id }),
          lees<TaakUitvoerder>(client, 'taak_uitvoerders', 'startdatum', { kolom: 'taak_id', waarde: id }),
          lees<Medewerker>(client, 'medewerkers', 'naam'),
        ]),
      ),
    [client, id],
  )
  const { data, fout, herlaad } = useGegevens(laden)
  const [dialoog, setDialoog] = useState<Dialoog | null>(null)
  const sluit = () => setDialoog(null)

  if (!data) {
    return (
      <Pagina titel="Taak">
        <Laadstatus fout={fout} />
      </Pagina>
    )
  }

  const [[taak], uitvoerders, medewerkers] = data
  if (!taak) {
    return (
      <Pagina titel="Taak niet gevonden">
        <Tekstlink to="/taken">
          Terug naar overige taken
        </Tekstlink>
      </Pagina>
    )
  }

  const urenNu = uitvoerders.filter((u) => loopt(u)).reduce((som, u) => som + u.uren_per_jaar, 0)

  return (
    <Pagina titel={taak.naam} intro={taak.omschrijving || undefined}>
      <Sectie
        titel="Gegevens"
        acties={
          <>
            <Button variant="secundair" onClick={() => setDialoog({ soort: 'wijzigen' })}>
              Wijzigen
            </Button>
            <Button variant="secundair" onClick={() => setDialoog({ soort: 'verwijderen' })}>
              Verwijderen
            </Button>
          </>
        }
      >
        <Gegevens
          regels={[
            ['Periode', formatPeriode(taak.startdatum, taak.einddatum)],
            ['Uren per jaar nu', `${formatUren(urenNu)} (alle huidige uitvoerders samen)`],
          ]}
        />
      </Sectie>

      <UitvoerdersSectie
        ouder={{ soort: 'taak', id: taak.id, startdatum: taak.startdatum, einddatum: taak.einddatum }}
        uitvoerders={uitvoerders}
        medewerkers={medewerkers}
        onGewijzigd={herlaad}
      />

      {dialoog?.soort === 'wijzigen' && <TaakFormulier taak={taak} onSluiten={sluit} onGelukt={herlaad} />}
      {dialoog?.soort === 'verwijderen' && (
        <VerwijderDialoog
          wat="Taak"
          toelichting="De uitvoerders worden ook verwijderd. Wil je de historie bewaren, geef de taak dan een einddatum."
          onVerwijderen={() => verwijder(client, 'taken', taak.id)}
          onSluiten={sluit}
          onGelukt={() => void navigate('/taken')}
        />
      )}
    </Pagina>
  )
}
