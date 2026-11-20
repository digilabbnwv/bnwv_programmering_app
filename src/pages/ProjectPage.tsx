import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useRechten } from '../auth/RechtenProvider'
import { Button } from '../components/Button'
import { Tabel } from '../components/Tabel'
import { Pagina } from '../layout/Pagina'
import { functieNaam, type Afdeling, type Functie, type Tak } from '../organisatie/api'
import {
  inzetfaseLabel,
  statusLabel,
  verwijderProjectplan,
  type Inzet,
  type Jaarplan,
  type Project,
  type Projectjaar,
} from '../projectplanner/api'
import { deelInJaar, formatEuro, totaalUren, urenPerPersoon, urenPerWeek } from '../projectplanner/berekening'
import { InzetFormulier, ProjectFormulier, ProjectjaarFormulier } from '../projectplanner/formulieren'
import { lees, type Medewerker, type Programma } from '../werkbelasting/api'
import { formatUren } from '../werkbelasting/berekening'
import { Gegevens, Laadstatus, Sectie, VerwijderDialoog } from '../werkbelasting/onderdelen'
import { formatPeriode } from '../werkbelasting/opmaak'
import { alles, useGegevens } from '../werkbelasting/useGegevens'

type Dialoog =
  | { soort: 'wijzigen' }
  | { soort: 'verwijderen' }
  | { soort: 'projectjaar'; projectjaar: Projectjaar | null }
  | { soort: 'projectjaar-verwijderen'; projectjaar: Projectjaar }
  | { soort: 'inzet'; projectjaar: Projectjaar; inzet: Inzet | null }
  | { soort: 'inzet-verwijderen'; inzet: Inzet }

const linkStijl = 'font-semibold underline underline-offset-4 hover:no-underline'

/** Eén project met zijn jaren, status, budget en inzet (projectplan.bekijken; wijzigen met projectplan.beheren). */
export function ProjectPage() {
  const { id = '' } = useParams()
  const [zoek] = useSearchParams()
  const { client } = useAuth()
  const { heeftRecht } = useRechten()
  const magBeheren = heeftRecht('projectplan.beheren')
  const navigate = useNavigate()
  const laden = useCallback(
    async () =>
      alles<[Project[], Projectjaar[], Inzet[], Jaarplan[], Afdeling[], Tak[], Functie[], Medewerker[], Programma[]]>(
        await Promise.all([
          lees<Project>(client, 'projecten', 'naam', { kolom: 'id', waarde: id }),
          lees<Projectjaar>(client, 'projectjaren', 'jaar', { kolom: 'project_id', waarde: id }),
          lees<Inzet>(client, 'projectjaar_inzet', 'startdatum'),
          lees<Jaarplan>(client, 'jaarplannen', 'jaar'),
          lees<Afdeling>(client, 'afdelingen', 'volgorde'),
          lees<Tak>(client, 'takken', 'naam'),
          lees<Functie>(client, 'functies', 'naam'),
          lees<Medewerker>(client, 'medewerkers', 'naam'),
          lees<Programma>(client, 'programmas', 'naam'),
        ]),
      ),
    [client, id],
  )
  const { data, fout, herlaad } = useGegevens(laden)
  const [dialoog, setDialoog] = useState<Dialoog | null>(null)
  const sluit = () => setDialoog(null)
  const terugJaar = zoek.get('jaar')
  const terug = terugJaar ? `/jaarplan?jaar=${terugJaar}` : '/jaarplan'

  if (!data) {
    return (
      <Pagina titel="Project">
        <Laadstatus fout={fout} />
      </Pagina>
    )
  }

  const [[project], projectjaren, alleInzet, jaarplannen, afdelingen, takken, functies, medewerkers, programmas] = data
  if (!project) {
    return (
      <Pagina titel="Project niet gevonden">
        <Link to={terug} className={linkStijl}>
          Terug naar het jaarplan
        </Link>
      </Pagina>
    )
  }

  const jaarplan = (jaar: number) => jaarplannen.find((j) => j.jaar === jaar)
  const bewerkbaar = (jaar: number) => {
    const fase = jaarplan(jaar)?.fase
    return magBeheren && (fase === 'wensen' || fase === 'concept')
  }
  const vrijeJaren = jaarplannen
    .filter((j) => (j.fase === 'wensen' || j.fase === 'concept') && deelInJaar(project, j.jaar) && !projectjaren.some((p) => p.jaar === j.jaar))
    .map((j) => j.jaar)
  const functie = (functieId: string) => functies.find((f) => f.id === functieId)
  const naam = (lijst: { id: string; naam: string }[], zoekId: string | null) => lijst.find((x) => x.id === zoekId)?.naam ?? ''

  return (
    <Pagina titel={project.naam} intro={project.omschrijving ? <span className="whitespace-pre-line">{project.omschrijving}</span> : undefined}>
      <p className="mb-8">
        <Link to={terug} className={linkStijl}>
          Terug naar het jaarplan
        </Link>
      </p>

      <Sectie
        titel="Gegevens"
        acties={
          magBeheren && (
            <>
              <Button variant="secundair" onClick={() => setDialoog({ soort: 'wijzigen' })}>
                Wijzigen
              </Button>
              <Button variant="secundair" onClick={() => setDialoog({ soort: 'verwijderen' })}>
                Verwijderen
              </Button>
            </>
          )
        }
      >
        <Gegevens
          regels={[
            ['Afdeling', naam(afdelingen, project.afdeling_id)],
            ['Tak', naam(takken, project.tak_id)],
            ['Looptijd', formatPeriode(project.startdatum, project.einddatum)],
            ['Ingediend door', naam(medewerkers, project.indiener_id)],
            ['Hoort bij programma', naam(programmas, project.programma_id)],
          ]}
        />
      </Sectie>

      {projectjaren.map((pj) => {
        const inzet = alleInzet.filter((i) => i.projectjaar_id === pj.id)
        const magWijzigen = bewerkbaar(pj.jaar)
        return (
          <Sectie
            key={pj.id}
            titel={`Jaarplan ${pj.jaar}`}
            acties={
              magWijzigen && (
                <>
                  <Button variant="secundair" onClick={() => setDialoog({ soort: 'projectjaar', projectjaar: pj })}>
                    Status en budget<span className="sr-only"> {pj.jaar}</span>
                  </Button>
                  <Button variant="secundair" onClick={() => setDialoog({ soort: 'inzet', projectjaar: pj, inzet: null })}>
                    Inzet toevoegen<span className="sr-only"> {pj.jaar}</span>
                  </Button>
                </>
              )
            }
          >
            <Gegevens
              regels={[
                ['Status', statusLabel(pj.status)],
                ['Budget', formatEuro(pj.budget)],
                ['Inzet', inzet.length === 0 ? 'Nog geen inzet' : `${formatUren(totaalUren(inzet))} uur`],
                ['Toelichting', pj.toelichting ? <span className="whitespace-pre-line">{pj.toelichting}</span> : ''],
              ]}
            />
            <div className="mt-6">
              <Tabel
                bijschrift={`Inzet in ${pj.jaar}`}
                rijen={inzet}
                sleutel={(i) => i.id}
                leeg="Nog geen inzet. Voeg per functie een regel toe; een project zonder uren kan ook."
                kolommen={[
                  {
                    kop: 'Functie',
                    inhoud: (i) => {
                      const f = functie(i.functie_id)
                      return <span className="font-semibold">{f ? functieNaam(f) : ''}</span>
                    },
                  },
                  { kop: 'Fase', inhoud: (i) => inzetfaseLabel(i.fase) },
                  { kop: 'Collega’s', inhoud: (i) => i.aantal_collegas, getal: true },
                  { kop: 'Uren', inhoud: (i) => formatUren(i.uren), getal: true },
                  { kop: 'Per collega', inhoud: (i) => formatUren(urenPerPersoon(i)), getal: true },
                  { kop: 'Per week', inhoud: (i) => formatUren(urenPerWeek(i)), getal: true },
                  { kop: 'Periode', inhoud: (i) => formatPeriode(i.startdatum, i.einddatum) },
                ]}
                acties={
                  magWijzigen
                    ? (i) => (
                        <>
                          <Button variant="link" onClick={() => setDialoog({ soort: 'inzet', projectjaar: pj, inzet: i })}>
                            Wijzigen
                          </Button>
                          <Button variant="link" onClick={() => setDialoog({ soort: 'inzet-verwijderen', inzet: i })}>
                            Verwijderen
                          </Button>
                        </>
                      )
                    : undefined
                }
              />
            </div>
            {magWijzigen && projectjaren.length > 1 && (
              <p className="mt-4">
                <Button variant="link" onClick={() => setDialoog({ soort: 'projectjaar-verwijderen', projectjaar: pj })}>
                  Uit het jaarplan {pj.jaar} halen
                </Button>
              </p>
            )}
          </Sectie>
        )
      })}

      {magBeheren && vrijeJaren.length > 0 && (
        <p className="mt-10">
          <Button variant="secundair" onClick={() => setDialoog({ soort: 'projectjaar', projectjaar: null })}>
            Ook in een ander jaarplan zetten
          </Button>
        </p>
      )}

      {dialoog?.soort === 'wijzigen' && (
        <ProjectFormulier
          project={project}
          jaar={null}
          afdelingen={afdelingen}
          takken={takken}
          medewerkers={medewerkers}
          programmas={programmas}
          onSluiten={sluit}
          onGelukt={herlaad}
        />
      )}
      {dialoog?.soort === 'verwijderen' && (
        <VerwijderDialoog
          wat="Project"
          toelichting="Het project verdwijnt uit alle jaarplannen, met zijn budget en inzet."
          onVerwijderen={() => verwijderProjectplan(client, 'projecten', project.id)}
          onSluiten={sluit}
          onGelukt={() => void navigate(terug)}
        />
      )}
      {dialoog?.soort === 'projectjaar' && (
        <ProjectjaarFormulier
          project={project}
          projectjaar={dialoog.projectjaar}
          vrijeJaren={vrijeJaren}
          onSluiten={sluit}
          onGelukt={herlaad}
        />
      )}
      {dialoog?.soort === 'projectjaar-verwijderen' && (
        <VerwijderDialoog
          wat={`Jaarplan ${dialoog.projectjaar.jaar}`}
          toelichting="Het project blijft bestaan in de andere jaarplannen. Budget en inzet van dit jaar verdwijnen."
          onVerwijderen={() => verwijderProjectplan(client, 'projectjaren', dialoog.projectjaar.id)}
          onSluiten={sluit}
          onGelukt={herlaad}
        />
      )}
      {dialoog?.soort === 'inzet' && (
        <InzetFormulier
          inzet={dialoog.inzet}
          projectjaar={dialoog.projectjaar}
          project={project}
          functies={functies}
          afdelingen={afdelingen}
          onSluiten={sluit}
          onGelukt={herlaad}
        />
      )}
      {dialoog?.soort === 'inzet-verwijderen' && (
        <VerwijderDialoog
          wat="Inzet"
          onVerwijderen={() => verwijderProjectplan(client, 'projectjaar_inzet', dialoog.inzet.id)}
          onSluiten={sluit}
          onGelukt={herlaad}
        />
      )}
    </Pagina>
  )
}
