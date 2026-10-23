import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'
import { SelectField } from '../components/SelectField'
import { Tabel } from '../components/Tabel'
import { TextField } from '../components/TextField'
import { Pagina } from '../layout/Pagina'
import { lees, verwijder, voerUit, type Deelnemer, type Medewerker, type Projectgroep } from '../werkbelasting/api'
import { formatUren } from '../werkbelasting/berekening'
import { FormulierDialoog, Gegevens, Laadstatus, ongeldig, Sectie, VerwijderDialoog } from '../werkbelasting/onderdelen'
import { formatPeriode, getalAlsTekst, leesGetal, loopt, opNaam } from '../werkbelasting/opmaak'
import { ProjectgroepFormulier } from '../werkbelasting/ProjectgroepFormulier'
import { alles, useGegevens } from '../werkbelasting/useGegevens'

type Dialoog =
  | { soort: 'wijzigen' }
  | { soort: 'verwijderen' }
  | { soort: 'deelnemer'; deelnemer: Deelnemer | null }
  | { soort: 'deelnemer-verwijderen'; deelnemer: Deelnemer }

export function ProjectgroepDetailPage() {
  const { id = '' } = useParams()
  const { client } = useAuth()
  const navigate = useNavigate()
  const laden = useCallback(
    async () =>
      alles<[Projectgroep[], Deelnemer[], Medewerker[]]>(
        await Promise.all([
          lees<Projectgroep>(client, 'projectgroepen', 'naam', { kolom: 'id', waarde: id }),
          lees<Deelnemer>(client, 'projectgroep_deelnemers', 'startdatum', { kolom: 'projectgroep_id', waarde: id }),
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
      <Pagina titel="Projectgroep">
        <Laadstatus fout={fout} />
      </Pagina>
    )
  }

  const [[projectgroep], deelnemers, medewerkers] = data
  if (!projectgroep) {
    return (
      <Pagina titel="Projectgroep niet gevonden">
        <Link to="/projectgroepen" className="font-semibold underline underline-offset-4">
          Terug naar projectgroepen
        </Link>
      </Pagina>
    )
  }

  const naamVan = (medewerkerId: string | null) => medewerkers.find((m) => m.id === medewerkerId)?.naam ?? ''
  const opNaamGesorteerd = [...medewerkers].sort(opNaam)
  const gesorteerd = [...deelnemers].sort((a, b) => naamVan(a.medewerker_id).localeCompare(naamVan(b.medewerker_id), 'nl'))
  const urenNu = deelnemers.filter((d) => loopt(d)).reduce((som, d) => som + d.uren_per_jaar, 0)

  return (
    <Pagina titel={projectgroep.naam} intro={projectgroep.omschrijving || undefined}>
      <p className="mb-8">
        <Link to="/projectgroepen" className="font-semibold underline underline-offset-4 hover:no-underline">
          Alle projectgroepen
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
            ['Periode', formatPeriode(projectgroep.startdatum, projectgroep.einddatum)],
            ['Trekker', naamVan(projectgroep.trekker_id) || 'Geen'],
            ['Uren per jaar nu', `${formatUren(urenNu)} (alle huidige deelnemers samen)`],
          ]}
        />
      </Sectie>

      <Sectie
        titel="Deelnemers"
        acties={<Button onClick={() => setDialoog({ soort: 'deelnemer', deelnemer: null })}>Deelnemer toevoegen</Button>}
      >
        <Tabel
          bijschrift="Deelnemers"
          rijen={gesorteerd}
          sleutel={(d) => d.id}
          leeg="Nog geen deelnemers."
          kolommen={[
            {
              kop: 'Medewerker',
              inhoud: (d) => (
                <Link to={`/medewerkers/${d.medewerker_id}`} className="underline underline-offset-4 hover:no-underline">
                  {naamVan(d.medewerker_id)}
                </Link>
              ),
            },
            { kop: 'Uren per jaar', inhoud: (d) => formatUren(d.uren_per_jaar), getal: true },
            { kop: 'Periode', inhoud: (d) => formatPeriode(d.startdatum, d.einddatum) },
          ]}
          acties={(d) => (
            <>
              <Button variant="link" onClick={() => setDialoog({ soort: 'deelnemer', deelnemer: d })}>
                Wijzigen<span className="sr-only"> {naamVan(d.medewerker_id)}</span>
              </Button>
              <Button variant="link" onClick={() => setDialoog({ soort: 'deelnemer-verwijderen', deelnemer: d })}>
                Verwijderen<span className="sr-only"> {naamVan(d.medewerker_id)}</span>
              </Button>
            </>
          )}
        />
      </Sectie>

      {dialoog?.soort === 'wijzigen' && (
        <ProjectgroepFormulier projectgroep={projectgroep} medewerkers={opNaamGesorteerd} onSluiten={sluit} onGelukt={herlaad} />
      )}
      {dialoog?.soort === 'verwijderen' && (
        <VerwijderDialoog
          wat="Projectgroep"
          toelichting="De deelnemers worden ook verwijderd. Wil je de historie bewaren, geef de projectgroep dan een einddatum."
          onVerwijderen={() => verwijder(client, 'projectgroepen', projectgroep.id)}
          onSluiten={sluit}
          onGelukt={() => void navigate('/projectgroepen')}
        />
      )}
      {dialoog?.soort === 'deelnemer' && (
        <DeelnemerFormulier
          projectgroep={projectgroep}
          deelnemer={dialoog.deelnemer}
          medewerkers={opNaamGesorteerd}
          onSluiten={sluit}
          onGelukt={herlaad}
        />
      )}
      {dialoog?.soort === 'deelnemer-verwijderen' && (
        <VerwijderDialoog
          wat="Deelnemer"
          toelichting="Stopt iemand halverwege het jaar? Geef dan een einddatum, zodat de uren naar rato blijven meetellen."
          onVerwijderen={() => verwijder(client, 'projectgroep_deelnemers', dialoog.deelnemer.id)}
          onSluiten={sluit}
          onGelukt={herlaad}
        />
      )}
    </Pagina>
  )
}

function DeelnemerFormulier({
  projectgroep,
  deelnemer,
  medewerkers,
  onSluiten,
  onGelukt,
}: {
  projectgroep: Projectgroep
  deelnemer: Deelnemer | null
  medewerkers: Medewerker[]
  onSluiten: () => void
  onGelukt: () => void
}) {
  const { client } = useAuth()
  const [medewerker, setMedewerker] = useState(deelnemer?.medewerker_id ?? '')
  const [uren, setUren] = useState(getalAlsTekst(deelnemer?.uren_per_jaar))
  const [start, setStart] = useState(deelnemer?.startdatum ?? projectgroep.startdatum)
  const [eind, setEind] = useState(deelnemer?.einddatum ?? projectgroep.einddatum ?? '')

  // Een inactieve medewerker die al deelnemer is, moet kiesbaar blijven.
  const opties = medewerkers.filter((m) => m.actief || m.id === deelnemer?.medewerker_id)

  function opslaan() {
    const u = leesGetal(uren)
    if (!medewerker) return ongeldig('Kies een medewerker.')
    if (u === null || u < 0) return ongeldig('Vul het aantal uren per jaar in.')
    if (!start) return ongeldig('Kies een startdatum.')
    if (eind && eind < start) return ongeldig('De einddatum ligt vóór de startdatum.')
    return voerUit(
      client,
      'deelnemer_opslaan',
      {
        p_id: deelnemer?.id ?? null,
        p_projectgroep_id: projectgroep.id,
        p_medewerker_id: medewerker,
        p_uren_per_jaar: u,
        p_startdatum: start,
        p_einddatum: eind || null,
      },
      { '23P01': 'Deze medewerker doet in die periode al mee aan deze projectgroep.' },
    )
  }

  return (
    <FormulierDialoog
      titel={deelnemer ? 'Deelnemer wijzigen' : 'Deelnemer toevoegen'}
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
        label="Uren per jaar"
        hint="Voor een heel jaar. Bij een kortere periode rekent de app naar rato."
        inputMode="decimal"
        value={uren}
        onChange={(e) => setUren(e.target.value)}
      />
      <TextField label="Startdatum" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      <TextField
        label="Einddatum"
        hint="Leeg laten als de deelname doorloopt."
        type="date"
        value={eind}
        onChange={(e) => setEind(e.target.value)}
      />
    </FormulierDialoog>
  )
}
