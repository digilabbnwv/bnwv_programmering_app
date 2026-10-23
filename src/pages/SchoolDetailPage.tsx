import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'
import { SelectField } from '../components/SelectField'
import { Tabel } from '../components/Tabel'
import { TextField } from '../components/TextField'
import { Pagina } from '../layout/Pagina'
import {
  lees,
  SCHOOLSOORTEN,
  verwijder,
  voerUit,
  type Medewerker,
  type Programma,
  type School,
  type SchoolJaargegevens,
  type StaffelSchijf,
  type Toewijzing,
  type Werkjaar,
} from '../werkbelasting/api'
import { formatUren, staffelUren } from '../werkbelasting/berekening'
import { FormulierDialoog, Gegevens, Laadstatus, ongeldig, Sectie, VerwijderDialoog } from '../werkbelasting/onderdelen'
import { formatDatum, formatPeriode, getalAlsTekst, leesGetal, loopt, opNaam, vandaag } from '../werkbelasting/opmaak'
import { SchoolFormulier } from '../werkbelasting/SchoolFormulier'
import { alles, useGegevens } from '../werkbelasting/useGegevens'

type Dialoog =
  | { soort: 'wijzigen' }
  | { soort: 'verwijderen' }
  | { soort: 'jaar'; gegevens: SchoolJaargegevens | null }
  | { soort: 'toewijzen' }
  | { soort: 'periode'; toewijzing: Toewijzing }
  | { soort: 'toewijzing-verwijderen'; toewijzing: Toewijzing }

export function SchoolDetailPage() {
  const { id = '' } = useParams()
  const { client } = useAuth()
  const navigate = useNavigate()
  const laden = useCallback(
    async () =>
      alles<[School[], SchoolJaargegevens[], Toewijzing[], Medewerker[], StaffelSchijf[], Werkjaar[], Programma[]]>(
        await Promise.all([
          lees<School>(client, 'scholen', 'naam', { kolom: 'id', waarde: id }),
          lees<SchoolJaargegevens>(client, 'school_jaargegevens', 'jaar', { kolom: 'school_id', waarde: id }),
          lees<Toewijzing>(client, 'school_toewijzingen', 'startdatum', { kolom: 'school_id', waarde: id }),
          lees<Medewerker>(client, 'medewerkers', 'naam'),
          lees<StaffelSchijf>(client, 'staffel_schijven', 'min_leerlingen'),
          lees<Werkjaar>(client, 'werkjaren', 'jaar'),
          lees<Programma>(client, 'programmas', 'naam'),
        ]),
      ),
    [client, id],
  )
  const { data, fout, herlaad } = useGegevens(laden)
  const [dialoog, setDialoog] = useState<Dialoog | null>(null)
  const sluit = () => setDialoog(null)

  if (!data) {
    return (
      <Pagina titel="School">
        <Laadstatus fout={fout} />
      </Pagina>
    )
  }

  const [[school], jaargegevens, toewijzingen, medewerkers, staffel, werkjaren, programmas] = data
  if (!school) {
    return (
      <Pagina titel="School niet gevonden">
        <Link to="/scholen" className="font-semibold underline underline-offset-4">
          Terug naar scholen
        </Link>
      </Pagina>
    )
  }

  const naamVan = (medewerkerId: string) => medewerkers.find((m) => m.id === medewerkerId)?.naam ?? 'Onbekend'
  const huidig = toewijzingen.find((t) => loopt(t))
  const historie = [...toewijzingen].sort((a, b) => b.startdatum.localeCompare(a.startdatum))
  const programma = programmas.find((p) => p.id === school.programma_id)
  const adres = [school.adres, [school.postcode, school.plaats].filter(Boolean).join('  ')].filter(Boolean).join(', ')

  return (
    <Pagina titel={school.naam} intro={SCHOOLSOORTEN.find((s) => s.waarde === school.soort)?.label}>
      <p className="mb-8">
        <Link to="/scholen" className="font-semibold underline underline-offset-4 hover:no-underline">
          Alle scholen
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
            ['Status', school.actief ? 'Actief' : 'Inactief'],
            ['Programma', programma?.naam ?? 'Geen'],
            ['BRIN-nummer', school.brin ?? ''],
            ['Adres', adres],
            ['Contactpersoon', school.contactpersoon],
            ['E-mailadres', school.email],
            ['Telefoon', school.telefoon],
            ['Opmerking', school.opmerking ? <span className="whitespace-pre-line">{school.opmerking}</span> : ''],
          ]}
        />
      </Sectie>

      <Sectie
        titel="Medewerker"
        acties={<Button onClick={() => setDialoog({ soort: 'toewijzen' })}>{huidig ? 'Verplaatsen' : 'Toewijzen'}</Button>}
      >
        <p className="mb-4">
          {huidig ? (
            <>
              Nu: <strong>{naamVan(huidig.medewerker_id)}</strong>, sinds {formatDatum(huidig.startdatum)}
            </>
          ) : (
            <strong>Deze school heeft nu geen medewerker.</strong>
          )}
        </p>
        <Tabel
          bijschrift="Historie van medewerkers"
          rijen={historie}
          sleutel={(t) => t.id}
          leeg="Nog nooit toegewezen."
          kolommen={[
            {
              kop: 'Medewerker',
              inhoud: (t) => (
                <Link to={`/medewerkers/${t.medewerker_id}`} className="underline underline-offset-4 hover:no-underline">
                  {naamVan(t.medewerker_id)}
                </Link>
              ),
            },
            { kop: 'Periode', inhoud: (t) => formatPeriode(t.startdatum, t.einddatum) },
          ]}
          acties={(t) => (
            <>
              <Button variant="link" onClick={() => setDialoog({ soort: 'periode', toewijzing: t })}>
                Periode wijzigen
              </Button>
              <Button variant="link" onClick={() => setDialoog({ soort: 'toewijzing-verwijderen', toewijzing: t })}>
                Verwijderen
              </Button>
            </>
          )}
        />
      </Sectie>

      <Sectie
        titel="Leerlingen en uren per jaar"
        acties={
          <Button variant="secundair" onClick={() => setDialoog({ soort: 'jaar', gegevens: null })} disabled={werkjaren.length === 0}>
            Jaar invullen
          </Button>
        }
      >
        {werkjaren.length === 0 && <p className="mb-4">Voeg eerst een jaar toe bij Jaar en staffel.</p>}
        <Tabel
          bijschrift="Leerlingen en uren per jaar"
          rijen={[...jaargegevens].sort((a, b) => b.jaar - a.jaar)}
          sleutel={(g) => String(g.jaar)}
          leeg="Nog geen leerlingaantal ingevuld."
          kolommen={[
            { kop: 'Jaar', inhoud: (g) => g.jaar },
            { kop: 'Leerlingen', inhoud: (g) => g.leerlingaantal, getal: true },
            {
              kop: 'Staffel',
              inhoud: (g) => {
                const n = staffelUren(staffel, g.jaar, school.soort, g.leerlingaantal)
                return n === null ? 'Buiten staffel' : formatUren(n)
              },
              getal: true,
            },
            {
              kop: 'Correctie',
              inhoud: (g) =>
                g.uren_correctie === 0 ? '–' : `${g.uren_correctie > 0 ? '+' : ''}${formatUren(g.uren_correctie)}`,
              getal: true,
            },
            { kop: 'Reden', inhoud: (g) => g.correctie_reden },
            {
              kop: 'Uren per jaar',
              inhoud: (g) => (
                <strong>
                  {formatUren(Math.max(0, (staffelUren(staffel, g.jaar, school.soort, g.leerlingaantal) ?? 0) + g.uren_correctie))}
                </strong>
              ),
              getal: true,
            },
          ]}
          acties={(g) => (
            <Button variant="link" onClick={() => setDialoog({ soort: 'jaar', gegevens: g })}>
              Wijzigen<span className="sr-only"> {g.jaar}</span>
            </Button>
          )}
        />
      </Sectie>

      {dialoog?.soort === 'wijzigen' && (
        <SchoolFormulier school={school} programmas={programmas} onSluiten={sluit} onGelukt={herlaad} />
      )}
      {dialoog?.soort === 'verwijderen' && (
        <VerwijderDialoog
          wat="School"
          toelichting="Een school met een medewerker in de historie kan niet worden verwijderd. Zet hem dan op inactief."
          onVerwijderen={() =>
            verwijder(client, 'scholen', school.id, {
              '23503': 'Deze school heeft een historie van medewerkers. Zet hem op inactief in plaats van verwijderen.',
            })
          }
          onSluiten={sluit}
          onGelukt={() => void navigate('/scholen')}
        />
      )}
      {dialoog?.soort === 'jaar' && (
        <JaargegevensFormulier
          school={school}
          gegevens={dialoog.gegevens}
          werkjaren={werkjaren}
          staffel={staffel}
          onSluiten={sluit}
          onGelukt={herlaad}
        />
      )}
      {dialoog?.soort === 'toewijzen' && (
        <ToewijzenFormulier
          school={school}
          huidig={huidig ?? null}
          medewerkers={medewerkers.filter((m) => m.actief).sort(opNaam)}
          onSluiten={sluit}
          onGelukt={herlaad}
        />
      )}
      {dialoog?.soort === 'periode' && (
        <PeriodeFormulier toewijzing={dialoog.toewijzing} naam={naamVan(dialoog.toewijzing.medewerker_id)} onSluiten={sluit} onGelukt={herlaad} />
      )}
      {dialoog?.soort === 'toewijzing-verwijderen' && (
        <VerwijderDialoog
          wat="Toewijzing"
          toelichting="Gebruik dit alleen voor een vergissing. Bij een overdracht kies je Verplaatsen, zodat de historie blijft kloppen."
          onVerwijderen={() => verwijder(client, 'school_toewijzingen', dialoog.toewijzing.id)}
          onSluiten={sluit}
          onGelukt={herlaad}
        />
      )}
    </Pagina>
  )
}

function JaargegevensFormulier({
  school,
  gegevens,
  werkjaren,
  staffel,
  onSluiten,
  onGelukt,
}: {
  school: School
  gegevens: SchoolJaargegevens | null
  werkjaren: Werkjaar[]
  staffel: StaffelSchijf[]
  onSluiten: () => void
  onGelukt: () => void
}) {
  const { client } = useAuth()
  const ditJaar = new Date().getFullYear()
  const [jaar, setJaar] = useState(
    String(gegevens?.jaar ?? (werkjaren.some((w) => w.jaar === ditJaar) ? ditJaar : (werkjaren.at(-1)?.jaar ?? ditJaar))),
  )
  const [leerlingen, setLeerlingen] = useState(getalAlsTekst(gegevens?.leerlingaantal))
  const [correctie, setCorrectie] = useState(getalAlsTekst(gegevens?.uren_correctie ?? 0))
  const [reden, setReden] = useState(gegevens?.correctie_reden ?? '')

  const aantal = leesGetal(leerlingen)
  const norm = aantal === null ? null : staffelUren(staffel, Number(jaar), school.soort, aantal)

  function opslaan() {
    const c = correctie.trim() === '' ? 0 : leesGetal(correctie)
    if (aantal === null || !Number.isInteger(aantal) || aantal < 0) return ongeldig('Vul het aantal leerlingen in als heel getal.')
    if (c === null) return ongeldig('Vul bij correctie een getal in, bijv. 20 of -10.')
    if (c !== 0 && !reden.trim()) return ongeldig('Geef een reden voor de correctie.')
    return voerUit(client, 'school_jaargegevens_opslaan', {
      p_school_id: school.id,
      p_jaar: Number(jaar),
      p_leerlingaantal: aantal,
      p_uren_correctie: c,
      p_correctie_reden: reden,
    })
  }

  return (
    <FormulierDialoog titel={`Leerlingen en uren – ${school.naam}`} onOpslaan={opslaan} onSluiten={onSluiten} onGelukt={onGelukt}>
      {gegevens ? (
        <p>
          <strong>Jaar:</strong> {gegevens.jaar}
        </p>
      ) : (
        <SelectField
          label="Jaar"
          value={jaar}
          opties={werkjaren.map((w) => ({ waarde: String(w.jaar), label: String(w.jaar) }))}
          onChange={(e) => setJaar(e.target.value)}
        />
      )}
      <TextField label="Aantal leerlingen" inputMode="numeric" value={leerlingen} onChange={(e) => setLeerlingen(e.target.value)} />
      <p role="status" className="text-ui-sm text-neutral-700">
        Volgens de staffel:{' '}
        {aantal === null ? '–' : norm === null ? 'valt buiten de staffel van dit jaar' : `${formatUren(norm)} uur per jaar`}
      </p>
      <TextField
        label="Correctie (uren per jaar)"
        hint="Extra of minder uren bovenop de staffel, bijv. 20 voor een peuterspeelzaal erbij. Negatief mag."
        inputMode="decimal"
        value={correctie}
        onChange={(e) => setCorrectie(e.target.value)}
      />
      <TextField label="Reden van de correctie" maxLength={300} value={reden} onChange={(e) => setReden(e.target.value)} />
    </FormulierDialoog>
  )
}

function ToewijzenFormulier({
  school,
  huidig,
  medewerkers,
  onSluiten,
  onGelukt,
}: {
  school: School
  huidig: Toewijzing | null
  medewerkers: Medewerker[]
  onSluiten: () => void
  onGelukt: () => void
}) {
  const { client } = useAuth()
  const [medewerker, setMedewerker] = useState('')
  const [startdatum, setStartdatum] = useState(vandaag())

  function opslaan() {
    if (!startdatum) return ongeldig('Kies een ingangsdatum.')
    if (!medewerker && !huidig) return ongeldig('Kies een medewerker.')
    if (huidig && medewerker === huidig.medewerker_id) return ongeldig('Deze medewerker heeft de school al.')
    return voerUit(
      client,
      'school_toewijzen',
      { p_school_id: school.id, p_medewerker_id: medewerker || null, p_startdatum: startdatum },
      { '23P01': 'Er is al een toewijzing die op of na deze datum begint. Pas die eerst aan.' },
    )
  }

  return (
    <FormulierDialoog
      titel={huidig ? `${school.naam} verplaatsen` : `${school.naam} toewijzen`}
      opslaanLabel={huidig ? 'Verplaatsen' : 'Toewijzen'}
      onOpslaan={opslaan}
      onSluiten={onSluiten}
      onGelukt={onGelukt}
    >
      {huidig && (
        <p>
          De huidige toewijzing stopt op de dag vóór de ingangsdatum. De uren worden naar rato over beide medewerkers verdeeld.
        </p>
      )}
      <SelectField
        label="Medewerker"
        value={medewerker}
        opties={[
          { waarde: '', label: huidig ? 'Niemand (school loskoppelen)' : 'Kies een medewerker' },
          ...medewerkers.map((m) => ({ waarde: m.id, label: m.naam })),
        ]}
        onChange={(e) => setMedewerker(e.target.value)}
      />
      <TextField label="Ingangsdatum" type="date" value={startdatum} onChange={(e) => setStartdatum(e.target.value)} />
    </FormulierDialoog>
  )
}

function PeriodeFormulier({
  toewijzing,
  naam,
  onSluiten,
  onGelukt,
}: {
  toewijzing: Toewijzing
  naam: string
  onSluiten: () => void
  onGelukt: () => void
}) {
  const { client } = useAuth()
  const [start, setStart] = useState(toewijzing.startdatum)
  const [eind, setEind] = useState(toewijzing.einddatum ?? '')

  function opslaan() {
    if (!start) return ongeldig('Kies een startdatum.')
    if (eind && eind < start) return ongeldig('De einddatum ligt vóór de startdatum.')
    return voerUit(
      client,
      'toewijzing_wijzigen',
      { p_id: toewijzing.id, p_startdatum: start, p_einddatum: eind || null },
      { '23P01': 'Deze periode overlapt met die van een andere medewerker.' },
    )
  }

  return (
    <FormulierDialoog titel={`Periode van ${naam}`} onOpslaan={opslaan} onSluiten={onSluiten} onGelukt={onGelukt}>
      <TextField label="Startdatum" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      <TextField
        label="Einddatum"
        hint="Laatste dag. Leeg laten als de toewijzing doorloopt."
        type="date"
        value={eind}
        onChange={(e) => setEind(e.target.value)}
      />
    </FormulierDialoog>
  )
}
