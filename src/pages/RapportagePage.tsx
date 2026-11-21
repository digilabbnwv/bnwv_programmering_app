import { useCallback, useId, useState } from 'react'
import { Navigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'
import { Kengetal, Kengetallen } from '../components/Kengetal'
import { Laadstatus, Melding } from '../components/Melding'
import { SelectField } from '../components/SelectField'
import { Tabel, type Kolom } from '../components/Tabel'
import { TextField } from '../components/TextField'
import { Blok, Sectie } from '../components/Sectie'
import { Tekstlink } from '../components/Tekstlink'
import { AndereJaren, useJaar } from '../layout/JaarProvider'
import { Pagina } from '../layout/Pagina'
import { PAGINAS } from '../layout/paginas'
import { Tabbladen, useTabblad } from '../layout/Tabbladen'
import { formatPercentage, formatPerWeek, formatUren, perWeek, type ProgrammaRef, type Werkbelasting } from '../werkbelasting/berekening'
import {
  filterRijen,
  laadRapportage,
  teamProgrammas,
  teamRijen,
  teamSignalen,
  type Rij,
  type Rijfilter,
} from '../werkbelasting/rapportage'
import { TeamBalken } from '../werkbelasting/grafieken'
import { opNaam } from '../werkbelasting/opmaak'
import { signaalTekst, teamsignaalTekst } from '../werkbelasting/signalen'
import { useGegevens } from '../werkbelasting/useGegevens'

/**
 * Het teamoverzicht (werkbelasting.bekijken): de werkbelasting van het hele
 * team in het gekozen jaar. Bovenaan de kengetallen, daaronder drie
 * tabbladen: signalen, per medewerker en per programma. Het jaar komt uit de
 * jaarkeuze in de kopbalk (layout/JaarProvider.tsx).
 */
export function TeamoverzichtPage() {
  const tabbladen = PAGINAS.teamoverzicht.tabbladen
  const tab = useTabblad(tabbladen)
  const { jaar } = useJaar()
  const { client } = useAuth()
  const laden = useCallback(async () => {
    const res = await laadRapportage(client, jaar)
    return res.ok ? { ok: true as const, data: { jaar, gegevens: res.data } } : res
  }, [client, jaar])
  const { data, fout } = useGegevens(laden)
  const gegevens = data?.jaar === jaar ? data.gegevens : null

  if (tab === null) return <Navigate to=".." relative="path" replace />
  if (!gegevens) {
    return (
      <Pagina breedte="breed" titel="Teamoverzicht">
        <Laadstatus fout={fout} />
      </Pagina>
    )
  }

  const werkjaar = gegevens.werkjaren.find((w) => w.jaar === jaar)
  if (!werkjaar) {
    return (
      <Pagina breedte="breed" titel="Teamoverzicht">
        <p>Voor {jaar} zijn nog geen jaarinstellingen vastgelegd.</p>
        <AndereJaren jaren={gegevens.werkjaren.map((w) => w.jaar)} />
      </Pagina>
    )
  }

  const rijen = teamRijen(gegevens, werkjaar)
  const team = teamSignalen(gegevens, jaar)
  const aantalSignalen = team.length + rijen.reduce((s, r) => s + r.werkbelasting.signalen.length + (r.gewijzigdNaVaststellen ? 1 : 0), 0)

  return (
    <Pagina
      breedte="breed"
      titel="Teamoverzicht"
      intro={`De werkbelasting van het hele team in ${jaar}. Percentages zijn ten opzichte van de contracturen.`}
      acties={
        <Button variant="secundair" onClick={() => window.print()}>
          Afdrukken
        </Button>
      }
    >
      <Teamkengetallen rijen={rijen} />
      <Tabbladen tabbladen={tabbladen} actief={tab} tellers={{ '': aantalSignalen }} />
      {tab === '' && <Aandachtspunten team={team} rijen={rijen} jaar={jaar} />}
      {tab === 'medewerkers' && (
        <PerMedewerker
          rijen={rijen}
          jaar={jaar}
          programmas={teamProgrammas(rijen).map((p) => p.programma)}
          metSignaal={rijen.filter((r) => r.werkbelasting.signalen.length > 0 || r.gewijzigdNaVaststellen).length}
        />
      )}
      {tab === 'programmas' && <PerProgramma rijen={rijen} jaar={jaar} />}
    </Pagina>
  )
}

/** De werkurenverdeling van een medewerker, als tabblad van de medewerkerpagina. */
function verdelingVan(medewerkerId: string, jaar: number): string {
  return `${PAGINAS.medewerkers.pad}/${medewerkerId}/werkurenverdeling?jaar=${jaar}`
}

/** Kengetallen van het team, boven de tabbladen. */
function Teamkengetallen({ rijen }: { rijen: Rij[] }) {
  const som = (f: (r: Rij) => number) => rijen.reduce((s, r) => s + f(r), 0)
  const contracturen = som((r) => r.werkbelasting.contracturen)
  const schooluren = som((r) => r.werkbelasting.schooluren)
  const uitvoeringsuren = som((r) => r.werkbelasting.uitvoeringsuren)
  const projecturen = som((r) => r.werkbelasting.projecturen)
  const takenuren = som((r) => r.werkbelasting.takenuren)
  const overig = som((r) => r.werkbelasting.overig)
  const deel = (uren: number) => formatPercentage(contracturen > 0 ? (uren / contracturen) * 100 : 0)
  const vastgesteld = rijen.filter((r) => r.toelichting?.status === 'vastgesteld').length

  return (
    <Kengetallen className="mb-10">
      <Kengetal label="Contracturen team" waarde={formatUren(contracturen)} toelichting={`${rijen.length} medewerkers`} />
      <Kengetal label="Programma-scholen" waarde={formatUren(schooluren)} toelichting={deel(schooluren)} />
      <Kengetal label="Programma-uitvoering" waarde={formatUren(uitvoeringsuren)} toelichting={deel(uitvoeringsuren)} />
      <Kengetal label="Projectgroepen" waarde={formatUren(projecturen)} toelichting={deel(projecturen)} />
      <Kengetal label="Overige taken" waarde={formatUren(takenuren)} toelichting={deel(takenuren)} />
      <Kengetal label={overig < 0 ? 'Tekort' : 'Nog niet ingevuld'} waarde={formatUren(overig)} toelichting={`${vastgesteld} van ${rijen.length} vastgesteld`} />
    </Kengetallen>
  )
}

/** Signalen over scholen en projectgroepen, en per medewerker. */
function Aandachtspunten({ team, rijen, jaar }: { team: ReturnType<typeof teamSignalen>; rijen: Rij[]; jaar: number }) {
  const metSignaal = rijen.filter((r) => r.werkbelasting.signalen.length > 0 || r.gewijzigdNaVaststellen).length
  return (
    <Sectie titel="Aandachtspunten">
      {team.length === 0 && metSignaal === 0 ? (
        <p>Geen signalen.</p>
      ) : (
        <ul className="list-disc space-y-1 pl-6">
          {team.map((s) => (
            <li key={`${s.soort}-${s.naam}`}>{teamsignaalTekst(s)}</li>
          ))}
          {rijen.flatMap((r) => [
            ...r.werkbelasting.signalen.map((s) => (
              <li key={`${r.medewerker.id}-${JSON.stringify(s)}`}>
                <Tekstlink to={verdelingVan(r.medewerker.id, jaar)}>{r.medewerker.naam}</Tekstlink>: {signaalTekst(s)}
              </li>
            )),
            ...(r.gewijzigdNaVaststellen
              ? [
                  <li key={`${r.medewerker.id}-gewijzigd`}>
                    <Tekstlink to={verdelingVan(r.medewerker.id, jaar)}>{r.medewerker.naam}</Tekstlink>: gegevens gewijzigd na het
                    vaststellen.
                  </li>,
                ]
              : []),
          ])}
        </ul>
      )}
    </Sectie>
  )
}

/** Uren per programma, voor het team en per medewerker. */
function PerProgramma({ rijen, jaar }: { rijen: Rij[]; jaar: number }) {
  const programmas = teamProgrammas(rijen)
  const programmauren = programmas.reduce((s, p) => s + p.uren, 0)
  return (
    <>
      <p className="mb-8 max-w-prose text-neutral-700">
        De schooluren bij het programma van de school, en de uren van vaste uitvoerders. Projectgroepen en overige taken vallen
        buiten de programma’s.
      </p>
      <Sectie titel="Per programma">
        <Tabel
          bijschrift={`Uren per programma ${jaar}`}
          rijen={programmas}
          sleutel={(p) => p.programma.id}
          leeg="Nog geen programma-uren in dit jaar."
          kolommen={[
            { kop: 'Programma', inhoud: (p) => p.programma.naam, sorteer: (p) => p.programma.naam },
            { kop: 'Scholen', inhoud: (p) => p.scholen, getal: true, sorteer: (p) => p.scholen },
            { kop: 'Medewerkers', inhoud: (p) => p.medewerkers, getal: true, sorteer: (p) => p.medewerkers },
            { kop: 'Uren', inhoud: (p) => formatUren(p.uren), getal: true, sorteer: (p) => p.uren },
            {
              kop: 'Deel van de programma-uren',
              inhoud: (p) => formatPercentage(programmauren > 0 ? (p.uren / programmauren) * 100 : 0),
              getal: true,
              sorteer: (p) => p.uren,
            },
          ]}
        />
      </Sectie>
      {programmas.length > 0 && (
        <Sectie titel="Per medewerker en programma">
          <PerMedewerkerEnProgramma rijen={rijen} jaar={jaar} programmas={programmas.map((p) => p.programma)} />
        </Sectie>
      )}
    </>
  )
}

type Weergave = 'uren' | 'percentage'

/** Onderdelen die als uren of als percentage van de contracturen te tonen zijn. */
const ONDERDELEN: { kop: string; uren: (w: Werkbelasting) => number; deel: (w: Werkbelasting) => number }[] = [
  { kop: 'Scholen', uren: (w) => w.schooluren, deel: (w) => w.percentage.scholen },
  { kop: 'Uitvoering', uren: (w) => w.uitvoeringsuren, deel: (w) => w.percentage.uitvoering },
  { kop: 'Projecten', uren: (w) => w.projecturen, deel: (w) => w.percentage.projecten },
  { kop: 'Taken', uren: (w) => w.takenuren, deel: (w) => w.percentage.taken },
  { kop: 'Niet ingevuld', uren: (w) => w.overig, deel: (w) => w.percentage.overig },
]

const SITUATIES: { waarde: Rijfilter['situatie']; label: string }[] = [
  { waarde: 'alle', label: 'Iedereen' },
  { waarde: 'overbelast', label: 'Overbelast' },
  { waarde: 'aandacht', label: 'Met aandachtspunt' },
  { waarde: 'ruimte', label: 'Nog uren over' },
]

/** De werkurenverdeling per medewerker, te filteren en te sorteren, in uren of percentages. */
function PerMedewerker({
  rijen,
  jaar,
  programmas,
  metSignaal,
}: {
  rijen: Rij[]
  jaar: number
  programmas: ProgrammaRef[]
  metSignaal: number
}) {
  const [filter, setFilter] = useState<Rijfilter>(GEEN_FILTER)
  const [weergave, setWeergave] = useState<Weergave>('uren')
  const gefilterd = filterRijen(rijen, filter)
  const toon = (uren: number, deel: number) => (weergave === 'uren' ? formatUren(uren) : formatPercentage(deel))

  const kolommen: Kolom<Rij>[] = [
    medewerkerKolom(jaar),
    {
      kop: 'Uren p/w',
      inhoud: (r) => formatPerWeek(perWeek(r.werkbelasting.contracturen, r.werkbelasting.werkweken)),
      getal: true,
      sorteer: (r) => perWeek(r.werkbelasting.contracturen, r.werkbelasting.werkweken),
    },
    {
      kop: 'Contracturen',
      inhoud: (r) => formatUren(r.werkbelasting.contracturen),
      getal: true,
      sorteer: (r) => r.werkbelasting.contracturen,
    },
    ...ONDERDELEN.map(
      (o): Kolom<Rij> => ({
        kop: o.kop,
        inhoud: (r) => {
          const tekst = toon(o.uren(r.werkbelasting), o.deel(r.werkbelasting))
          return o.kop === 'Niet ingevuld' && r.werkbelasting.overig < -0.05 ? <strong>{tekst}</strong> : tekst
        },
        getal: true,
        sorteer: (r) => (weergave === 'uren' ? o.uren(r.werkbelasting) : o.deel(r.werkbelasting)),
      }),
    ),
    {
      kop: 'Extra',
      inhoud: (r) => (r.werkbelasting.extraTotaal > 0 ? formatUren(r.werkbelasting.extraTotaal) : '–'),
      getal: true,
      sorteer: (r) => r.werkbelasting.extraTotaal,
    },
  ]

  return (
    <>
      {metSignaal > 0 && (
        <div className="mb-4 print:hidden">
          <Melding soort="info">
            {metSignaal === 1 ? '1 medewerker heeft' : `${metSignaal} medewerkers hebben`} een aandachtspunt.{' '}
            <Tekstlink to={`${PAGINAS.teamoverzicht.pad}?jaar=${jaar}`}>
              Naar de signalen
            </Tekstlink>
          </Melding>
        </div>
      )}

      <Rijfilters
        filter={filter}
        onFilter={setFilter}
        programmas={programmas}
        weergave={weergave}
        onWeergave={setWeergave}
        aantal={gefilterd.length}
        totaal={rijen.length}
      />

      {/* De grafiek volgt dezelfde filters als de tabel eronder. */}
      {gefilterd.length > 0 && (
        <div className="mb-8">
          <Blok titel="Verdeling van de contracturen">
            <TeamBalken
              rijen={gefilterd
                .map((r) => ({ id: r.medewerker.id, naam: r.medewerker.naam, link: verdelingVan(r.medewerker.id, jaar), w: r.werkbelasting }))
                .sort(opNaam)}
            />
          </Blok>
        </div>
      )}

      <Tabel
        bijschrift={`Werkurenverdeling per medewerker ${jaar}`}
        rijen={gefilterd}
        sleutel={(r) => r.medewerker.id}
        leeg={rijen.length === 0 ? 'Geen medewerkers met inzet in dit jaar.' : 'Geen medewerkers die aan de filters voldoen.'}
        kolommen={kolommen}
        standaardSortering={{ kop: 'Medewerker', richting: 'oplopend' }}
      />
    </>
  )
}

const GEEN_FILTER: Rijfilter = { naam: '', programmaId: '', situatie: 'alle' }

function medewerkerKolom(jaar: number): Kolom<Rij> {
  return {
    kop: 'Medewerker',
    inhoud: (r) => (
      <Tekstlink to={verdelingVan(r.medewerker.id, jaar)}>
        {r.medewerker.naam}
      </Tekstlink>
    ),
    sorteer: (r) => r.medewerker.naam,
  }
}

/** Zoeken, filters en de wissel tussen uren en percentage, met de telling eronder. */
function Rijfilters({
  filter,
  onFilter,
  programmas,
  weergave,
  onWeergave,
  aantal,
  totaal,
}: {
  filter: Rijfilter
  onFilter: (filter: Rijfilter) => void
  programmas: ProgrammaRef[]
  weergave: Weergave
  onWeergave: (weergave: Weergave) => void
  aantal: number
  totaal: number
}) {
  const naam = useId()
  const zet = <K extends keyof Rijfilter>(veld: K, waarde: Rijfilter[K]) => onFilter({ ...filter, [veld]: waarde })

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end gap-4 print:hidden">
        <TextField
          label="Zoek op naam"
          type="search"
          className="w-full sm:w-56"
          value={filter.naam}
          onChange={(e) => zet('naam', e.target.value)}
        />
        <SelectField
          label="Programma"
          className="w-full sm:w-48"
          value={filter.programmaId}
          opties={[{ waarde: '', label: 'Alle programma’s' }, ...programmas.map((p) => ({ waarde: p.id, label: p.naam }))]}
          onChange={(e) => zet('programmaId', e.target.value)}
        />
        <SelectField
          label="Toon"
          className="w-full sm:w-52"
          value={filter.situatie}
          opties={SITUATIES}
          onChange={(e) => zet('situatie', e.target.value as Rijfilter['situatie'])}
        />
        <fieldset>
          <legend className="font-semibold">Weergave</legend>
          <div className="mt-2 inline-flex rounded-md border-2 border-neutral-500 bg-neutral-0 p-0.5">
            {(['uren', 'percentage'] as const).map((w) => (
              <label
                key={w}
                className={`cursor-pointer rounded-sm px-4 py-2 text-ui-md has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${
                  weergave === w ? 'bg-anthracite font-semibold text-white' : 'hover:bg-neutral-100'
                }`}
              >
                <input
                  type="radio"
                  name={naam}
                  value={w}
                  checked={weergave === w}
                  onChange={() => onWeergave(w)}
                  className="sr-only"
                />
                {w === 'uren' ? 'Uren' : 'Percentage'}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <p role="status" className="mb-3 text-ui-sm text-neutral-700">
        {aantal === totaal ? `${totaal} medewerkers.` : `${aantal} van ${totaal} medewerkers.`}{' '}
        {weergave === 'uren' ? 'Uren per jaar.' : 'Percentage van de contracturen.'}
      </p>
    </>
  )
}

/** Programma-uren per medewerker, te filteren en te sorteren, in uren of percentages van de contracturen. */
function PerMedewerkerEnProgramma({ rijen, jaar, programmas }: { rijen: Rij[]; jaar: number; programmas: ProgrammaRef[] }) {
  const [filter, setFilter] = useState<Rijfilter>(GEEN_FILTER)
  const [weergave, setWeergave] = useState<Weergave>('uren')
  const metProgramma = rijen.filter((r) => r.werkbelasting.programmas.length > 0)
  const gefilterd = filterRijen(metProgramma, filter)
  const waarde = (r: Rij, uren: number) =>
    weergave === 'uren' ? uren : r.werkbelasting.contracturen > 0 ? (uren / r.werkbelasting.contracturen) * 100 : 0
  const toon = (r: Rij, uren: number) => {
    if (uren <= 0) return '–'
    return weergave === 'uren' ? formatUren(uren) : formatPercentage(waarde(r, uren))
  }
  const totaal = (r: Rij) => r.werkbelasting.schooluren + r.werkbelasting.uitvoeringsuren

  const kolommen: Kolom<Rij>[] = [
    medewerkerKolom(jaar),
    ...programmas.map((p): Kolom<Rij> => {
      const uren = (r: Rij) => r.werkbelasting.programmas.find((q) => q.programma.id === p.id)?.uren ?? 0
      return { kop: p.naam, inhoud: (r) => toon(r, uren(r)), getal: true, sorteer: (r) => waarde(r, uren(r)) }
    }),
    { kop: 'Totaal', inhoud: (r) => toon(r, totaal(r)), getal: true, sorteer: (r) => waarde(r, totaal(r)) },
  ]

  return (
    <>
      <Rijfilters
        filter={filter}
        onFilter={setFilter}
        programmas={programmas}
        weergave={weergave}
        onWeergave={setWeergave}
        aantal={gefilterd.length}
        totaal={metProgramma.length}
      />
      <Tabel
        bijschrift={`Programma-uren per medewerker ${jaar}`}
        rijen={gefilterd}
        sleutel={(r) => r.medewerker.id}
        leeg="Geen medewerkers die aan de filters voldoen."
        kolommen={kolommen}
        standaardSortering={{ kop: 'Medewerker', richting: 'oplopend' }}
      />
    </>
  )
}
