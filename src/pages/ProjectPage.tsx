import { useCallback, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useRechten } from '../auth/RechtenProvider'
import { Button } from '../components/Button'
import { SelectField } from '../components/SelectField'
import { Tabel } from '../components/Tabel'
import { Gegevens, Sectie } from '../components/Sectie'
import { Laadstatus } from '../components/Melding'
import { Tekstlink } from '../components/Tekstlink'
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
import { voorgesteldeProjectgroep } from '../projectplanner/vaststellen'
import { lees, voerUit, type Medewerker, type Programma, type Projectgroep } from '../werkbelasting/api'
import { formatUren } from '../werkbelasting/berekening'
import { FormulierDialoog, VerwijderDialoog } from '../werkbelasting/onderdelen'
import { formatPeriode, opNaam } from '../werkbelasting/opmaak'
import { alles, useGegevens } from '../werkbelasting/useGegevens'

type Dialoog =
  | { soort: 'wijzigen' }
  | { soort: 'verwijderen' }
  | { soort: 'projectjaar'; projectjaar: Projectjaar | null }
  | { soort: 'projectjaar-verwijderen'; projectjaar: Projectjaar }
  | { soort: 'inzet'; projectjaar: Projectjaar; inzet: Inzet | null }
  | { soort: 'inzet-verwijderen'; inzet: Inzet }
  | { soort: 'projectgroep' }

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
      alles<[Project[], Projectjaar[], Inzet[], Jaarplan[], Afdeling[], Tak[], Functie[], Medewerker[], Programma[], Projectgroep[]]>(
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
          lees<Projectgroep>(client, 'projectgroepen', 'naam'),
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

  const [[project], projectjaren, alleInzet, jaarplannen, afdelingen, takken, functies, medewerkers, programmas, projectgroepen] = data
  if (!project) {
    return (
      <Pagina titel="Project niet gevonden">
        <Tekstlink to={terug}>
          Terug naar het jaarplan
        </Tekstlink>
      </Pagina>
    )
  }

  const jaarplan = (jaar: number) => jaarplannen.find((j) => j.jaar === jaar)
  // Ook na definitief te wijzigen (dan een afwijking); alleen een afgesloten jaar niet.
  const bewerkbaar = (jaar: number) => {
    const fase = jaarplan(jaar)?.fase
    return magBeheren && fase !== undefined && fase !== 'afgesloten'
  }
  const vrijeJaren = jaarplannen
    .filter((j) => j.fase !== 'afgesloten' && deelInJaar(project, j.jaar) && !projectjaren.some((p) => p.jaar === j.jaar))
    .map((j) => j.jaar)
  const projectgroep = projectgroepen.find((g) => g.project_id === project.id)
  const isAkkoord = projectjaren.some((p) => p.status === 'akkoord')
  const naarProjectgroep = heeftRecht('werkbelasting.beheren')
  const functie = (functieId: string) => functies.find((f) => f.id === functieId)
  const naam = (lijst: { id: string; naam: string }[], zoekId: string | null) => lijst.find((x) => x.id === zoekId)?.naam ?? ''

  return (
    <Pagina
      titel={project.naam}
      intro={project.omschrijving ? <span className="whitespace-pre-line">{project.omschrijving}</span> : undefined}
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
      <Sectie titel="Gegevens">
        <Gegevens
          regels={[
            ['Afdeling', naam(afdelingen, project.afdeling_id)],
            ['Tak', naam(takken, project.tak_id)],
            ['Looptijd', formatPeriode(project.startdatum, project.einddatum)],
            ['Ingediend door', naam(medewerkers, project.indiener_id)],
            ['Hoort bij programma', naam(programmas, project.programma_id)],
            [
              'Projectgroep',
              projectgroep ? (
                naarProjectgroep ? (
                  <Tekstlink to={`/projectgroepen/${projectgroep.id}`}>
                    {projectgroep.naam}
                  </Tekstlink>
                ) : (
                  projectgroep.naam
                )
              ) : isAkkoord ? (
                'nog niet aangemaakt'
              ) : (
                'komt er als het project akkoord is en het jaarplan definitief'
              ),
            ],
          ]}
        />
        {!projectgroep && isAkkoord && magBeheren && (
          <p className="mt-4">
            <Button variant="secundair" onClick={() => setDialoog({ soort: 'projectgroep' })}>
              Projectgroep aanmaken
            </Button>
          </p>
        )}
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
      {dialoog?.soort === 'projectgroep' && (
        <ProjectgroepKoppelen project={project} projectgroepen={projectgroepen} onSluiten={sluit} onGelukt={herlaad} />
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

/** Een projectgroep voor een project dat akkoord is: nieuw, of een bestaande koppelen. */
function ProjectgroepKoppelen({
  project,
  projectgroepen,
  onSluiten,
  onGelukt,
}: {
  project: Project
  projectgroepen: Projectgroep[]
  onSluiten: () => void
  onGelukt: () => void
}) {
  const { client } = useAuth()
  const vrij = projectgroepen.filter((g) => !g.project_id).sort(opNaam)
  const [keuze, setKeuze] = useState(voorgesteldeProjectgroep(project, vrij)?.id ?? '')

  return (
    <FormulierDialoog
      titel="Projectgroep aanmaken"
      opslaanLabel={keuze ? 'Koppelen' : 'Aanmaken'}
      onOpslaan={() =>
        voerUit(client, 'project_naar_projectgroep', { p_project_id: project.id, p_projectgroep_id: keuze || null }, {
          P0002: 'Deze projectgroep bestaat niet meer of hoort al bij een ander project. Ververs de pagina.',
          '23514': 'Alleen een project met status akkoord krijgt een projectgroep.',
        })
      }
      onSluiten={onSluiten}
      onGelukt={onGelukt}
    >
      <p>Een nieuwe projectgroep krijgt de naam, omschrijving en looptijd van het project. Bestaat hij al, kies hem dan.</p>
      <SelectField
        label="Projectgroep"
        value={keuze}
        opties={[{ waarde: '', label: 'Nieuwe projectgroep' }, ...vrij.map((g) => ({ waarde: g.id, label: `Bestaande: ${g.naam}` }))]}
        onChange={(e) => setKeuze(e.target.value)}
      />
    </FormulierDialoog>
  )
}
