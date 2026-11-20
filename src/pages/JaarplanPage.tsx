import { useCallback, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useRechten } from '../auth/RechtenProvider'
import { Button } from '../components/Button'
import { SelectField } from '../components/SelectField'
import { Tabel } from '../components/Tabel'
import { Pagina } from '../layout/Pagina'
import { functieOpties, type Afdeling, type Functie, type Tak } from '../organisatie/api'
import { faseLabel, STATUSSEN, statusLabel, type Inzet, type Jaarplan, type Project, type Projectjaar, type ProjectStatus } from '../projectplanner/api'
import { filterRegels, formatEuro, GEEN_FILTER, kengetallen, projectregels, totaalUren, type Filter } from '../projectplanner/berekening'
import { JaarplanFormulier, ProjectFormulier } from '../projectplanner/formulieren'
import { ExcelImport } from '../projectplanner/ExcelImport'
import { lees, type Medewerker, type Programma } from '../werkbelasting/api'
import { formatUren } from '../werkbelasting/berekening'
import { Laadstatus, Sectie } from '../werkbelasting/onderdelen'
import { formatPeriode, opNaam } from '../werkbelasting/opmaak'
import { alles, useGegevens } from '../werkbelasting/useGegevens'

type Dialoog = { soort: 'jaarplan-nieuw' } | { soort: 'jaarplan-wijzigen'; jaarplan: Jaarplan } | { soort: 'project' }

const linkStijl = 'font-semibold underline underline-offset-4 hover:no-underline'

/**
 * Het jaarplan van één jaar (projectplan.bekijken): kengetallen en de
 * projecten met status, budget en uren. Wijzigen met projectplan.beheren.
 * Het jaar staat in de URL (?jaar=).
 */
export function JaarplanPage() {
  const { client } = useAuth()
  const { heeftRecht } = useRechten()
  const magBeheren = heeftRecht('projectplan.beheren')
  const navigate = useNavigate()
  const [zoek, setZoek] = useSearchParams()
  const laden = useCallback(
    async () =>
      alles<[Jaarplan[], Project[], Projectjaar[], Inzet[], Afdeling[], Tak[], Functie[], Medewerker[], Programma[]]>(
        await Promise.all([
          lees<Jaarplan>(client, 'jaarplannen', 'jaar'),
          lees<Project>(client, 'projecten', 'naam'),
          lees<Projectjaar>(client, 'projectjaren', 'jaar'),
          lees<Inzet>(client, 'projectjaar_inzet', 'startdatum'),
          lees<Afdeling>(client, 'afdelingen', 'volgorde'),
          lees<Tak>(client, 'takken', 'naam'),
          lees<Functie>(client, 'functies', 'naam'),
          lees<Medewerker>(client, 'medewerkers', 'naam'),
          lees<Programma>(client, 'programmas', 'naam'),
        ]),
      ),
    [client],
  )
  const { data, fout, herlaad } = useGegevens(laden)
  const [filter, setFilter] = useState<Filter>(GEEN_FILTER)
  const [dialoog, setDialoog] = useState<Dialoog | null>(null)
  const sluit = () => setDialoog(null)

  if (!data) {
    return (
      <Pagina titel="Jaarplan">
        <Laadstatus fout={fout} />
      </Pagina>
    )
  }

  const [jaarplannen, projecten, projectjaren, inzet, afdelingen, takken, functies, medewerkers, programmas] = data
  const gevraagd = Number(zoek.get('jaar'))
  const volgendJaar = new Date().getFullYear() + 1
  const jaarplan =
    jaarplannen.find((j) => j.jaar === gevraagd) ??
    jaarplannen.find((j) => j.jaar === volgendJaar) ??
    jaarplannen.at(-1) ??
    null
  const kiesJaar = (jaar: number) => {
    setZoek({ jaar: String(jaar) })
    setFilter(GEEN_FILTER)
  }

  const dialogen = (
    <>
      {(dialoog?.soort === 'jaarplan-nieuw' || dialoog?.soort === 'jaarplan-wijzigen') && (
        <JaarplanFormulier
          jaarplan={dialoog.soort === 'jaarplan-wijzigen' ? dialoog.jaarplan : null}
          bestaand={jaarplannen.map((j) => j.jaar)}
          onSluiten={sluit}
          onGelukt={(jaar) => {
            kiesJaar(jaar)
            herlaad()
          }}
        />
      )}
      {dialoog?.soort === 'project' && jaarplan && (
        <ProjectFormulier
          project={null}
          jaar={jaarplan.jaar}
          afdelingen={afdelingen}
          takken={takken}
          medewerkers={medewerkers}
          programmas={programmas}
          onSluiten={sluit}
          onGelukt={(id) => void navigate(`/projecten/${id}?jaar=${jaarplan.jaar}`)}
        />
      )}
    </>
  )

  if (!jaarplan) {
    return (
      <Pagina titel="Jaarplan" intro="Per jaar de projecten met hun budget en de benodigde inzet per functie.">
        <p className="mb-6">Er is nog geen jaarplan.</p>
        {magBeheren && <Button onClick={() => setDialoog({ soort: 'jaarplan-nieuw' })}>Jaarplan toevoegen</Button>}
        {dialogen}
      </Pagina>
    )
  }

  const alleRegels = projectregels(jaarplan.jaar, projecten, projectjaren, inzet)
  const regels = filterRegels(alleRegels, filter)
  const k = kengetallen(regels)
  const bewerkbaar = magBeheren && (jaarplan.fase === 'wensen' || jaarplan.fase === 'concept')
  const afdeling = (id: string) => afdelingen.find((a) => a.id === id)
  const tak = (id: string | null) => takken.find((t) => t.id === id)
  const zet = <K extends keyof Filter>(veld: K, waarde: Filter[K]) =>
    setFilter((oud) => ({ ...oud, [veld]: waarde, ...(veld === 'afdelingId' ? { takId: '' } : {}) }))
  const kanImporteren = bewerkbaar && alleRegels.length === 0

  return (
    <Pagina
      titel={`Jaarplan ${jaarplan.jaar}`}
      intro="De projecten van dit jaar met hun status, budget en de benodigde inzet per functie."
    >
      <div className="mb-8 flex flex-wrap items-end gap-3">
        <SelectField
          label="Jaar"
          value={String(jaarplan.jaar)}
          opties={jaarplannen.map((j) => ({ waarde: String(j.jaar), label: String(j.jaar) }))}
          onChange={(e) => kiesJaar(Number(e.target.value))}
          className="w-40"
        />
        {magBeheren && (
          <Button variant="secundair" onClick={() => setDialoog({ soort: 'jaarplan-nieuw' })}>
            Jaarplan toevoegen
          </Button>
        )}
      </div>

      <p className="mb-6">
        <span className="font-semibold">Fase: {faseLabel(jaarplan.fase)}.</span>
        {jaarplan.proefjaar && ' Proefjaar: de Excel blijft leidend, de app draait mee.'}
        {bewerkbaar && (
          <>
            {' '}
            <Button variant="link" onClick={() => setDialoog({ soort: 'jaarplan-wijzigen', jaarplan })}>
              Fase wijzigen
            </Button>
          </>
        )}
      </p>

      {kanImporteren && (
        <ExcelImport jaar={jaarplan.jaar} afdelingen={afdelingen} takken={takken} programmas={programmas} onGelukt={herlaad} />
      )}

      <dl className="my-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kengetal
          label="Projecten"
          waarde={String(k.aantal)}
          toelichting={STATUSSEN.filter((s) => k.perStatus[s.waarde] > 0)
            .map((s) => `${k.perStatus[s.waarde]} ${s.label.toLowerCase()}`)
            .join(', ') || 'nog geen'}
        />
        <Kengetal
          label="Budget"
          waarde={formatEuro(k.budget)}
          toelichting={k.zonderBudget === 0 ? 'zonder afgewezen projecten' : `${k.zonderBudget} zonder budget, afgewezen niet meegeteld`}
        />
        <Kengetal
          label="Inzet"
          waarde={`${formatUren(k.uren)} uur`}
          toelichting={k.zonderInzet === 0 ? 'zonder afgewezen projecten' : `${k.zonderInzet} zonder inzet, afgewezen niet meegeteld`}
        />
        <Kengetal label="Afdelingen" waarde={String(new Set(regels.map((r) => r.project.afdeling_id)).size)} toelichting="met projecten in deze selectie" />
      </dl>

      <Sectie
        titel="Projecten"
        acties={
          bewerkbaar && (
            <Button variant="secundair" onClick={() => setDialoog({ soort: 'project' })}>
              Project toevoegen
            </Button>
          )
        }
      >
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField
            label="Afdeling"
            value={filter.afdelingId}
            opties={[{ waarde: '', label: 'Alle afdelingen' }, ...afdelingen.map((a) => ({ waarde: a.id, label: a.naam }))]}
            onChange={(e) => zet('afdelingId', e.target.value)}
          />
          <SelectField
            label="Tak"
            value={filter.takId}
            opties={[
              { waarde: '', label: 'Alle takken' },
              ...takken
                .filter((t) => !filter.afdelingId || t.afdeling_id === filter.afdelingId)
                .sort(opNaam)
                .map((t) => ({ waarde: t.id, label: filter.afdelingId ? t.naam : `${t.naam} (${afdeling(t.afdeling_id)?.afkorting ?? ''})` })),
            ]}
            onChange={(e) => zet('takId', e.target.value)}
          />
          <SelectField
            label="Status"
            value={filter.status}
            opties={[{ waarde: '', label: 'Alle statussen' }, ...STATUSSEN.map((s) => ({ waarde: s.waarde, label: s.label }))]}
            onChange={(e) => zet('status', e.target.value as ProjectStatus | '')}
          />
          <SelectField
            label="Met inzet van"
            value={filter.functieId}
            opties={[{ waarde: '', label: 'Alle functies' }, ...functieOpties(functies, afdelingen, filter.functieId || null)]}
            onChange={(e) => zet('functieId', e.target.value)}
          />
        </div>

        <Tabel
          bijschrift={`Projecten in het jaarplan ${jaarplan.jaar}`}
          rijen={regels}
          sleutel={(r) => r.projectjaar.id}
          leeg={alleRegels.length === 0 ? 'Er staan nog geen projecten in dit jaarplan.' : 'Geen projecten met deze filters.'}
          kolommen={[
            {
              kop: 'Project',
              inhoud: (r) => (
                <Link to={`/projecten/${r.project.id}?jaar=${jaarplan.jaar}`} className={linkStijl}>
                  {r.project.naam}
                </Link>
              ),
              sorteer: (r) => r.project.naam,
            },
            { kop: 'Afdeling', inhoud: (r) => afdeling(r.project.afdeling_id)?.afkorting ?? '', sorteer: (r) => afdeling(r.project.afdeling_id)?.volgorde ?? 0 },
            { kop: 'Tak', inhoud: (r) => tak(r.project.tak_id)?.naam ?? '', sorteer: (r) => tak(r.project.tak_id)?.naam ?? '' },
            { kop: 'Status', inhoud: (r) => statusLabel(r.projectjaar.status), sorteer: (r) => r.projectjaar.status },
            {
              kop: 'Budget',
              inhoud: (r) => formatEuro(r.projectjaar.budget),
              getal: true,
              sorteer: (r) => r.projectjaar.budget ?? -1,
            },
            {
              kop: 'Uren',
              inhoud: (r) => (r.inzet.length === 0 ? 'geen inzet' : formatUren(totaalUren(r.inzet))),
              getal: true,
              sorteer: (r) => totaalUren(r.inzet),
            },
            { kop: 'Looptijd', inhoud: (r) => formatPeriode(r.project.startdatum, r.project.einddatum), sorteer: (r) => r.project.startdatum },
          ]}
        />
      </Sectie>

      {dialogen}
    </Pagina>
  )
}

function Kengetal({ label, waarde, toelichting }: { label: string; waarde: string; toelichting: string }) {
  return (
    <div className="rounded-card bg-neutral-0 p-5 shadow-card">
      <dt className="text-ui-sm font-semibold text-neutral-700">{label}</dt>
      <dd className="mt-1 text-subkop font-bold tabular-nums">{waarde}</dd>
      <dd className="text-ui-sm text-neutral-700">{toelichting}</dd>
    </div>
  )
}
