import { useCallback, useState } from 'react'
import { Navigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useRechten } from '../auth/RechtenProvider'
import { Button } from '../components/Button'
import { Filterbalk } from '../components/Filterbalk'
import { Kengetal, Kengetallen } from '../components/Kengetal'
import { SelectField } from '../components/SelectField'
import { Tabel } from '../components/Tabel'
import { Laadstatus } from '../components/Melding'
import { Sectie } from '../components/Sectie'
import { Tekstlink } from '../components/Tekstlink'
import { AndereJaren, useJaar } from '../layout/JaarProvider'
import { Pagina } from '../layout/Pagina'
import { JaarplanStatus } from '../projectplanner/JaarplanStatus'
import { PAGINAS } from '../layout/paginas'
import { Tabbladen, useTabblad } from '../layout/Tabbladen'
import { functieNaam, type Afdeling, type Functie, type Tak } from '../organisatie/api'
import type { Inzet, Jaarplan, Project, Projectjaar } from '../projectplanner/api'
import { formatEuro, projectregels, totaalUren, type Projectregel } from '../projectplanner/berekening'
import {
  budgetPerTak,
  capaciteitPerFunctie,
  drukstWeek,
  drukte,
  plansignalen,
  projectenInUitvoering,
  telMee,
  tijdlijn,
  wekenTeVol,
  type Capaciteit,
  type Plansignaal,
  type Statuskeuze,
} from '../projectplanner/drukte'
import { Drukteheatmap, Gelijktijdig, Tijdlijn, weekLabel } from '../projectplanner/grafieken'
import { afwijkingen } from '../projectplanner/vaststellen'
import { lees, type Resultaat } from '../werkbelasting/api'
import { berekenWerkbelasting, formatPercentage, formatUren } from '../werkbelasting/berekening'
import { bouwInvoer, laadRapportage } from '../werkbelasting/rapportage'
import { alles, useGegevens } from '../werkbelasting/useGegevens'

interface Gegevens {
  jaarplannen: Jaarplan[]
  projecten: Project[]
  projectjaren: Projectjaar[]
  inzet: Inzet[]
  afdelingen: Afdeling[]
  takken: Tak[]
  functies: Functie[]
}

interface Capaciteitsgegevens {
  jaar: number
  werkjaarBekend: boolean
  perFunctie: Map<string, Capaciteit>
}

/**
 * Dashboard van de projectplanner voor MT en directie (projectplan.bekijken):
 * kengetallen, signalen, drukte per functie per week, gelijktijdige projecten,
 * inzet per functie, budget per afdeling en tak, en de tijdlijn. Filters en
 * kengetallen staan boven de tabbladen (signalen, drukte, budget, tijdlijn).
 * Het jaar komt uit de jaarkeuze in de kopbalk. Zie docs/projectplanner.md,
 * hoofdstuk 7 en 8.
 */
export function ProjectplannerDashboardPage() {
  const { client } = useAuth()
  const { heeftRecht } = useRechten()
  const magWerkbelasting = heeftRecht('werkbelasting.bekijken')
  const { jaar: gekozenJaar } = useJaar()
  const tabbladen = PAGINAS.projectplanner.tabbladen
  const tab = useTabblad(tabbladen)
  const [afdelingId, setAfdelingId] = useState('')
  const [keuze, setKeuze] = useState<Statuskeuze>('actief')

  const laden = useCallback(async (): Promise<Resultaat<Gegevens>> => {
    const res = alles<[Jaarplan[], Project[], Projectjaar[], Inzet[], Afdeling[], Tak[], Functie[]]>(
      await Promise.all([
        lees<Jaarplan>(client, 'jaarplannen', 'jaar'),
        lees<Project>(client, 'projecten', 'naam'),
        lees<Projectjaar>(client, 'projectjaren', 'jaar'),
        lees<Inzet>(client, 'projectjaar_inzet', 'startdatum'),
        lees<Afdeling>(client, 'afdelingen', 'volgorde'),
        lees<Tak>(client, 'takken', 'naam'),
        lees<Functie>(client, 'functies', 'naam'),
      ]),
    )
    if (!res.ok) return res
    const [jaarplannen, projecten, projectjaren, inzet, afdelingen, takken, functies] = res.data
    return { ok: true, data: { jaarplannen, projecten, projectjaren, inzet, afdelingen, takken, functies } }
  }, [client])
  const { data, fout } = useGegevens(laden)

  const jaarplannen = data?.jaarplannen ?? []
  const jaarplan = jaarplannen.find((j) => j.jaar === gekozenJaar) ?? null
  const jaar = jaarplan?.jaar ?? null

  const { capaciteit, fout: capaciteitFout } = useCapaciteit(jaar, magWerkbelasting)

  if (tab === null) return <Navigate to=".." relative="path" replace />
  if (!data) {
    return (
      <Pagina breedte="breed" titel="Projectplanner">
        <Laadstatus fout={fout} />
      </Pagina>
    )
  }
  if (!jaarplan || jaar === null) {
    return (
      <Pagina breedte="breed" titel="Projectplanner" intro="Het overzicht van het jaarplan voor MT en directie.">
        <p>
          Er is nog geen jaarplan voor {gekozenJaar}. Maak er een aan onder <Tekstlink to={PAGINAS.jaarplan.pad}>Jaarplan</Tekstlink>.
        </p>
        <AndereJaren jaren={jaarplannen.map((j) => j.jaar)} />
      </Pagina>
    )
  }

  const { afdelingen, takken, functies } = data
  const alleRegels = projectregels(jaar, data.projecten, data.projectjaren, data.inzet).filter(
    (r) => !afdelingId || r.project.afdeling_id === afdelingId,
  )
  const regels = alleRegels.filter((r) => telMee(r.projectjaar.status, keuze))
  const capaciteitBekend = magWerkbelasting && capaciteit !== null
  const perFunctie = capaciteit?.perFunctie ?? new Map<string, Capaciteit>()
  const d = drukte(regels, functies, perFunctie, jaar)
  const aantalAfwijkend = jaarplan.momentopname
    ? new Set(afwijkingen(jaarplan.momentopname, projectregels(jaar, data.projecten, data.projectjaren, data.inzet)).map((a) => a.projectId)).size
    : 0
  const signalen = plansignalen(regels, d, {
    jaar,
    werkjaarBekend: capaciteit?.werkjaarBekend ?? true,
    capaciteitBekend,
  })
  const afdeling = (id: string) => afdelingen.find((a) => a.id === id)
  const tak = (id: string | null) => takken.find((t) => t.id === id)

  const tellen = (status: Projectregel['projectjaar']['status']) => alleRegels.filter((r) => r.projectjaar.status === status).length
  const budget = regels.reduce((s, r) => s + (r.projectjaar.budget ?? 0), 0)
  const uren = regels.reduce((s, r) => s + totaalUren(r.inzet), 0)
  const voorbereiding = regels.reduce((s, r) => s + totaalUren(r.inzet.filter((i) => i.fase === 'voorbereiding')), 0)
  const drukste = d
    .filter((f) => f.bezetting)
    .map((f) => ({ f, w: drukstWeek(f) }))
    .sort((a, b) => (b.w.bezetting ?? 0) - (a.w.bezetting ?? 0))[0]
  const meetellen = keuze === 'akkoord' ? 'alleen akkoord' : 'akkoord en ingediend'

  return (
    <Pagina
      breedte="breed"
      titel={`Projectplanner ${jaar}`}
      intro={`Het jaarplan ${jaar}: budget, benodigde inzet per functie en de drukte per week. Uitgesteld en afgewezen tellen niet mee.`}
      status={<JaarplanStatus jaarplan={jaarplan} />}
      acties={
        <Button variant="secundair" onClick={() => window.print()}>
          Afdrukken
        </Button>
      }
    >
      <Filterbalk>
        <SelectField
          label="Afdeling"
          value={afdelingId}
          opties={[{ waarde: '', label: 'Alle afdelingen' }, ...afdelingen.map((a) => ({ waarde: a.id, label: a.naam }))]}
          onChange={(e) => setAfdelingId(e.target.value)}
          className="w-64"
        />
        <SelectField
          label="Meetellen"
          value={keuze}
          opties={[
            { waarde: 'actief', label: 'Akkoord en ingediend' },
            { waarde: 'akkoord', label: 'Alleen akkoord' },
          ]}
          onChange={(e) => setKeuze(e.target.value as Statuskeuze)}
          className="w-56"
        />
      </Filterbalk>

      <Kengetallen className="mb-10">
        <Kengetal
          label="Projecten"
          waarde={String(regels.length)}
          toelichting={`${tellen('akkoord')} akkoord, ${tellen('ingediend')} ingediend; ${tellen('uitgesteld')} uitgesteld en ${tellen('afgewezen')} afgewezen tellen niet mee`}
        />
        <Kengetal label="Budget" waarde={formatEuro(budget)} toelichting={`${meetellen}; ${regels.filter((r) => r.projectjaar.budget === null).length} zonder budget`} />
        <Kengetal
          label="Inzet"
          waarde={`${formatUren(uren)} uur`}
          toelichting={`${formatUren(voorbereiding)} voorbereiding, ${formatUren(uren - voorbereiding)} uitvoering`}
        />
        <Kengetal
          label="Drukste week"
          waarde={drukste?.w.bezetting ? formatPercentage(drukste.w.bezetting * 100) : '–'}
          toelichting={
            drukste
              ? `${functieNaam(drukste.f.functie)}, ${weekLabel(jaar, drukste.w.week)}`
              : capaciteitBekend
                ? 'geen functie met bekende capaciteit'
                : 'capaciteit wordt geladen of is niet zichtbaar'
          }
        />
      </Kengetallen>

      {capaciteitFout && <Laadstatus fout={`De capaciteit kan niet worden geladen: ${capaciteitFout}`} />}

      <Tabbladen tabbladen={tabbladen} actief={tab} tellers={{ '': signalen.length + (aantalAfwijkend > 0 ? 1 : 0) }} />

      {tab === '' && (
        <>
          <Afwijkend aantal={aantalAfwijkend} jaar={jaar} />
          <Signalen signalen={signalen} jaar={jaar} />
        </>
      )}

      {tab === 'drukte' && (
        <>
          <Sectie titel="Drukte per functie per week">
            <p className="mb-4 max-w-prose text-ui-sm text-neutral-700">
              De uren van elke inzetregel zijn gelijk over de periode verdeeld. De bezetting is het deel van de uren die medewerkers met die functie
              over hebben na scholen, programma-uitvoering en overige taken.
            </p>
            <Drukteheatmap jaar={jaar} drukte={d} />
          </Sectie>

          <Sectie titel="Projecten tegelijk in uitvoering">
            <Gelijktijdig jaar={jaar} perWeek={projectenInUitvoering(regels, jaar)} />
          </Sectie>

          <Sectie titel="Inzet per functie">
            <Tabel
              bijschrift={`Inzet per functie in ${jaar}`}
              rijen={d}
              sleutel={(f) => f.functie.id}
              leeg="Nog geen inzet."
              standaardSortering={{ kop: 'Uren nodig', richting: 'aflopend' }}
              kolommen={[
                { kop: 'Functie', inhoud: (f) => <span className="font-semibold">{functieNaam(f.functie)}</span>, sorteer: (f) => f.functie.naam },
                { kop: 'Afdeling', inhoud: (f) => afdeling(f.functie.afdeling_id)?.afkorting ?? '' },
                { kop: 'Uren nodig', inhoud: (f) => formatUren(f.totaal), getal: true, sorteer: (f) => f.totaal },
                {
                  kop: 'Vrij voor projecten',
                  inhoud: (f) => (f.capaciteit ? `${formatUren(f.capaciteit.perJaar)} (${f.capaciteit.medewerkers} mw.)` : 'onbekend'),
                  getal: true,
                  sorteer: (f) => f.capaciteit?.perJaar ?? -1,
                },
                {
                  kop: 'Over het jaar',
                  inhoud: (f) => (f.capaciteit ? formatPercentage((f.totaal / f.capaciteit.perJaar) * 100) : '–'),
                  getal: true,
                  sorteer: (f) => (f.capaciteit ? f.totaal / f.capaciteit.perJaar : -1),
                },
                {
                  kop: 'Drukste week',
                  inhoud: (f) => {
                    const w = drukstWeek(f)
                    return `${weekLabel(jaar, w.week)}: ${w.bezetting !== null ? formatPercentage(w.bezetting * 100) : `${formatUren(w.uren)} uur`}`
                  },
                },
                {
                  kop: 'Weken te vol',
                  inhoud: (f) => {
                    const n = wekenTeVol(f).length
                    return n === 0 ? (f.capaciteit ? '0' : '–') : <span className="font-semibold">{n} !</span>
                  },
                  getal: true,
                  sorteer: (f) => wekenTeVol(f).length,
                },
              ]}
            />
          </Sectie>
        </>
      )}

      {tab === 'budget' && (
        <Sectie titel="Budget per afdeling en tak">
          <Tabel
            bijschrift={`Budget per afdeling en tak in ${jaar}`}
            rijen={budgetPerTak(alleRegels, afdelingen, takken)}
            sleutel={(b) => `${b.afdeling.id}:${b.tak?.id ?? ''}`}
            leeg="Nog geen projecten."
            kolommen={[
              { kop: 'Afdeling en tak', inhoud: (b) => <span className="font-semibold">{`${b.afdeling.afkorting || b.afdeling.naam} · ${b.tak?.naam ?? 'zonder tak'}`}</span> },
              { kop: 'Projecten', inhoud: (b) => b.projecten, getal: true, sorteer: (b) => b.projecten },
              { kop: 'Akkoord', inhoud: (b) => formatEuro(b.akkoord), getal: true, sorteer: (b) => b.akkoord },
              { kop: 'Ingediend', inhoud: (b) => formatEuro(b.ingediend), getal: true, sorteer: (b) => b.ingediend },
              { kop: 'Zonder budget', inhoud: (b) => b.zonderBudget, getal: true, sorteer: (b) => b.zonderBudget },
              { kop: 'Uren', inhoud: (b) => formatUren(b.uren), getal: true, sorteer: (b) => b.uren },
            ]}
          />
        </Sectie>
      )}

      {tab === 'tijdlijn' && (
        <Sectie titel="Tijdlijn">
          <Tijdlijn
            jaar={jaar}
            regels={tijdlijn(regels, jaar)}
            groep={(r) => `${afdeling(r.regel.project.afdeling_id)?.naam ?? ''} · ${tak(r.regel.project.tak_id)?.naam ?? 'zonder tak'}`}
          />
        </Sectie>
      )}
    </Pagina>
  )
}

/**
 * Capaciteit per functie uit de werkbelasting van het jaar: per medewerker wat
 * over is na scholen, programma-uitvoering en overige taken. Alleen met
 * werkbelasting.bekijken; anders null (onbekend).
 */
function useCapaciteit(jaar: number | null, magWerkbelasting: boolean): { capaciteit: Capaciteitsgegevens | null; fout: string | null } {
  const { client } = useAuth()
  const laden = useCallback(async (): Promise<Resultaat<Capaciteitsgegevens | null>> => {
    if (jaar === null || !magWerkbelasting) return { ok: true, data: null }
    const res = await laadRapportage(client, jaar)
    if (!res.ok) return res
    const g = res.data
    const werkjaar = g.werkjaren.find((w) => w.jaar === jaar)
    if (!werkjaar) return { ok: true, data: { jaar, werkjaarBekend: false, perFunctie: new Map() } }
    const vrij = g.medewerkers
      .filter((m) => m.actief)
      .map((m) => {
        const w = berekenWerkbelasting(bouwInvoer(g, m.id, werkjaar))
        return { functie_id: m.functie_id, vrij: w.beschikbaar - w.schooluren - w.uitvoeringsuren - w.takenuren, werkweken: w.werkweken }
      })
    return { ok: true, data: { jaar, werkjaarBekend: true, perFunctie: capaciteitPerFunctie(vrij) } }
  }, [client, jaar, magWerkbelasting])
  const { data, fout } = useGegevens(laden)
  return { capaciteit: data?.jaar === jaar ? data : null, fout }
}

function Afwijkend({ aantal, jaar }: { aantal: number; jaar: number }) {
  if (aantal === 0) return null
  return (
    <p className="mb-3">
      <span className="font-semibold">
        {aantal} {aantal === 1 ? 'project' : 'projecten'} gewijzigd sinds het vaststellen.
      </span>{' '}
      <Tekstlink to={`${PAGINAS.jaarplan.pad}/afwijkingen?jaar=${jaar}`}>Bekijk de afwijkingen</Tekstlink>
    </p>
  )
}

/** Signalen, de zwaarste eerst; lange lijsten van projecten zijn in te klappen. */
function Signalen({ signalen, jaar }: { signalen: Plansignaal[]; jaar: number }) {
  if (signalen.length === 0) return <p>Geen signalen.</p>
  const projectlink = (s: { regel: Projectregel }) => (
    <Tekstlink key={s.regel.projectjaar.id} to={`/projecten/${s.regel.project.id}?jaar=${jaar}`}>
      {s.regel.project.naam}
    </Tekstlink>
  )
  const lijst = <T extends { regel: Projectregel }>(items: T[]) => (
    <span className="mt-1 block text-ui-sm">
      {items.map((s, i) => (
        <span key={s.regel.projectjaar.id}>
          {i > 0 && ', '}
          {projectlink(s)}
        </span>
      ))}
    </span>
  )
  const geenInzet = signalen.filter((s): s is Extract<Plansignaal, { soort: 'geen-inzet' }> => s.soort === 'geen-inzet')
  const geenBudget = signalen.filter((s): s is Extract<Plansignaal, { soort: 'geen-budget' }> => s.soort === 'geen-budget')

  return (
    <ul className="space-y-3">
      {signalen.map((s) => {
        switch (s.soort) {
          case 'geen-werkjaar':
            return (
              <li key={s.soort}>
                <span className="font-semibold">Geen werkjaar {s.jaar}.</span> Stel {s.jaar} in onder{' '}
                <Tekstlink to="/staffel">
                  Jaar en staffel
                </Tekstlink>
                ; zonder werkjaar is de capaciteit onbekend.
              </li>
            )
          case 'te-vol':
            return (
              <li key={`${s.soort}:${s.functie.id}`}>
                <span className="font-semibold">! {functieNaam(s.functie)}</span>: {s.weken.length}{' '}
                {s.weken.length === 1 ? 'week' : 'weken'} boven de capaciteit, het hoogst {formatPercentage(s.hoogste * 100)} (week{' '}
                {s.weken.join(', ')}).
              </li>
            )
          case 'capaciteit-onbekend':
            return (
              <li key={`${s.soort}:${s.functie.id}`}>
                <span className="font-semibold">{functieNaam(s.functie)}</span>: {formatUren(s.uren)} uur nodig, maar geen medewerkers met deze
                functie en een contract in de app.
              </li>
            )
          case 'inactieve-functie':
            return (
              <li key={`${s.soort}:${s.functie.id}`}>
                <span className="font-semibold">{functieNaam(s.functie)}</span> is inactief, maar heeft nog inzet in: {lijst(s.regels.map((regel) => ({ regel })))}
              </li>
            )
          default:
            return null
        }
      })}
      {geenInzet.length > 0 && (
        <li>
          <details>
            <summary className="cursor-pointer">
              <span className="font-semibold">{geenInzet.length} projecten zonder inzet.</span> Zonder uren telt een project niet mee in de drukte.
            </summary>
            {lijst(geenInzet)}
          </details>
        </li>
      )}
      {geenBudget.length > 0 && (
        <li>
          <details>
            <summary className="cursor-pointer">
              <span className="font-semibold">{geenBudget.length} projecten zonder budget.</span> Vul 0 in als er geen budget nodig is.
            </summary>
            {lijst(geenBudget)}
          </details>
        </li>
      )}
    </ul>
  )
}
