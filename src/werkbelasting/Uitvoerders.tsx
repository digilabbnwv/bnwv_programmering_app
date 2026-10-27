import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'
import { SelectField } from '../components/SelectField'
import { Tabel } from '../components/Tabel'
import { TextField } from '../components/TextField'
import { verwijder, voerUit, type Medewerker } from './api'
import { formatUren } from './berekening'
import { FormulierDialoog, ongeldig, Sectie, VerwijderDialoog } from './onderdelen'
import { formatDatum, formatPeriode, getalAlsTekst, leesGetal, opNaam, vandaag } from './opmaak'

/**
 * Uitvoerders tonen, toevoegen, wijzigen, overdragen en verwijderen. Hetzelfde
 * voor overige taken en programma's met vaste uitvoerders; alleen de tabel en
 * de databasefuncties verschillen.
 */

export interface Uitvoering {
  id: string
  medewerker_id: string
  uren_per_jaar: number
  startdatum: string
  einddatum: string | null
}

/** Waar de uitvoerder bij hoort. Een taak heeft een eigen periode, een programma niet. */
export type Ouder =
  | { soort: 'taak'; id: string; startdatum: string; einddatum: string | null }
  | { soort: 'programma'; id: string }

const FUNCTIES = {
  taak: {
    tabel: 'taak_uitvoerders',
    opslaan: 'uitvoerder_opslaan',
    ouder: 'p_taak_id',
    overdragen: 'taak_overdragen',
    wat: 'de taak',
  },
  programma: {
    tabel: 'programma_uitvoerders',
    opslaan: 'programma_uitvoerder_opslaan',
    ouder: 'p_programma_id',
    overdragen: 'programma_overdragen',
    wat: 'het programma',
  },
} as const

type Dialoog =
  | { soort: 'uitvoerder'; uitvoerder: Uitvoering | null }
  | { soort: 'overdragen'; uitvoerder: Uitvoering }
  | { soort: 'verwijderen'; uitvoerder: Uitvoering }

export function UitvoerdersSectie({
  ouder,
  uitvoerders,
  medewerkers,
  onGewijzigd,
}: {
  ouder: Ouder
  uitvoerders: readonly Uitvoering[]
  medewerkers: readonly Medewerker[]
  onGewijzigd: () => void
}) {
  const { client } = useAuth()
  const [dialoog, setDialoog] = useState<Dialoog | null>(null)
  const sluit = () => setDialoog(null)
  const functies = FUNCTIES[ouder.soort]

  const naamVan = (medewerkerId: string) => medewerkers.find((m) => m.id === medewerkerId)?.naam ?? 'Onbekend'
  const opNaamGesorteerd = [...medewerkers].sort(opNaam)
  const gesorteerd = [...uitvoerders].sort(
    (a, b) => naamVan(a.medewerker_id).localeCompare(naamVan(b.medewerker_id), 'nl') || a.startdatum.localeCompare(b.startdatum),
  )

  return (
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
        leeg={`Nog niemand voert ${functies.wat} uit.`}
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
            <Button variant="link" onClick={() => setDialoog({ soort: 'verwijderen', uitvoerder: u })}>
              Verwijderen<span className="sr-only"> {naamVan(u.medewerker_id)}</span>
            </Button>
          </>
        )}
      />

      {dialoog?.soort === 'uitvoerder' && (
        <UitvoerderFormulier
          ouder={ouder}
          uitvoerder={dialoog.uitvoerder}
          medewerkers={opNaamGesorteerd}
          onSluiten={sluit}
          onGelukt={onGewijzigd}
        />
      )}
      {dialoog?.soort === 'overdragen' && (
        <OverdragenFormulier
          soort={ouder.soort}
          uitvoerder={dialoog.uitvoerder}
          naam={naamVan(dialoog.uitvoerder.medewerker_id)}
          medewerkers={opNaamGesorteerd.filter((m) => m.actief && m.id !== dialoog.uitvoerder.medewerker_id)}
          onSluiten={sluit}
          onGelukt={onGewijzigd}
        />
      )}
      {dialoog?.soort === 'verwijderen' && (
        <VerwijderDialoog
          wat="Uitvoerder"
          toelichting="Stopt iemand halverwege het jaar? Geef dan een einddatum of kies Overdragen, zodat de uren naar rato blijven meetellen."
          onVerwijderen={() => verwijder(client, functies.tabel, dialoog.uitvoerder.id)}
          onSluiten={sluit}
          onGelukt={onGewijzigd}
        />
      )}
    </Sectie>
  )
}

function UitvoerderFormulier({
  ouder,
  uitvoerder,
  medewerkers,
  onSluiten,
  onGelukt,
}: {
  ouder: Ouder
  uitvoerder: Uitvoering | null
  medewerkers: Medewerker[]
  onSluiten: () => void
  onGelukt: () => void
}) {
  const { client } = useAuth()
  const functies = FUNCTIES[ouder.soort]
  const [medewerker, setMedewerker] = useState(uitvoerder?.medewerker_id ?? '')
  const [uren, setUren] = useState(getalAlsTekst(uitvoerder?.uren_per_jaar))
  const [start, setStart] = useState(uitvoerder?.startdatum ?? (ouder.soort === 'taak' ? ouder.startdatum : vandaag()))
  const [eind, setEind] = useState(uitvoerder?.einddatum ?? (ouder.soort === 'taak' ? ouder.einddatum : null) ?? '')
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
      functies.opslaan,
      {
        p_id: uitvoerder?.id ?? null,
        [functies.ouder]: ouder.id,
        p_medewerker_id: medewerker,
        p_uren_per_jaar: u,
        p_startdatum: start,
        p_einddatum: eind || null,
      },
      { '23P01': `Deze medewerker voert ${functies.wat} in die periode al uit.` },
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
  soort,
  uitvoerder,
  naam,
  medewerkers,
  onSluiten,
  onGelukt,
}: {
  soort: Ouder['soort']
  uitvoerder: Uitvoering
  naam: string
  medewerkers: Medewerker[]
  onSluiten: () => void
  onGelukt: () => void
}) {
  const { client } = useAuth()
  const functies = FUNCTIES[soort]
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
      functies.overdragen,
      { p_uitvoerder_id: uitvoerder.id, p_naar_medewerker_id: naar, p_datum: datum },
      { '23P01': `Deze collega voert ${functies.wat} in die periode al uit. Pas dan de uren van die collega aan.` },
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
