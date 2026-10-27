import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'
import { Melding } from '../components/Melding'
import { Selectievakje } from '../components/Selectievakje'
import { SelectField } from '../components/SelectField'
import { Tabel } from '../components/Tabel'
import { TextField } from '../components/TextField'
import { Pagina } from '../layout/Pagina'
import {
  lees,
  SCHOOLSOORTEN,
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
import { FormulierDialoog, Laadstatus, Overgenomen } from '../werkbelasting/onderdelen'
import { loopt, opNaam } from '../werkbelasting/opmaak'
import { SchoolFormulier } from '../werkbelasting/SchoolFormulier'
import { alles, useGegevens } from '../werkbelasting/useGegevens'

/**
 * Overzicht van scholen met de huidige medewerker en de uren van het gekozen
 * jaar (werkbelasting.beheren). Voor een nieuw jaar kun je de leerlingaantallen
 * van het jaar ervoor in één keer overnemen.
 */
export function ScholenPage() {
  const { client } = useAuth()
  const navigate = useNavigate()
  const laden = useCallback(
    async () =>
      alles<[School[], Toewijzing[], Medewerker[], SchoolJaargegevens[], StaffelSchijf[], Programma[], Werkjaar[]]>(
        await Promise.all([
          lees<School>(client, 'scholen', 'naam'),
          lees<Toewijzing>(client, 'school_toewijzingen', 'startdatum'),
          lees<Medewerker>(client, 'medewerkers', 'naam'),
          lees<SchoolJaargegevens>(client, 'school_jaargegevens', 'jaar'),
          lees<StaffelSchijf>(client, 'staffel_schijven', 'min_leerlingen'),
          lees<Programma>(client, 'programmas', 'naam'),
          lees<Werkjaar>(client, 'werkjaren', 'jaar'),
        ]),
      ),
    [client],
  )
  const { data, fout, herlaad } = useGegevens(laden)
  const [gekozenJaar, setGekozenJaar] = useState<number | null>(null)
  const [zoek, setZoek] = useState('')
  const [soort, setSoort] = useState('')
  const [ookInactief, setOokInactief] = useState(false)
  const [nieuw, setNieuw] = useState(false)
  const [overnemen, setOvernemen] = useState(false)
  const [resultaat, setResultaat] = useState<string | null>(null)

  if (!data) {
    return (
      <Pagina titel="Scholen">
        <Laadstatus fout={fout} />
      </Pagina>
    )
  }

  const [scholen, toewijzingen, medewerkers, alleJaargegevens, alleStaffel, programmas, werkjaren] = data
  const ditJaar = new Date().getFullYear()
  const jaar = gekozenJaar ?? (werkjaren.some((w) => w.jaar === ditJaar) ? ditJaar : (werkjaren.at(-1)?.jaar ?? ditJaar))
  const jaargegevens = alleJaargegevens.filter((g) => g.jaar === jaar)
  const staffel = alleStaffel.filter((s) => s.jaar === jaar)
  // Actieve scholen die dit jaar nog geen aantal hebben, maar vorig jaar wel.
  const teOvernemen = scholen.filter(
    (s) =>
      s.actief &&
      !jaargegevens.some((g) => g.school_id === s.id) &&
      alleJaargegevens.some((g) => g.school_id === s.id && g.jaar === jaar - 1),
  )
  const alIngevuld = scholen.filter((s) => s.actief && jaargegevens.some((g) => g.school_id === s.id)).length
  const nogOvergenomen = jaargegevens.filter((g) => g.overgenomen).length
  const laatsteJaar = werkjaren.at(-1)?.jaar
  const medewerkerVan = (schoolId: string) => {
    const t = toewijzingen.find((t) => t.school_id === schoolId && loopt(t))
    return t ? medewerkers.find((m) => m.id === t.medewerker_id) : undefined
  }
  const urenVan = (s: School) => {
    const g = jaargegevens.find((g) => g.school_id === s.id)
    if (!g) return null
    const norm = staffelUren(staffel, jaar, s.soort, g.leerlingaantal)
    return {
      leerlingen: g.leerlingaantal,
      overgenomen: g.overgenomen,
      uren: norm === null ? null : Math.max(0, norm + g.uren_correctie),
    }
  }

  const zichtbaar = scholen
    .filter((s) => ookInactief || s.actief)
    .filter((s) => !soort || s.soort === soort)
    .filter((s) => `${s.naam} ${s.plaats}`.toLowerCase().includes(zoek.trim().toLowerCase()))
    .sort(opNaam)
  const zonderMedewerker = scholen.filter((s) => s.actief && !medewerkerVan(s.id)).length

  return (
    <Pagina titel="Scholen" intro={`Scholen met hun medewerker en de uren voor ${jaar} volgens de staffel.`}>
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <Button onClick={() => setNieuw(true)}>Nieuwe school</Button>
        {werkjaren.length > 0 && (
          <SelectField
            label="Jaar"
            value={String(jaar)}
            opties={werkjaren.map((w) => ({ waarde: String(w.jaar), label: String(w.jaar) }))}
            onChange={(e) => {
              setGekozenJaar(Number(e.target.value))
              setResultaat(null)
            }}
            className="w-40"
          />
        )}
        {teOvernemen.length > 0 && werkjaren.some((w) => w.jaar === jaar) && (
          <Button variant="secundair" onClick={() => setOvernemen(true)}>
            Leerlingaantallen van {jaar - 1} overnemen
          </Button>
        )}
      </div>

      {resultaat && (
        <div className="mb-6">
          <Melding soort="info">{resultaat}</Melding>
        </div>
      )}
      {laatsteJaar === jaar && (
        <p className="mb-6 max-w-prose text-ui-sm text-neutral-700">
          Wil je {jaar + 1} voorbereiden? Voeg het jaar eerst toe bij{' '}
          <Link to="/staffel" className="font-semibold underline underline-offset-4 hover:no-underline">
            Jaar en staffel
          </Link>
          . Daarna kun je hier de leerlingaantallen van {jaar} overnemen.
        </p>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-[1fr_16rem] md:grid-cols-[1fr_16rem_auto] md:items-end">
        <TextField label="Zoeken" type="search" value={zoek} onChange={(e) => setZoek(e.target.value)} hint="Op naam of plaats." />
        <SelectField
          label="Soort"
          value={soort}
          opties={[{ waarde: '', label: 'Alle soorten' }, ...SCHOOLSOORTEN.map((s) => ({ waarde: s.waarde, label: s.label }))]}
          onChange={(e) => setSoort(e.target.value)}
        />
        <Selectievakje label="Ook inactieve scholen" checked={ookInactief} onChange={(e) => setOokInactief(e.target.checked)} className="md:pb-3" />
      </div>

      <p role="status" className="mb-4 text-ui-sm text-neutral-700">
        {zichtbaar.length} van {scholen.length} scholen
        {nogOvergenomen > 0 &&
          ` · ${nogOvergenomen} ${nogOvergenomen === 1 ? 'aantal' : 'aantallen'} overgenomen van ${jaar - 1}, nog niet bijgewerkt`}
        {zonderMedewerker > 0 && ` · ${zonderMedewerker} actieve ${zonderMedewerker === 1 ? 'school' : 'scholen'} zonder medewerker`}
      </p>

      <Tabel
        bijschrift="Scholen"
        rijen={zichtbaar}
        sleutel={(s) => s.id}
        leeg={scholen.length === 0 ? 'Er zijn nog geen scholen.' : 'Geen scholen gevonden.'}
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
          {
            kop: `Leerlingen ${jaar}`,
            inhoud: (s) => {
              const u = urenVan(s)
              if (!u) return '–'
              return (
                <>
                  {u.leerlingen}
                  {u.overgenomen && <Overgenomen jaar={jaar - 1} />}
                </>
              )
            },
            getal: true,
          },
          {
            kop: `Uren ${jaar}`,
            inhoud: (s) => {
              const u = urenVan(s)
              if (!u) return '–'
              return u.uren === null ? 'Buiten staffel' : formatUren(u.uren)
            },
            getal: true,
          },
          { kop: 'Status', inhoud: (s) => (s.actief ? 'Actief' : 'Inactief') },
        ]}
      />

      {overnemen && (
        <OvernemenFormulier
          jaar={jaar}
          aantal={teOvernemen.length}
          alIngevuld={alIngevuld}
          onSluiten={() => setOvernemen(false)}
          onGelukt={(n) => {
            setResultaat(
              `${n === 1 ? '1 school heeft' : `${n} scholen hebben`} het leerlingaantal van ${jaar - 1} gekregen. Werk de aantallen bij zodra de echte aantallen bekend zijn.`,
            )
            herlaad()
          }}
        />
      )}
      {nieuw && (
        <SchoolFormulier
          school={null}
          programmas={programmas}
          onSluiten={() => setNieuw(false)}
          onGelukt={(id) => void navigate(`/scholen/${id}`)}
        />
      )}
    </Pagina>
  )
}

function OvernemenFormulier({
  jaar,
  aantal,
  alIngevuld,
  onSluiten,
  onGelukt,
}: {
  jaar: number
  aantal: number
  alIngevuld: number
  onSluiten: () => void
  onGelukt: (aantal: number) => void
}) {
  const { client } = useAuth()
  const [metCorrectie, setMetCorrectie] = useState(true)

  async function opslaan() {
    const res = await voerUit<number>(
      client,
      'school_jaargegevens_overnemen',
      { p_van: jaar - 1, p_naar: jaar, p_met_correctie: metCorrectie },
      { '23503': `Het jaar ${jaar} bestaat niet. Voeg het eerst toe bij Jaar en staffel.` },
    )
    if (res.ok) onGelukt(res.data)
    return res
  }

  return (
    <FormulierDialoog
      titel={`Leerlingaantallen van ${jaar - 1} overnemen`}
      opslaanLabel="Overnemen"
      onOpslaan={opslaan}
      onSluiten={onSluiten}
      onGelukt={() => undefined}
    >
      <p>
        {aantal === 1 ? '1 actieve school krijgt' : `${aantal} actieve scholen krijgen`} voor {jaar} het leerlingaantal van{' '}
        {jaar - 1}.
        {alIngevuld > 0 &&
          ` ${alIngevuld === 1 ? '1 school heeft' : `${alIngevuld} scholen hebben`} al gegevens voor ${jaar} en ${alIngevuld === 1 ? 'blijft' : 'blijven'} zoals ze zijn.`}
      </p>
      <p className="text-ui-sm text-neutral-700">
        De overgenomen aantallen krijgen het label “overgenomen” tot je ze bij de school bijwerkt.
      </p>
      <Selectievakje
        label="Ook de urencorrectie overnemen (bijv. “inclusief PSZ”)"
        checked={metCorrectie}
        onChange={(e) => setMetCorrectie(e.target.checked)}
      />
    </FormulierDialoog>
  )
}
