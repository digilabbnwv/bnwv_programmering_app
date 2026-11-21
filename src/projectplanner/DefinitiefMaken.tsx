import { useId, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'
import { Melding } from '../components/Melding'
import { SelectField } from '../components/SelectField'
import { Tekstlink } from '../components/Tekstlink'
import type { Afdeling, Functie } from '../organisatie/api'
import { voerUit, type Projectgroep } from '../werkbelasting/api'
import { formatUren } from '../werkbelasting/berekening'
import { opNaam } from '../werkbelasting/opmaak'
import { statusLabel, type Jaarplan } from './api'
import { formatEuro, type Projectregel } from './berekening'
import { leesWerkboek } from './excel'
import { afwijkingen, controle, vergelijkMetExcel, voorgesteldeProjectgroep, type Afwijking, type Vergelijkregel } from './vaststellen'

const NIEUW = ''

function Projectlijst({ regels, jaar }: { regels: Projectregel[]; jaar: number }) {
  return (
    <span className="block text-ui-sm">
      {regels.map((r, i) => (
        <span key={r.projectjaar.id}>
          {i > 0 && ', '}
          <Tekstlink to={`/projecten/${r.project.id}?jaar=${jaar}`}>
            {r.project.naam}
          </Tekstlink>
        </span>
      ))}
    </span>
  )
}

/**
 * Definitief maken: eerst de controle, dan per akkoord project een nieuwe of
 * een bestaande projectgroep, dan vaststellen (jaarplan_definitief).
 */
export function DefinitiefMaken({
  jaar,
  regels,
  projectgroepen,
  onGelukt,
  onAnnuleren,
}: {
  jaar: number
  regels: Projectregel[]
  projectgroepen: Projectgroep[]
  onGelukt: (nieuw: number) => void
  onAnnuleren: () => void
}) {
  const { client } = useAuth()
  const titelId = useId()
  const c = controle(regels)
  const akkoord = regels.filter((r) => r.projectjaar.status === 'akkoord')
  const gekoppeld = (projectId: string) => projectgroepen.find((g) => g.project_id === projectId)
  const teKoppelen = akkoord.filter((r) => !gekoppeld(r.project.id))
  const vrij = projectgroepen.filter((g) => !g.project_id).sort(opNaam)
  const [keuze, setKeuze] = useState<Record<string, string>>(() =>
    Object.fromEntries(teKoppelen.map((r) => [r.project.id, voorgesteldeProjectgroep(r.project, vrij)?.id ?? NIEUW])),
  )
  const [fout, setFout] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)

  const gekozen = Object.values(keuze).filter((id) => id !== NIEUW)
  const dubbel = gekozen.find((id, i) => gekozen.indexOf(id) !== i)
  const nieuw = teKoppelen.filter((r) => (keuze[r.project.id] ?? NIEUW) === NIEUW).length

  async function vaststellen() {
    if (dubbel) {
      setFout(`De projectgroep ${vrij.find((g) => g.id === dubbel)?.naam ?? ''} is bij meer dan één project gekozen.`)
      return
    }
    setBezig(true)
    setFout(null)
    const koppelingen = Object.entries(keuze)
      .filter(([, id]) => id !== NIEUW)
      .map(([project_id, projectgroep_id]) => ({ project_id, projectgroep_id }))
    const res = await voerUit<number>(client, 'jaarplan_definitief', { p_jaar: jaar, p_koppelingen: koppelingen }, {
      P0002: 'Een gekozen projectgroep bestaat niet meer of hoort al bij een ander project. Ververs de pagina.',
    })
    setBezig(false)
    if (res.ok) onGelukt(res.data)
    else setFout(res.melding)
  }

  return (
    <section aria-labelledby={titelId} className="mb-8 rounded-card bg-neutral-0 p-5 shadow-card">
      <h2 id={titelId} className="text-subkop font-bold">
        Jaarplan {jaar} definitief maken
      </h2>
      <p className="mt-2 max-w-prose">
        De app bewaart het jaarplan zoals het nu is; latere wijzigingen zie je daarna als afwijking. Elk project met status akkoord krijgt een
        projectgroep, zodat collega’s eraan gekoppeld kunnen worden. Daarna kun je nog wijzigen, en ook terug naar concept.
      </p>

      <h3 className="mt-6 font-bold">Controle</h3>
      <ul className="mt-2 space-y-2">
        <li>
          {akkoord.length} projecten akkoord, {c.ingediend.length} nog ingediend, {regels.length - akkoord.length - c.ingediend.length}{' '}
          uitgesteld of afgewezen.
        </li>
        {c.ingediend.length > 0 && (
          <li>
            <span className="font-semibold">Nog ingediend</span> (krijgen geen projectgroep; zet ze op akkoord, uitgesteld of afgewezen):
            <Projectlijst regels={c.ingediend} jaar={jaar} />
          </li>
        )}
        {c.akkoordZonderInzet.length > 0 && (
          <li>
            <span className="font-semibold">Akkoord zonder inzet:</span>
            <Projectlijst regels={c.akkoordZonderInzet} jaar={jaar} />
          </li>
        )}
        {c.akkoordZonderBudget.length > 0 && (
          <li>
            <span className="font-semibold">Akkoord zonder budget:</span>
            <Projectlijst regels={c.akkoordZonderBudget} jaar={jaar} />
          </li>
        )}
        <li>
          Bekijk de drukte per functie in het{' '}
          <Tekstlink to={`/projectplanner?jaar=${jaar}`}>
            dashboard
          </Tekstlink>
          .
        </li>
      </ul>

      <h3 className="mt-6 font-bold">Projectgroepen</h3>
      {teKoppelen.length === 0 ? (
        <p className="mt-2">Alle akkoord projecten hebben al een projectgroep.</p>
      ) : (
        <>
          <p className="mt-2 max-w-prose text-ui-sm text-neutral-700">
            Bestaat de projectgroep al (bijvoorbeeld door een teamleider aangemaakt), kies hem dan; anders komt er een nieuwe met de naam,
            omschrijving en looptijd van het project.
          </p>
          <ul className="mt-3 divide-y divide-neutral-100">
            {teKoppelen.map((r) => (
              <li key={r.project.id} className="grid items-end gap-3 py-3 sm:grid-cols-2">
                <span className="font-semibold">{r.project.naam}</span>
                <SelectField
                  label={`Projectgroep voor ${r.project.naam}`}
                  value={keuze[r.project.id] ?? NIEUW}
                  opties={[{ waarde: NIEUW, label: 'Nieuwe projectgroep' }, ...vrij.map((g) => ({ waarde: g.id, label: `Bestaande: ${g.naam}` }))]}
                  onChange={(e) => setKeuze((oud) => ({ ...oud, [r.project.id]: e.target.value }))}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {fout && (
        <div className="mt-4">
          <Melding soort="fout">{fout}</Melding>
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={() => void vaststellen()} disabled={bezig}>
          {bezig ? 'Bezig…' : `Definitief maken (${nieuw} nieuwe projectgroep${nieuw === 1 ? '' : 'en'})`}
        </Button>
        <Button variant="secundair" onClick={onAnnuleren} disabled={bezig}>
          Annuleren
        </Button>
      </div>
    </section>
  )
}

function beschrijf(a: Afwijking): string {
  const euro = (b: number | null) => (b === null ? 'onbekend' : formatEuro(b))
  switch (a.soort) {
    case 'nieuw':
      return `toegevoegd (${statusLabel(a.status).toLowerCase()})`
    case 'weg':
      return 'uit het jaarplan gehaald'
    case 'status':
      return `status ${statusLabel(a.was).toLowerCase()} → ${statusLabel(a.nu).toLowerCase()}`
    case 'budget':
      return `budget ${euro(a.was)} → ${euro(a.nu)}`
    case 'uren':
      return `inzet ${formatUren(a.was)} → ${formatUren(a.nu)} uur`
    case 'inzet':
      return 'inzet anders verdeeld (zelfde uren)'
  }
}

/** Wijzigingen sinds het definitief maken, en akkoord projecten zonder projectgroep. */
export function Afwijkingen({
  jaarplan,
  regels,
  projectgroepen,
}: {
  jaarplan: Jaarplan
  regels: Projectregel[]
  projectgroepen: Projectgroep[]
}) {
  if (!jaarplan.momentopname) return null
  const lijst = afwijkingen(jaarplan.momentopname, regels)
  const zonderGroep = regels.filter((r) => r.projectjaar.status === 'akkoord' && !projectgroepen.some((g) => g.project_id === r.project.id))
  const perProject = new Map<string, { naam: string; teksten: string[] }>()
  for (const a of lijst) {
    const p = perProject.get(a.projectId) ?? { naam: a.naam, teksten: [] }
    p.teksten.push(beschrijf(a))
    perProject.set(a.projectId, p)
  }

  return (
    <div className="mb-8 space-y-4">
      {perProject.size === 0 ? (
        <p>Geen wijzigingen sinds het vaststellen.</p>
      ) : (
        <Melding soort="info">
          <details>
            <summary className="cursor-pointer font-semibold">
              {perProject.size} {perProject.size === 1 ? 'project' : 'projecten'} gewijzigd sinds het vaststellen
            </summary>
            <ul className="mt-2 space-y-1">
              {[...perProject].map(([id, p]) => (
                <li key={id}>
                  {lijst.some((a) => a.projectId === id && a.soort === 'weg') ? (
                    <span className="font-semibold">{p.naam}</span>
                  ) : (
                    <Tekstlink to={`/projecten/${id}?jaar=${jaarplan.jaar}`}>
                      {p.naam}
                    </Tekstlink>
                  )}
                  : {p.teksten.join('; ')}
                </li>
              ))}
            </ul>
          </details>
        </Melding>
      )}
      {zonderGroep.length > 0 && (
        <Melding soort="info">
          <span className="font-semibold">Akkoord, maar nog zonder projectgroep.</span> Maak die aan op de projectpagina:
          <Projectlijst regels={zonderGroep} jaar={jaarplan.jaar} />
        </Melding>
      )}
    </div>
  )
}

/** Proefjaar: totalen uit de Excel naast die van de app, per afdelingstabblad. */
export function ExcelVergelijking({
  regels,
  afdelingen,
  functies,
}: {
  regels: Projectregel[]
  afdelingen: Afdeling[]
  functies: Functie[]
}) {
  const invoerId = useId()
  const [rijen, setRijen] = useState<Vergelijkregel[] | null>(null)
  const [fout, setFout] = useState<string | null>(null)

  async function lees(bestand: File | undefined) {
    if (!bestand) return
    setFout(null)
    try {
      const v = vergelijkMetExcel(await leesWerkboek(await bestand.arrayBuffer()), regels, afdelingen, functies)
      if (v.length === 0) setFout('Geen afdelingstabbladen gevonden in dit bestand.')
      setRijen(v.length > 0 ? v : null)
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Het bestand kan niet gelezen worden.')
    }
  }

  const getal = (r: Vergelijkregel, waarde: number) => (r.wat === 'Budget' ? formatEuro(waarde) : formatUren(waarde))

  return (
    <div>
      <p className="max-w-prose">
        Kies de projectplanner-Excel om de totalen per afdeling naast die van de app te zetten (akkoord en ingediend). Een verschil is een
        invoerfout in de app of een fout in de Excel; zie de analyse in het plan. Het bestand wordt niet opgeslagen.
      </p>
      <label htmlFor={invoerId} className="mt-4 block font-semibold">
        Excel-bestand (.xlsx)
      </label>
      <input
        id={invoerId}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="mt-2 block"
        onChange={(e) => void lees(e.target.files?.[0])}
      />
      {fout && (
        <p role="alert" className="mt-3 font-semibold">
          {fout}
        </p>
      )}
      {rijen && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-ui-sm tabular-nums">
            <caption className="sr-only">Excel en app naast elkaar</caption>
            <thead>
              <tr className="border-b-2 border-neutral-300">
                <th scope="col" className="py-2 pr-4">
                  Afdeling
                </th>
                <th scope="col" className="py-2 pr-4">
                  Wat
                </th>
                <th scope="col" className="py-2 pr-4 text-right">
                  Excel
                </th>
                <th scope="col" className="py-2 pr-4 text-right">
                  App
                </th>
                <th scope="col" className="py-2 text-right">
                  Verschil
                </th>
              </tr>
            </thead>
            <tbody>
              {rijen.map((r) => {
                const verschil = r.app === null ? null : r.app - r.excel
                return (
                  <tr key={`${r.afdeling.id}:${r.wat}`} className="border-b border-neutral-100">
                    <td className="py-1.5 pr-4">{r.afdeling.afkorting || r.afdeling.naam}</td>
                    <td className="py-1.5 pr-4">{r.wat === 'Budget' || r.wat === 'Uren totaal' ? r.wat : `Uren inzet van ${r.wat}`}</td>
                    <td className="py-1.5 pr-4 text-right">{getal(r, r.excel)}</td>
                    <td className="py-1.5 pr-4 text-right">{r.app === null ? 'niet te vergelijken' : getal(r, r.app)}</td>
                    <td className={`py-1.5 text-right ${verschil !== null && Math.abs(verschil) > 0.05 ? 'font-bold' : ''}`}>
                      {verschil === null ? '–' : Math.abs(verschil) <= 0.05 ? 'gelijk' : getal(r, verschil)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
