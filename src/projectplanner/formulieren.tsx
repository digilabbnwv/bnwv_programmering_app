import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Selectievakje } from '../components/Selectievakje'
import { SelectField } from '../components/SelectField'
import { TextArea } from '../components/TextArea'
import { TextField } from '../components/TextField'
import { functieOpties, type Afdeling, type Functie, type Tak } from '../organisatie/api'
import { voerUit, type Medewerker, type Programma } from '../werkbelasting/api'
import { formatUren } from '../werkbelasting/berekening'
import { FormulierDialoog, ongeldig } from '../werkbelasting/onderdelen'
import { formatDatum, getalAlsTekst, leesGetal, opNaam } from '../werkbelasting/opmaak'
import {
  INZETFASES,
  STATUSSEN,
  type Inzet,
  type InzetFase,
  type Jaarplan,
  type JaarplanFase,
  type Project,
  type Projectjaar,
  type ProjectStatus,
} from './api'
import { binnen, deelInJaar, jaarPeriode, leesBedrag, urenPerPersoon, urenPerWeek } from './berekening'

export function JaarplanFormulier({
  jaarplan,
  voorstelJaar,
  bestaand,
  onSluiten,
  onGelukt,
}: {
  jaarplan: Jaarplan | null
  /** Ingevuld jaar bij een nieuw jaarplan; standaard volgend jaar. */
  voorstelJaar?: number
  bestaand: number[]
  onSluiten: () => void
  onGelukt: (jaar: number) => void
}) {
  const { client } = useAuth()
  const [jaar, setJaar] = useState(String(jaarplan?.jaar ?? voorstelJaar ?? new Date().getFullYear() + 1))
  const [fase, setFase] = useState<JaarplanFase>(jaarplan?.fase ?? 'concept')
  const [proefjaar, setProefjaar] = useState(jaarplan?.proefjaar ?? false)

  async function opslaan() {
    const j = leesGetal(jaar)
    if (j === null || !Number.isInteger(j) || j < 2000 || j > 2100) return ongeldig('Vul een jaar in tussen 2000 en 2100.')
    if (!jaarplan && bestaand.includes(j)) return ongeldig(`Het jaarplan ${j} bestaat al.`)
    const res = await voerUit(client, 'jaarplan_opslaan', { p_jaar: j, p_fase: fase, p_proefjaar: proefjaar })
    if (res.ok) onGelukt(j)
    return res
  }

  return (
    <FormulierDialoog
      titel={jaarplan ? `Jaarplan ${jaarplan.jaar}` : 'Jaarplan toevoegen'}
      onOpslaan={opslaan}
      onSluiten={onSluiten}
      onGelukt={() => undefined}
    >
      {!jaarplan && <TextField label="Jaar" inputMode="numeric" value={jaar} onChange={(e) => setJaar(e.target.value)} />}
      <SelectField
        label="Fase"
        hint="Definitief maken komt later in een eigen stap."
        value={fase}
        opties={[
          { waarde: 'wensen', label: 'Wensen: specialisten dienen projecten in' },
          { waarde: 'concept', label: 'Concept: het MT stelt het jaarplan op' },
        ]}
        onChange={(e) => setFase(e.target.value as JaarplanFase)}
      />
      <Selectievakje
        label="Proefjaar: de app draait mee naast de Excel, die leidend blijft"
        checked={proefjaar}
        onChange={(e) => setProefjaar(e.target.checked)}
      />
    </FormulierDialoog>
  )
}

export function ProjectFormulier({
  project,
  jaar,
  afdelingen,
  takken,
  medewerkers,
  programmas,
  onSluiten,
  onGelukt,
}: {
  project: Project | null
  /** Bij een nieuw project: het jaarplan waar het in komt. */
  jaar: number | null
  afdelingen: Afdeling[]
  takken: Tak[]
  medewerkers: Medewerker[]
  programmas: Programma[]
  onSluiten: () => void
  onGelukt: (id: string) => void
}) {
  const { client } = useAuth()
  const standaard = jaar === null ? null : jaarPeriode(jaar)
  const [v, setV] = useState({
    naam: project?.naam ?? '',
    omschrijving: project?.omschrijving ?? '',
    afdeling_id: project?.afdeling_id ?? '',
    tak_id: project?.tak_id ?? '',
    indiener_id: project?.indiener_id ?? '',
    programma_id: project?.programma_id ?? '',
    startdatum: project?.startdatum ?? standaard?.startdatum ?? '',
    einddatum: project?.einddatum ?? standaard?.einddatum ?? '',
  })
  const zet = <K extends keyof typeof v>(veld: K, waarde: (typeof v)[K]) => setV((oud) => ({ ...oud, [veld]: waarde }))

  const takOpties = takken
    .filter((t) => t.afdeling_id === v.afdeling_id && (t.actief || t.id === project?.tak_id))
    .sort(opNaam)

  function kiesAfdeling(id: string) {
    setV((oud) => ({
      ...oud,
      afdeling_id: id,
      // Een tak hoort bij één afdeling.
      tak_id: takken.some((t) => t.id === oud.tak_id && t.afdeling_id === id) ? oud.tak_id : '',
    }))
  }

  async function opslaan() {
    if (!v.naam.trim()) return ongeldig('Vul een naam in.')
    if (!v.afdeling_id) return ongeldig('Kies een afdeling.')
    if (!v.startdatum || !v.einddatum) return ongeldig('Een project heeft altijd een begin- en een einddatum.')
    if (v.einddatum < v.startdatum) return ongeldig('De einddatum ligt vóór de begindatum.')
    if (jaar !== null && !deelInJaar(v, jaar)) return ongeldig(`De looptijd valt niet in ${jaar}.`)
    const res = await voerUit<string>(
      client,
      'project_opslaan',
      {
        p_id: project?.id ?? null,
        p_naam: v.naam,
        p_omschrijving: v.omschrijving,
        p_afdeling_id: v.afdeling_id,
        p_tak_id: v.tak_id || null,
        p_indiener_id: v.indiener_id || null,
        p_programma_id: v.programma_id || null,
        p_startdatum: v.startdatum,
        p_einddatum: v.einddatum,
        p_jaar: project ? null : jaar,
      },
      {
        '23514': 'De looptijd past niet bij de jaren of de inzet van het project. Pas eerst de inzet aan.',
        '23503': 'De tak hoort niet bij deze afdeling.',
      },
    )
    if (res.ok) onGelukt(res.data)
    return res
  }

  return (
    <FormulierDialoog
      titel={project ? 'Project wijzigen' : `Project toevoegen aan ${jaar}`}
      onOpslaan={opslaan}
      onSluiten={onSluiten}
      onGelukt={() => undefined}
    >
      <TextField label="Naam" autoComplete="off" maxLength={120} value={v.naam} onChange={(e) => zet('naam', e.target.value)} />
      <TextArea label="Omschrijving en doel" maxLength={2000} value={v.omschrijving} onChange={(e) => zet('omschrijving', e.target.value)} />
      <SelectField
        label="Afdeling"
        hint="De afdeling die het project trekt. Inzet kan ook van andere afdelingen komen."
        value={v.afdeling_id}
        opties={[
          { waarde: '', label: 'Kies een afdeling' },
          ...[...afdelingen].sort((a, b) => a.volgorde - b.volgorde).map((a) => ({ waarde: a.id, label: a.naam })),
        ]}
        onChange={(e) => kiesAfdeling(e.target.value)}
      />
      <SelectField
        label="Tak"
        value={v.tak_id}
        disabled={!v.afdeling_id}
        opties={[{ waarde: '', label: 'Geen tak' }, ...takOpties.map((t) => ({ waarde: t.id, label: t.naam }))]}
        onChange={(e) => zet('tak_id', e.target.value)}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Begindatum" type="date" value={v.startdatum} onChange={(e) => zet('startdatum', e.target.value)} />
        <TextField label="Einddatum" type="date" value={v.einddatum} onChange={(e) => zet('einddatum', e.target.value)} />
      </div>
      <SelectField
        label="Ingediend door"
        value={v.indiener_id}
        opties={[
          { waarde: '', label: 'Onbekend' },
          ...medewerkers
            .filter((m) => m.actief || m.id === project?.indiener_id)
            .sort(opNaam)
            .map((m) => ({ waarde: m.id, label: m.naam })),
        ]}
        onChange={(e) => zet('indiener_id', e.target.value)}
      />
      <SelectField
        label="Hoort bij programma"
        hint="Alleen als het project iets voor een programma ontwikkelt, zoals Ontwikkeling digilab 12+."
        value={v.programma_id}
        opties={[{ waarde: '', label: 'Geen programma' }, ...[...programmas].sort(opNaam).map((p) => ({ waarde: p.id, label: p.naam }))]}
        onChange={(e) => zet('programma_id', e.target.value)}
      />
    </FormulierDialoog>
  )
}

export function ProjectjaarFormulier({
  project,
  projectjaar,
  vrijeJaren,
  onSluiten,
  onGelukt,
}: {
  project: Project
  projectjaar: Projectjaar | null
  /** Bij een nieuw projectjaar: de jaarplannen waar het project nog in kan. */
  vrijeJaren: number[]
  onSluiten: () => void
  onGelukt: () => void
}) {
  const { client } = useAuth()
  const [jaar, setJaar] = useState(String(projectjaar?.jaar ?? vrijeJaren[0] ?? ''))
  const [status, setStatus] = useState<ProjectStatus>(projectjaar?.status ?? 'ingediend')
  const [budget, setBudget] = useState(getalAlsTekst(projectjaar?.budget))
  const [toelichting, setToelichting] = useState(projectjaar?.toelichting ?? '')

  async function opslaan() {
    if (!jaar) return ongeldig('Kies een jaarplan.')
    const bedrag = budget.trim() === '' ? null : leesBedrag(budget)
    if (budget.trim() !== '' && bedrag === null) return ongeldig('Vul een geldig bedrag in, of laat het leeg als het nog niet bekend is.')
    return voerUit(
      client,
      'projectjaar_opslaan',
      {
        p_id: projectjaar?.id ?? null,
        p_project_id: project.id,
        p_jaar: Number(jaar),
        p_status: status,
        p_budget: bedrag,
        p_toelichting: toelichting,
      },
      { '23505': 'Dit project staat al in dat jaarplan.', '23514': 'Dat jaar valt buiten de looptijd van het project.' },
    )
  }

  return (
    <FormulierDialoog
      titel={projectjaar ? `${project.naam} in ${projectjaar.jaar}` : 'In een ander jaarplan zetten'}
      onOpslaan={opslaan}
      onSluiten={onSluiten}
      onGelukt={onGelukt}
    >
      {!projectjaar && (
        <SelectField
          label="Jaarplan"
          value={jaar}
          opties={vrijeJaren.map((j) => ({ waarde: String(j), label: String(j) }))}
          onChange={(e) => setJaar(e.target.value)}
        />
      )}
      <SelectField
        label="Status"
        value={status}
        opties={STATUSSEN.map((s) => ({ waarde: s.waarde, label: s.label }))}
        onChange={(e) => setStatus(e.target.value as ProjectStatus)}
      />
      <TextField
        label="Budget in euro"
        hint="Voor dit jaar. Leeg laten als het nog niet bekend is; 0 als er geen budget nodig is."
        inputMode="decimal"
        autoComplete="off"
        value={budget}
        onChange={(e) => setBudget(e.target.value)}
      />
      <TextArea label="Toelichting" maxLength={2000} value={toelichting} onChange={(e) => setToelichting(e.target.value)} />
    </FormulierDialoog>
  )
}

export function InzetFormulier({
  inzet,
  projectjaar,
  project,
  functies,
  afdelingen,
  onSluiten,
  onGelukt,
}: {
  inzet: Inzet | null
  projectjaar: Projectjaar
  project: Project
  functies: Functie[]
  afdelingen: Afdeling[]
  onSluiten: () => void
  onGelukt: () => void
}) {
  const { client } = useAuth()
  const ruimte = deelInJaar(project, projectjaar.jaar)
  const [v, setV] = useState({
    functie_id: inzet?.functie_id ?? '',
    fase: inzet?.fase ?? ('uitvoering' as InzetFase),
    aantal: String(inzet?.aantal_collegas ?? 1),
    uren: getalAlsTekst(inzet?.uren),
    startdatum: inzet?.startdatum ?? ruimte?.startdatum ?? '',
    einddatum: inzet?.einddatum ?? ruimte?.einddatum ?? '',
  })
  const zet = <K extends keyof typeof v>(veld: K, waarde: (typeof v)[K]) => setV((oud) => ({ ...oud, [veld]: waarde }))

  const aantal = leesGetal(v.aantal)
  const uren = leesGetal(v.uren)
  const geldig =
    aantal !== null && aantal >= 1 && uren !== null && uren >= 0 && v.startdatum && v.einddatum && v.einddatum >= v.startdatum
  const uitleg = geldig
    ? `Per collega ${formatUren(urenPerPersoon({ uren, aantal_collegas: aantal }))} uur; gemiddeld ${formatUren(
        urenPerWeek({ uren, startdatum: v.startdatum, einddatum: v.einddatum }),
      )} uur per week voor alle collega’s samen.`
    : null

  async function opslaan() {
    if (!v.functie_id) return ongeldig('Kies een functie.')
    if (aantal === null || !Number.isInteger(aantal) || aantal < 1) return ongeldig('Vul een aantal collega’s in van 1 of meer.')
    if (uren === null || uren < 0) return ongeldig('Vul het totaal aantal uren in.')
    if (!v.startdatum || !v.einddatum || v.einddatum < v.startdatum) return ongeldig('Vul een geldige periode in.')
    if (!ruimte || !binnen(v, ruimte)) {
      return ongeldig(
        ruimte
          ? `De periode moet tussen ${formatDatum(ruimte.startdatum)} en ${formatDatum(ruimte.einddatum)} liggen: binnen ${projectjaar.jaar} en binnen de looptijd van het project.`
          : `Het project loopt niet in ${projectjaar.jaar}.`,
      )
    }
    return voerUit(
      client,
      'inzet_opslaan',
      {
        p_id: inzet?.id ?? null,
        p_projectjaar_id: projectjaar.id,
        p_functie_id: v.functie_id,
        p_fase: v.fase,
        p_aantal_collegas: aantal,
        p_uren: uren,
        p_startdatum: v.startdatum,
        p_einddatum: v.einddatum,
      },
      { '23514': 'De periode valt buiten het jaar of de looptijd van het project.' },
    )
  }

  return (
    <FormulierDialoog titel={inzet ? 'Inzet wijzigen' : 'Inzet toevoegen'} onOpslaan={opslaan} onSluiten={onSluiten} onGelukt={onGelukt}>
      <SelectField
        label="Functie"
        value={v.functie_id}
        opties={[{ waarde: '', label: 'Kies een functie' }, ...functieOpties(functies, afdelingen, inzet?.functie_id)]}
        onChange={(e) => zet('functie_id', e.target.value)}
      />
      <SelectField
        label="Fase"
        value={v.fase}
        opties={INZETFASES.map((f) => ({ waarde: f.waarde, label: f.label }))}
        onChange={(e) => zet('fase', e.target.value as InzetFase)}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Aantal collega’s" inputMode="numeric" value={v.aantal} onChange={(e) => zet('aantal', e.target.value)} />
        <TextField
          label="Uren totaal"
          hint="Voor alle collega’s samen."
          inputMode="decimal"
          value={v.uren}
          onChange={(e) => zet('uren', e.target.value)}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Van" type="date" value={v.startdatum} onChange={(e) => zet('startdatum', e.target.value)} />
        <TextField label="Tot en met" type="date" value={v.einddatum} onChange={(e) => zet('einddatum', e.target.value)} />
      </div>
      <p className="text-ui-sm text-neutral-700">
        De uren worden gelijk over de periode verdeeld. Een piek, zoals de uitvoering in één week, krijgt een eigen regel met een korte periode.
      </p>
      {uitleg && (
        <p role="status" className="text-ui-sm font-semibold">
          {uitleg}
        </p>
      )}
    </FormulierDialoog>
  )
}
