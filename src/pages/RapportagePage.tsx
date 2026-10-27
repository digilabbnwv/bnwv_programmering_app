import { useCallback } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'
import { Melding } from '../components/Melding'
import { SelectField } from '../components/SelectField'
import { Tabel } from '../components/Tabel'
import { Pagina } from '../layout/Pagina'
import { formatPercentage, formatPerWeek, formatUren, perWeek } from '../werkbelasting/berekening'
import { Laadstatus, Sectie } from '../werkbelasting/onderdelen'
import { laadRapportage, programmaNaam, teamProgrammas, teamRijen, teamSignalen, type Rij } from '../werkbelasting/rapportage'
import { signaalTekst, teamsignaalTekst } from '../werkbelasting/signalen'
import { useGegevens } from '../werkbelasting/useGegevens'

/** Werkbelasting van het hele team in één jaar, met signalen (werkbelasting.bekijken). */
export function RapportagePage() {
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
      <Pagina titel="Rapportage">
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
      <Pagina titel={`Rapportage ${jaar}`}>
        {jaarKeuze}
        <p className="mt-6">Voor {jaar} zijn nog geen jaarinstellingen vastgelegd.</p>
      </Pagina>
    )
  }

  const rijen = teamRijen(gegevens, werkjaar)
  const team = teamSignalen(gegevens, jaar)
  const programmas = teamProgrammas(rijen)
  const som = (f: (r: Rij) => number) => rijen.reduce((s, r) => s + f(r), 0)
  const contracturen = som((r) => r.werkbelasting.contracturen)
  const schooluren = som((r) => r.werkbelasting.schooluren)
  const projecturen = som((r) => r.werkbelasting.projecturen)
  const takenuren = som((r) => r.werkbelasting.takenuren)
  const overig = som((r) => r.werkbelasting.overig)
  const deel = (uren: number) => formatPercentage(contracturen > 0 ? (uren / contracturen) * 100 : 0)
  const metSignaal = rijen.filter((r) => r.werkbelasting.signalen.length > 0 || r.gewijzigdNaVaststellen).length
  const vastgesteld = rijen.filter((r) => r.toelichting?.status === 'vastgesteld').length

  return (
    <Pagina titel={`Rapportage ${jaar}`} intro="De werkurenverdeling van het hele team. Percentages zijn ten opzichte van de contracturen.">
      <div className="mb-8 flex flex-wrap items-end gap-3 print:hidden">
        {jaarKeuze}
        <Button variant="secundair" onClick={() => window.print()}>
          Afdrukken
        </Button>
      </div>

      <dl className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Kengetal label="Contracturen team" waarde={formatUren(contracturen)} toelichting={`${rijen.length} medewerkers`} />
        <Kengetal label="Scholen" waarde={formatUren(schooluren)} toelichting={deel(schooluren)} />
        <Kengetal label="Projectgroepen" waarde={formatUren(projecturen)} toelichting={deel(projecturen)} />
        <Kengetal label="Overige taken" waarde={formatUren(takenuren)} toelichting={deel(takenuren)} />
        <Kengetal
          label={overig < 0 ? 'Tekort' : 'Nog niet ingevuld'}
          waarde={formatUren(overig)}
          toelichting={`${vastgesteld} van ${rijen.length} vastgesteld`}
        />
      </dl>

      <Sectie titel="Signalen">
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
                  <Link to={`/werkbelasting/${r.medewerker.id}?jaar=${jaar}`} className="font-semibold underline underline-offset-4 hover:no-underline">
                    {r.medewerker.naam}
                  </Link>
                  : {signaalTekst(s)}
                </li>
              )),
              ...(r.gewijzigdNaVaststellen
                ? [
                    <li key={`${r.medewerker.id}-gewijzigd`}>
                      <Link to={`/werkbelasting/${r.medewerker.id}?jaar=${jaar}`} className="font-semibold underline underline-offset-4 hover:no-underline">
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

      <Sectie titel="Verdeling per programma">
        <p className="mb-4 max-w-prose text-neutral-700">
          De schooluren per programma, naar het programma van de school. Projectgroepen en overige taken vallen buiten de
          programma’s.
        </p>
        <Tabel
          bijschrift={`Schooluren per programma ${jaar}`}
          rijen={programmas}
          sleutel={(p) => p.programma?.id ?? 'zonder'}
          leeg="Nog geen schooluren in dit jaar."
          kolommen={[
            { kop: 'Programma', inhoud: (p) => programmaNaam(p.programma) },
            { kop: 'Scholen', inhoud: (p) => p.scholen, getal: true },
            { kop: 'Medewerkers', inhoud: (p) => p.medewerkers, getal: true },
            { kop: 'Uren', inhoud: (p) => formatUren(p.uren), getal: true },
            {
              kop: 'Deel van de schooluren',
              inhoud: (p) => formatPercentage(schooluren > 0 ? (p.uren / schooluren) * 100 : 0),
              getal: true,
            },
          ]}
        />
        {programmas.length > 0 && (
          <div className="mt-6">
            <Tabel
              bijschrift={`Schooluren per medewerker en programma ${jaar}`}
              rijen={rijen.filter((r) => r.werkbelasting.scholen.length > 0)}
              sleutel={(r) => r.medewerker.id}
              kolommen={[
                {
                  kop: 'Medewerker',
                  inhoud: (r) => (
                    <Link to={`/werkbelasting/${r.medewerker.id}?jaar=${jaar}`} className="font-semibold underline underline-offset-4 hover:no-underline">
                      {r.medewerker.naam}
                    </Link>
                  ),
                },
                ...programmas.map((p) => ({
                  kop: programmaNaam(p.programma),
                  inhoud: (r: Rij) => {
                    const uren = r.werkbelasting.programmas.find((q) => q.programma?.id === p.programma?.id)?.uren ?? 0
                    return uren > 0 ? formatUren(uren) : '–'
                  },
                  getal: true,
                })),
                { kop: 'Totaal scholen', inhoud: (r) => formatUren(r.werkbelasting.schooluren), getal: true },
              ]}
            />
          </div>
        )}
      </Sectie>

      <Sectie titel="Per medewerker">
        {metSignaal > 0 && (
          <div className="mb-4 print:hidden">
            <Melding soort="info">
              {metSignaal === 1 ? '1 medewerker heeft' : `${metSignaal} medewerkers hebben`} een aandachtspunt, zie de signalen hierboven.
            </Melding>
          </div>
        )}
        <Tabel
          bijschrift={`Werkurenverdeling per medewerker ${jaar}`}
          rijen={rijen}
          sleutel={(r) => r.medewerker.id}
          leeg="Geen medewerkers met inzet in dit jaar."
          kolommen={[
            {
              kop: 'Medewerker',
              inhoud: (r) => (
                <Link to={`/werkbelasting/${r.medewerker.id}?jaar=${jaar}`} className="font-semibold underline underline-offset-4 hover:no-underline">
                  {r.medewerker.naam}
                </Link>
              ),
            },
            {
              kop: 'Uren p/w',
              inhoud: (r) => formatPerWeek(perWeek(r.werkbelasting.contracturen, r.werkbelasting.werkweken)),
              getal: true,
            },
            { kop: 'Contracturen', inhoud: (r) => formatUren(r.werkbelasting.contracturen), getal: true },
            {
              kop: 'Scholen',
              inhoud: (r) => <UrenEnDeel uren={r.werkbelasting.schooluren} deel={r.werkbelasting.percentage.scholen} />,
              getal: true,
            },
            {
              kop: 'Projecten',
              inhoud: (r) => <UrenEnDeel uren={r.werkbelasting.projecturen} deel={r.werkbelasting.percentage.projecten} />,
              getal: true,
            },
            {
              kop: 'Taken',
              inhoud: (r) => <UrenEnDeel uren={r.werkbelasting.takenuren} deel={r.werkbelasting.percentage.taken} />,
              getal: true,
            },
            {
              kop: 'Niet ingevuld',
              inhoud: (r) =>
                r.werkbelasting.overig < -0.05 ? (
                  <strong>
                    <UrenEnDeel uren={r.werkbelasting.overig} deel={r.werkbelasting.percentage.overig} />
                  </strong>
                ) : (
                  <UrenEnDeel uren={r.werkbelasting.overig} deel={r.werkbelasting.percentage.overig} />
                ),
              getal: true,
            },
            { kop: 'Extra', inhoud: (r) => (r.werkbelasting.extraTotaal > 0 ? formatUren(r.werkbelasting.extraTotaal) : '–'), getal: true },
            {
              kop: 'Status',
              inhoud: (r) =>
                r.toelichting?.status !== 'vastgesteld' ? (
                  'Concept'
                ) : r.gewijzigdNaVaststellen ? (
                  <strong>Vastgesteld, gewijzigd</strong>
                ) : (
                  'Vastgesteld'
                ),
            },
          ]}
        />
      </Sectie>
    </Pagina>
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

function UrenEnDeel({ uren, deel }: { uren: number; deel: number }) {
  return (
    <>
      {formatUren(uren)} <span className="text-neutral-700">({formatPercentage(deel)})</span>
    </>
  )
}
