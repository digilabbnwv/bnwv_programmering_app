import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'
import { SelectField } from '../components/SelectField'
import { Tabel } from '../components/Tabel'
import { TextField } from '../components/TextField'
import { Pagina } from '../layout/Pagina'
import { lees, verwijder, voerUit, type Medewerker, type Taak, type TaakUitvoerder } from '../werkbelasting/api'
import { formatUren } from '../werkbelasting/berekening'
import { FormulierDialoog, Gegevens, Laadstatus, ongeldig, Sectie, VerwijderDialoog } from '../werkbelasting/onderdelen'
import { formatDatum, formatPeriode, getalAlsTekst, leesGetal, loopt, opNaam, vandaag } from '../werkbelasting/opmaak'
import { TaakFormulier } from '../werkbelasting/TaakFormulier'
import { alles, useGegevens } from '../werkbelasting/useGegevens'

type Dialoog =
  | { soort: 'wijzigen' }
  | { soort: 'verwijderen' }
  | { soort: 'uitvoerder'; uitvoerder: TaakUitvoerder | null }
  | { soort: 'overdragen'; uitvoerder: TaakUitvoerder }
  | { soort: 'uitvoerder-verwijderen'; uitvoerder: TaakUitvoerder }

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
        <Link to="/taken" className="font-semibold underline underline-offset-4">
          Terug naar overige taken
        </Link>
      </Pagina>
    )
  }

  const naamVan = (medewerkerId: string) => medewerkers.find((m) => m.id === medewerkerId)?.naam ?? 'Onbekend'
  const opNaamGesorteerd = [...medewerkers].sort(opNaam)
  const gesorteerd = [...uitvoerders].sort(
    (a, b) => naamVan(a.medewerker_id).localeCompare(naamVan(b.medewerker_id), 'nl') || a.startdatum.localeCompare(b.startdatum),
  )
  const urenNu = uitvoerders.filter((u) => loopt(u)).reduce((som, u) => som + u.uren_per_jaar, 0)

  return (
    <Pagina titel={taak.naam} intro={taak.omschrijving || undefined}>
      <p className="mb-8">
        <Link to="/taken" className="font-semibold underline underline-offset-4 hover:no-underline">
          Alle overige taken
        </Link>
      </p>

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

      <Sectie
        titel="Uitvoerders"
        acties={<Button onClick={() => setDialoog({ soort: 'uitvoerder', uitvoerder: null })}>Uitvoerder toevoegen</Button>}
      >
        <p className="mb-4 max-w-prose text-neutral-700">
          Neemt een collega het deel van iemand over? Kies dan Overdragen: de huidige uitvoerder stopt de dag ervoor en de
          collega krijgt dezelfde uren.
        </p>
        <Tabel
          bijschrift="Uitvoerders"
          rijen={gesorteerd}
          sleutel={(u) => u.id}
          leeg="Nog niemand voert deze taak uit."
          kolommen={[
            {
              kop: 'Medewerker',
              inhoud: (u) => (
                <Link to={`/medewerkers/${u.medewerker_id}`} className="underline underline-offset-4 hover:no-underline">
                  {naamVan(u.medewerker_id)}
                </Link>
              ),
            },
            { kop: 'Uren per jaar', inhoud: (u) => formatUren(u.uren_per_jaar), getal: true },
            { kop: 'Periode', inhoud: (u) => formatPeriode(u.startdatum, u.einddatum) },
          ]}
          acties={(u) => (
            <>
              {(u.einddatum === null || u.einddatum >= vandaag()) && (
                <Button variant="link" onClick={() => setDialoog({ soort: 'overdragen', uitvoerder: u })}>
                  Overdragen<span className="sr-only"> deel van {naamVan(u.medewerker_id)}</span>
                </Button>
              )}
              <Button variant="link" onClick={() => setDialoog({ soort: 'uitvoerder', uitvoerder: u })}>
                Wijzigen<span className="sr-only"> {naamVan(u.medewerker_id)}</span>
              </Button>
              <Button variant="link" onClick={() => setDialoog({ soort: 'uitvoerder-verwijderen', uitvoerder: u })}>
                Verwijderen<span className="sr-only"> {naamVan(u.medewerker_id)}</span>
              </Button>
            </>
          )}
        />
      </Sectie>

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
      {dialoog?.soort === 'uitvoerder' && (
        <UitvoerderFormulier
          taak={taak}
          uitvoerder={dialoog.uitvoerder}
          medewerkers={opNaamGesorteerd}
          onSluiten={sluit}
          onGelukt={herlaad}
        />
      )}
      {dialoog?.soort === 'overdragen' && (
        <OverdragenFormulier
          uitvoerder={dialoog.uitvoerder}
          naam={naamVan(dialoog.uitvoerder.medewerker_id)}
          medewerkers={opNaamGesorteerd.filter((m) => m.actief && m.id !== dialoog.uitvoerder.medewerker_id)}
          onSluiten={sluit}
          onGelukt={herlaad}
        />
      )}
      {dialoog?.soort === 'uitvoerder-verwijderen' && (
        <VerwijderDialoog
          wat="Uitvoerder"
          toelichting="Stopt iemand halverwege het jaar? Geef dan een einddatum of kies Overdragen, zodat de uren naar rato blijven meetellen."
          onVerwijderen={() => verwijder(client, 'taak_uitvoerders', dialoog.uitvoerder.id)}
          onSluiten={sluit}
          onGelukt={herlaad}
        />
      )}
    </Pagina>
  )
}

function UitvoerderFormulier({
  taak,
  uitvoerder,
  medewerkers,
  onSluiten,
  onGelukt,
}: {
  taak: Taak
  uitvoerder: TaakUitvoerder | null
  medewerkers: Medewerker[]
  onSluiten: () => void
  onGelukt: () => void
}) {
  const { client } = useAuth()
  const [medewerker, setMedewerker] = useState(uitvoerder?.medewerker_id ?? '')
  const [uren, setUren] = useState(getalAlsTekst(uitvoerder?.uren_per_jaar))
  const [start, setStart] = useState(uitvoerder?.startdatum ?? taak.startdatum)
  const [eind, setEind] = useState(uitvoerder?.einddatum ?? taak.einddatum ?? '')
  // Een inactieve medewerker die al uitvoerder is, moet kiesbaar blijven.
  const opties = medewerkers.filter((m) => m.actief || m.id === uitvoerder?.medewerker_id)

  function opslaan() {
    const u = leesGetal(uren)
    if (!medewerker) return ongeldig('Kies een medewerker.')
    if (u === null || u < 0) return ongeldig('Vul de ingeschatte uren per jaar in.')
    if (!start) return ongeldig('Kies een startdatum.')
    if (eind && eind < start) return ongeldig('De einddatum ligt vóór de startdatum.')
    return voerUit(
      client,
      'uitvoerder_opslaan',
      {
        p_id: uitvoerder?.id ?? null,
        p_taak_id: taak.id,
        p_medewerker_id: medewerker,
        p_uren_per_jaar: u,
        p_startdatum: start,
        p_einddatum: eind || null,
      },
      { '23P01': 'Deze medewerker voert de taak in die periode al uit.' },
    )
  }

  return (
    <FormulierDialoog
      titel={uitvoerder ? 'Uitvoerder wijzigen' : 'Uitvoerder toevoegen'}
      onOpslaan={opslaan}
      onSluiten={onSluiten}
      onGelukt={onGelukt}
    >
      <SelectField
        label="Medewerker"
        value={medewerker}
        opties={[{ waarde: '', label: 'Kies een medewerker' }, ...opties.map((m) => ({ waarde: m.id, label: m.naam }))]}
        onChange={(e) => setMedewerker(e.target.value)}
      />
      <TextField
        label="Ingeschatte uren per jaar"
        hint="Voor een heel jaar. Bij een kortere periode rekent de app naar rato."
        inputMode="decimal"
        value={uren}
        onChange={(e) => setUren(e.target.value)}
      />
      <TextField label="Startdatum" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      <TextField
        label="Einddatum"
        hint="Leeg laten als de uitvoering doorloopt."
        type="date"
        value={eind}
        onChange={(e) => setEind(e.target.value)}
      />
    </FormulierDialoog>
  )
}

function OverdragenFormulier({
  uitvoerder,
  naam,
  medewerkers,
  onSluiten,
  onGelukt,
}: {
  uitvoerder: TaakUitvoerder
  naam: string
  medewerkers: Medewerker[]
  onSluiten: () => void
  onGelukt: () => void
}) {
  const { client } = useAuth()
  const [naar, setNaar] = useState('')
  const voorstel = vandaag() > uitvoerder.startdatum ? vandaag() : ''
  const [datum, setDatum] = useState(voorstel)

  function opslaan() {
    if (!naar) return ongeldig('Kies de collega die het overneemt.')
    if (!datum) return ongeldig('Kies een ingangsdatum.')
    if (datum <= uitvoerder.startdatum) return ongeldig(`De ingangsdatum moet na ${formatDatum(uitvoerder.startdatum)} liggen.`)
    if (uitvoerder.einddatum && datum > uitvoerder.einddatum)
      return ongeldig(`De ingangsdatum moet uiterlijk ${formatDatum(uitvoerder.einddatum)} zijn.`)
    return voerUit(
      client,
      'taak_overdragen',
      { p_uitvoerder_id: uitvoerder.id, p_naar_medewerker_id: naar, p_datum: datum },
      { '23P01': 'Deze collega voert de taak in die periode al uit. Pas dan de uren van die collega aan.' },
    )
  }

  return (
    <FormulierDialoog titel={`Deel van ${naam} overdragen`} opslaanLabel="Overdragen" onOpslaan={opslaan} onSluiten={onSluiten} onGelukt={onGelukt}>
      <p>
        {naam} stopt op de dag vóór de ingangsdatum. De collega neemt {formatUren(uitvoerder.uren_per_jaar)} uur per jaar
        over{uitvoerder.einddatum ? `, tot en met ${formatDatum(uitvoerder.einddatum)}` : ''}.
      </p>
      <SelectField
        label="Overdragen aan"
        value={naar}
        opties={[{ waarde: '', label: 'Kies een collega' }, ...medewerkers.map((m) => ({ waarde: m.id, label: m.naam }))]}
        onChange={(e) => setNaar(e.target.value)}
      />
      <TextField label="Ingangsdatum" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
    </FormulierDialoog>
  )
}
