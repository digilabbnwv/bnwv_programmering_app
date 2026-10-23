import { useCallback, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useRechten } from '../auth/RechtenProvider'
import { Melding } from '../components/Melding'
import { Pagina } from '../layout/Pagina'
import { berekenWerkbelasting, formatPercentage, formatPerWeek, formatUren, perWeek, type Regel, type Werkbelasting } from '../werkbelasting/berekening'
import { Staafdiagram, TeamBalken, Verdelingsbalk, type Staaf } from '../werkbelasting/grafieken'
import { Laadstatus, Sectie } from '../werkbelasting/onderdelen'
import { formatPeriode, opNaam } from '../werkbelasting/opmaak'
import { bouwInvoer, laadRapportage, teamRijen, teamSignalen, type Rapportagegegevens } from '../werkbelasting/rapportage'
import { signaalTekst, teamsignaalTekst } from '../werkbelasting/signalen'
import { useGegevens } from '../werkbelasting/useGegevens'

/**
 * Startpagina: de eigen werkbelasting van dit jaar (als het account aan een
 * medewerker gekoppeld is) en, met werkbelasting.bekijken, een teamblok.
 * Eén keer laden: RLS geeft een medewerker alleen de eigen rijen.
 */
export function StartPage() {
  const { client, claims } = useAuth()
  const { weergavenaam, heeftRecht, laden: rechtenLaden } = useRechten()
  const jaar = new Date().getFullYear()
  const laden = useCallback(() => laadRapportage(client, jaar), [client, jaar])
  const { data, fout } = useGegevens(laden)
  const team = heeftRecht('werkbelasting.bekijken')
  const eigen = data?.medewerkers.find((m) => m.user_id === claims?.sub) ?? null
  const werkjaar = data?.werkjaren.find((w) => w.jaar === jaar) ?? null

  return (
    <Pagina titel={weergavenaam ? `Welkom, ${weergavenaam}` : 'Welkom'}>
      {!data || rechtenLaden ? (
        <Laadstatus fout={fout} />
      ) : !werkjaar ? (
        <p>Voor {jaar} zijn nog geen jaarinstellingen vastgelegd. Daarna verschijnt hier de werkbelasting.</p>
      ) : (
        <>
          {eigen ? (
            <MijnWerkbelasting
              w={berekenWerkbelasting(bouwInvoer(data, eigen.id, werkjaar))}
              medewerkerId={eigen.id}
              gegevens={data}
            />
          ) : (
            !team && (
              <p className="max-w-prose">
                Je account is nog niet gekoppeld aan een medewerker. Vraag de teamleider om dat te doen; daarna zie je hier je
                eigen werkbelasting.
              </p>
            )
          )}
          {team && <Teamblok gegevens={data} jaar={jaar} />}
        </>
      )}
    </Pagina>
  )
}

function MijnWerkbelasting({ w, medewerkerId, gegevens }: { w: Werkbelasting; medewerkerId: string; gegevens: Rapportagegegevens }) {
  const week = (uren: number) => formatPerWeek(perWeek(uren, w.werkweken))
  const toelichting = gegevens.toelichtingen.find((t) => t.medewerker_id === medewerkerId)

  return (
    <Sectie
      titel={`Mijn werkbelasting ${w.jaar}`}
      acties={
        <Link to={`/werkbelasting/${medewerkerId}`} className="font-semibold underline underline-offset-4 hover:no-underline">
          Volledige werkurenverdeling
        </Link>
      }
    >
      {w.contracturen <= 0 ? (
        <p>Er is voor {w.jaar} nog geen contract vastgelegd.</p>
      ) : (
        <div className="space-y-8">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Kengetal label="Contract" waarde={`${week(w.contracturen)} uur p/w`} toelichting={`${formatUren(w.contracturen)} uur per jaar`} />
            <Kengetal label="Scholen" waarde={formatPercentage(w.percentage.scholen)} toelichting={`${week(w.schooluren)} uur p/w`} />
            <Kengetal label="Projectgroepen" waarde={formatPercentage(w.percentage.projecten)} toelichting={`${week(w.projecturen)} uur p/w`} />
            <Kengetal label="Overige taken" waarde={formatPercentage(w.percentage.taken)} toelichting={`${week(w.takenuren)} uur p/w`} />
            <Kengetal
              label={w.overig < -0.05 ? 'Tekort' : 'Nog niet ingevuld'}
              waarde={`${week(w.overig)} uur p/w`}
              toelichting={toelichting?.status === 'vastgesteld' ? 'Verdeling vastgesteld' : 'Verdeling in concept'}
            />
          </dl>

          <Blok titel="Verdeling van mijn contracturen">
            <Verdelingsbalk w={w} />
          </Blok>

          {w.signalen.length > 0 && (
            <Melding soort="info">
              <p className="font-semibold">Let op</p>
              <ul className="mt-1 list-disc pl-6">
                {w.signalen.map((s) => (
                  <li key={JSON.stringify(s)}>{signaalTekst(s)}</li>
                ))}
              </ul>
            </Melding>
          )}

          <div className="grid gap-8 lg:grid-cols-2">
            <Blok titel={`Mijn scholen (${w.scholen.length})`}>
              {w.scholen.length === 0 ? (
                <p>Geen scholen in {w.jaar}.</p>
              ) : (
                <Staafdiagram
                  titel="Uren per school in dit jaar"
                  staven={[...w.scholen]
                    .sort((a, b) => b.jaaruren - a.jaaruren)
                    .map((s) => ({
                      id: `${s.id}-${s.periode.startdatum}`,
                      label: s.naam,
                      naam: s.naam,
                      waarde: s.jaaruren,
                      toelichting: s.aandeel < 1 ? formatPeriode(s.periode.startdatum, s.periode.einddatum) : undefined,
                    }))}
                />
              )}
            </Blok>
            <Blok titel={`Mijn projectgroepen (${w.projecten.length})`}>
              {w.projecten.length === 0 ? (
                <p>Geen projectgroepen in {w.jaar}.</p>
              ) : (
                <Staafdiagram titel="Uren per projectgroep in dit jaar" staven={staven(w.projecten)} />
              )}
            </Blok>
            <Blok titel={`Mijn overige taken (${w.taken.length})`}>
              {w.taken.length === 0 ? (
                <p>Geen overige taken in {w.jaar}.</p>
              ) : (
                <Staafdiagram titel="Uren per overige taak in dit jaar" staven={staven(w.taken)} />
              )}
            </Blok>
          </div>
        </div>
      )}
    </Sectie>
  )
}

/** Regels als staven, grootste eerst, met de periode als die korter is dan het jaar. */
function staven(regels: readonly Regel[]): Staaf[] {
  return [...regels]
    .sort((a, b) => b.jaaruren - a.jaaruren)
    .map((r) => ({
      id: `${r.id}-${r.periode.startdatum}`,
      label: r.naam,
      naam: r.naam,
      waarde: r.jaaruren,
      toelichting: r.aandeel < 1 ? formatPeriode(r.periode.startdatum, r.periode.einddatum) : undefined,
    }))
}

function Teamblok({ gegevens, jaar }: { gegevens: Rapportagegegevens; jaar: number }) {
  const werkjaar = gegevens.werkjaren.find((w) => w.jaar === jaar)
  if (!werkjaar) return null
  const rijen = teamRijen(gegevens, werkjaar).filter((r) => r.medewerker.actief)
  const signalen = teamSignalen(gegevens, jaar)
  const overbelast = rijen.filter((r) => r.werkbelasting.overig < -0.05).length
  const vastgesteld = rijen.filter((r) => r.toelichting?.status === 'vastgesteld').length
  const persoonlijkeSignalen = rijen.reduce((s, r) => s + r.werkbelasting.signalen.length, 0)

  return (
    <Sectie
      titel={`Team ${jaar}`}
      acties={
        <Link to={`/rapportage?jaar=${jaar}`} className="font-semibold underline underline-offset-4 hover:no-underline">
          Naar de rapportage
        </Link>
      }
    >
      <div className="space-y-8">
        <dl className="grid gap-4 sm:grid-cols-3">
          <Kengetal label="Medewerkers" waarde={String(rijen.length)} toelichting={`${vastgesteld} verdelingen vastgesteld`} />
          <Kengetal label="Overbelast" waarde={String(overbelast)} toelichting={overbelast === 0 ? 'Niemand' : 'Zie hieronder'} />
          <Kengetal
            label="Signalen"
            waarde={String(signalen.length + persoonlijkeSignalen)}
            toelichting={`${signalen.length} over scholen en projectgroepen`}
          />
        </dl>

        {signalen.length > 0 && (
          <Blok titel="Scholen en projectgroepen">
            <ul className="list-disc space-y-1 pl-6">
              {signalen.slice(0, 5).map((s) => (
                <li key={`${s.soort}-${s.naam}`}>{teamsignaalTekst(s)}</li>
              ))}
            </ul>
            {signalen.length > 5 && (
              <p className="mt-2 text-ui-sm">
                En nog {signalen.length - 5}.{' '}
                <Link to={`/rapportage?jaar=${jaar}`} className="font-semibold underline underline-offset-4 hover:no-underline">
                  Alle signalen
                </Link>
              </p>
            )}
          </Blok>
        )}

        <Blok titel="Belasting per medewerker">
          {rijen.length === 0 ? (
            <p>Nog geen medewerkers.</p>
          ) : (
            <TeamBalken
              rijen={rijen
                .map((r) => ({
                  id: r.medewerker.id,
                  naam: r.medewerker.naam,
                  link: `/werkbelasting/${r.medewerker.id}?jaar=${jaar}`,
                  w: r.werkbelasting,
                }))
                .sort(opNaam)}
            />
          )}
        </Blok>
      </div>
    </Sectie>
  )
}

function Blok({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <div className="rounded-card bg-neutral-0 p-5 shadow-card md:p-6">
      <h3 className="mb-4 font-bold">{titel}</h3>
      {children}
    </div>
  )
}

function Kengetal({ label, waarde, toelichting }: { label: string; waarde: string; toelichting: string }) {
  return (
    <div className="rounded-card bg-neutral-0 p-5 shadow-card">
      <dt className="text-ui-sm font-semibold text-neutral-700">{label}</dt>
      <dd className="mt-1 text-subkop font-bold">{waarde}</dd>
      <dd className="text-ui-sm text-neutral-700">{toelichting}</dd>
    </div>
  )
}
