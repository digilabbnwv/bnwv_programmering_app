import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'
import { Selectievakje } from '../components/Selectievakje'
import { SelectField } from '../components/SelectField'
import { Tabel } from '../components/Tabel'
import { TextField } from '../components/TextField'
import { Pagina } from '../layout/Pagina'
import {
  lees,
  SCHOOLSOORTEN,
  type Medewerker,
  type Programma,
  type School,
  type SchoolJaargegevens,
  type StaffelSchijf,
  type Toewijzing,
} from '../werkbelasting/api'
import { formatUren, staffelUren } from '../werkbelasting/berekening'
import { Laadstatus } from '../werkbelasting/onderdelen'
import { loopt, opNaam } from '../werkbelasting/opmaak'
import { SchoolFormulier } from '../werkbelasting/SchoolFormulier'
import { alles, useGegevens } from '../werkbelasting/useGegevens'

/** Overzicht van scholen met de huidige medewerker en de uren van dit jaar (werkbelasting.beheren). */
export function ScholenPage() {
  const { client } = useAuth()
  const navigate = useNavigate()
  const jaar = new Date().getFullYear()
  const laden = useCallback(
    async () =>
      alles<[School[], Toewijzing[], Medewerker[], SchoolJaargegevens[], StaffelSchijf[], Programma[]]>(
        await Promise.all([
          lees<School>(client, 'scholen', 'naam'),
          lees<Toewijzing>(client, 'school_toewijzingen', 'startdatum'),
          lees<Medewerker>(client, 'medewerkers', 'naam'),
          lees<SchoolJaargegevens>(client, 'school_jaargegevens', 'jaar', { kolom: 'jaar', waarde: jaar }),
          lees<StaffelSchijf>(client, 'staffel_schijven', 'min_leerlingen', { kolom: 'jaar', waarde: jaar }),
          lees<Programma>(client, 'programmas', 'naam'),
        ]),
      ),
    [client, jaar],
  )
  const { data, fout } = useGegevens(laden)
  const [zoek, setZoek] = useState('')
  const [soort, setSoort] = useState('')
  const [ookInactief, setOokInactief] = useState(false)
  const [nieuw, setNieuw] = useState(false)

  if (!data) {
    return (
      <Pagina titel="Scholen">
        <Laadstatus fout={fout} />
      </Pagina>
    )
  }

  const [scholen, toewijzingen, medewerkers, jaargegevens, staffel, programmas] = data
  const medewerkerVan = (schoolId: string) => {
    const t = toewijzingen.find((t) => t.school_id === schoolId && loopt(t))
    return t ? medewerkers.find((m) => m.id === t.medewerker_id) : undefined
  }
  const urenVan = (s: School) => {
    const g = jaargegevens.find((g) => g.school_id === s.id)
    if (!g) return null
    const norm = staffelUren(staffel, jaar, s.soort, g.leerlingaantal)
    return { leerlingen: g.leerlingaantal, uren: norm === null ? null : Math.max(0, norm + g.uren_correctie) }
  }

  const zichtbaar = scholen
    .filter((s) => ookInactief || s.actief)
    .filter((s) => !soort || s.soort === soort)
    .filter((s) => `${s.naam} ${s.plaats}`.toLowerCase().includes(zoek.trim().toLowerCase()))
    .sort(opNaam)
  const zonderMedewerker = scholen.filter((s) => s.actief && !medewerkerVan(s.id)).length

  return (
    <Pagina titel="Scholen" intro={`Scholen met hun medewerker en de uren voor ${jaar} volgens de staffel.`}>
      <div className="mb-6">
        <Button onClick={() => setNieuw(true)}>Nieuwe school</Button>
      </div>

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
          { kop: `Leerlingen ${jaar}`, inhoud: (s) => urenVan(s)?.leerlingen ?? '–', getal: true },
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
