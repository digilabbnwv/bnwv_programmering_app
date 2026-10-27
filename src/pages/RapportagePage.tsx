import { useCallback, useId, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'
import { Melding } from '../components/Melding'
import { SelectField } from '../components/SelectField'
import { Tabel, type Kolom } from '../components/Tabel'
import { TextField } from '../components/TextField'
import { Pagina } from '../layout/Pagina'
import type { Werkjaar } from '../werkbelasting/api'
import { formatPercentage, formatPerWeek, formatUren, perWeek, type ProgrammaRef, type Werkbelasting } from '../werkbelasting/berekening'
import { Laadstatus, Sectie } from '../werkbelasting/onderdelen'
import {
  filterRijen,
  laadRapportage,
  teamProgrammas,
  teamRijen,
  teamSignalen,
  type Rapportagegegevens,
  type Rij,
  type Rijfilter,
} from '../werkbelasting/rapportage'
import { signaalTekst, teamsignaalTekst } from '../werkbelasting/signalen'
import { useGegevens } from '../werkbelasting/useGegevens'

/**
 * De rapportage van het hele team in één jaar (werkbelasting.bekijken), in
 * drie pagina's: signalen, verdeling per programma en verdeling per
 * medewerker. Het jaar staat in de URL (?jaar=), zodat het bij wisselen van
 * pagina blijft staan.
 */

interface Inhoud {
  gegevens: Rapportagegegevens
  werkjaar: Werkjaar
  jaar: number
  rijen: Rij[]
}

/** Laadt de gegevens van het jaar en toont titel, jaarkeuze en afdrukknop. */
function Rapportage({ titel, intro, children }: { titel: string; intro: string; children: (inhoud: Inhoud) => ReactNode }) {
  const [zoek, setZoek] = useSearchParams()
  const jaar = Number(zoek.get('jaar')) || new Date().getFullYear()
  const { client } = useAuth()
  const laden = useCallback(async () => {
    const res = await laadRapportage(client, jaar)
    return res.ok ? { ok: true as const, data: { jaar, gegevens: res.data } } : res
  }, [client, jaar])
  const { data, fout } = useGegevens(laden)
  const gegevens = data?.jaar === jaar ? data.gegevens : null

  if (!gegevens) {
    return (
      <Pagina titel={titel}>
        <Laadstatus fout={fout} />
      </Pagina>
    )
  }

  const werkjaar = gegevens.werkjaren.find((w) => w.jaar === jaar)
  const jaarKeuze = (
    <SelectField
      label="Jaar"
      value={String(jaar)}
      opties={(gegevens.werkjaren.length > 0 ? gegevens.werkjaren : [{ jaar }]).map((w) => ({
        waarde: String(w.jaar),
        label: String(w.jaar),
      }))}
      onChange={(e) => setZoek({ jaar: e.target.value })}
      className="w-40"
    />
  )

  if (!werkjaar) {
    return (
      <Pagina titel={titel}>
        {jaarKeuze}
        <p className="mt-6">Voor {jaar} zijn nog geen jaarinstellingen vastgelegd.</p>
      </Pagina>
    )
  }

  return (
    <Pagina titel={titel} intro={`${intro} Jaar ${jaar}.`}>
      <div className="mb-8 flex flex-wrap items-end gap-3 print:hidden">
        {jaarKeuze}
        <Button variant="secundair" onClick={() => window.print()}>
          Afdrukken
        </Button>
      </div>
      {children({ gegevens, werkjaar, jaar, rijen: teamRijen(gegevens, werkjaar) })}
    </Pagina>
  )
}

const linkStijl = 'font-semibold underline underline-offset-4 hover:no-underline'

/** Kengetallen van het team en alle signalen. */
export function RapportageSignalenPage() {
  return (
    <Rapportage titel="Signalen" intro="Kengetallen en aandachtspunten van het hele team. Percentages zijn ten opzichte van de contracturen.">
      {({ gegevens, jaar, rijen }) => {
        const team = teamSignalen(gegevens, jaar)
        const som = (f: (r: Rij) => number) => rijen.reduce((s, r) => s + f(r), 0)
        const contracturen = som((r) => r.werkbelasting.contracturen)
        const schooluren = som((r) => r.werkbelasting.schooluren)
        const uitvoeringsuren = som((r) => r.werkbelasting.uitvoeringsuren)
        const projecturen = som((r) => r.werkbelasting.projecturen)
        const takenuren = som((r) => r.werkbelasting.takenuren)
        const overig = som((r) => r.werkbelasting.overig)
        const deel = (uren: number) => formatPercentage(contracturen > 0 ? (uren / contracturen) * 100 : 0)
        const metSignaal = rijen.filter((r) => r.werkbelasting.signalen.length > 0 || r.gewijzigdNaVaststellen).length
        const vastgesteld = rijen.filter((r) => r.toelichting?.status === 'vastgesteld').length

        return (
          <>
            <dl className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Kengetal label="Contracturen team" waarde={formatUren(contracturen)} toelichting={`${rijen.length} medewerkers`} />
              <Kengetal label="Programma-scholen" waarde={formatUren(schooluren)} toelichting={deel(schooluren)} />
              <Kengetal label="Programma-uitvoering" waarde={formatUren(uitvoeringsuren)} toelichting={deel(uitvoeringsuren)} />
              <Kengetal label="Projectgroepen" waarde={formatUren(projecturen)} toelichting={deel(projecturen)} />
              <Kengetal label="Overige taken" waarde={formatUren(takenuren)} toelichting={deel(takenuren)} />
              <Kengetal
                label={overig < 0 ? 'Tekort' : 'Nog niet ingevuld'}
                waarde={formatUren(overig)}
                toelichting={`${vastgesteld} van ${rijen.length} vastgesteld`}
              />
            </dl>

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
                        <Link to={`/werkbelasting/${r.medewerker.id}?jaar=${jaar}`} className={linkStijl}>
                          {r.medewerker.naam}
                        </Link>
                        : {signaalTekst(s)}
                      </li>
                    )),
                    ...(r.gewijzigdNaVaststellen
                      ? [
                          <li key={`${r.medewerker.id}-gewijzigd`}>
                            <Link to={`/werkbelasting/${r.medewerker.id}?jaar=${jaar}`} className={linkStijl}>
                              {r.medewerker.naam}
                            </Link>
                            : gegevens gewijzigd na het vaststellen.
                          </li>,
                        ]
                      : []),
                  ])}
                </ul>
              )}
            </Sectie>
          </>
        )
      }}
    </Rapportage>
  )
}

/** Uren per programma, voor het team en per medewerker. */
export function RapportageProgrammasPage() {
  return (
    <Rapportage
      titel="Verdeling per programma"
      intro="De schooluren bij het programma van de school, en de uren van vaste uitvoerders. Projectgroepen en overige taken vallen buiten de programma’s."
    >
      {({ jaar, rijen }) => {
        const programmas = teamProgrammas(rijen)
        const programmauren = programmas.reduce((s, p) => s + p.uren, 0)
        return (
          <>
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
      }}
    </Rapportage>
  )
}

/** De werkurenverdeling per medewerker, te filteren en te sorteren. */
export function RapportageMedewerkersPage() {
  return (
    <Rapportage titel="Verdeling per medewerker" intro="De werkurenverdeling van iedere medewerker, in uren of als percentage van de contracturen.">
      {({ jaar, rijen }) => (
        <PerMedewerker
          rijen={rijen}
          jaar={jaar}
          programmas={teamProgrammas(rijen).map((p) => p.programma)}
          metSignaal={rijen.filter((r) => r.werkbelasting.signalen.length > 0 || r.gewijzigdNaVaststellen).length}
        />
      )}
    </Rapportage>
  )
}

function Kengetal({ label, waarde, toelichting }: { label: string; waarde: string; toelichting: string }) {
  return (
    <div className="rounded-card bg-neutral-0 p-5 shadow-card print:border print:border-neutral-300 print:shadow-none">
      <dt className="text-ui-sm font-semibold text-neutral-700">{label}</dt>
      <dd className="mt-1 text-subkop font-bold tabular-nums">{waarde}</dd>
      <dd className="text-ui-sm text-neutral-700">{toelichting}</dd>
    </div>
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
            <Link to={`/rapportage/signalen?jaar=${jaar}`} className={linkStijl}>
              Naar de signalen
            </Link>
          </Melding>
        </div>
      )}

      <Filterbalk
        filter={filter}
        onFilter={setFilter}
        programmas={programmas}
        weergave={weergave}
        onWeergave={setWeergave}
        aantal={gefilterd.length}
        totaal={rijen.length}
      />

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
      <Link to={`/werkbelasting/${r.medewerker.id}?jaar=${jaar}`} className={linkStijl}>
        {r.medewerker.naam}
      </Link>
    ),
    sorteer: (r) => r.medewerker.naam,
  }
}

/** Zoeken, filters en de wissel tussen uren en percentage, met de telling eronder. */
function Filterbalk({
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
      <Filterbalk
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
