import type { Afdeling, Functie } from '../organisatie/api'
import type { Projectgroep } from '../werkbelasting/api'
import type { Momentopname, Project, ProjectStatus } from './api'
import { totaalUren, type Projectregel } from './berekening'
import { telMee } from './drukte'
import type { Werkblad } from './excel'
import { afdelingVan, leesRijen } from './voorstel'

/**
 * Definitief maken (fase 4): projectgroepen koppelen, afwijkingen na het
 * vaststellen en de vergelijking met de Excel in het proefjaar.
 */

const normaal = (tekst: string) => tekst.trim().toLocaleLowerCase('nl').replace(/\s+/g, ' ')

// -----------------------------------------------------------------------------
// Projectgroepen
// -----------------------------------------------------------------------------

/** Naam zonder jaartal aan het eind: "Dikke Pil 2027" en "Dikke Pil (2027)" → "dikke pil". */
const zonderJaar = (naam: string) => normaal(naam).replace(/\s*[-–(]?\s*\d{4}\s*\)?$/, '')

/**
 * Een bestaande, nog niet gekoppelde projectgroep die bij het project lijkt te
 * horen: dezelfde naam, op een jaartal na ("Dikke Pil" en "Dikke Pil 2027"), en
 * de looptijden overlappen. Anders null: dan komt er een nieuwe projectgroep.
 */
export function voorgesteldeProjectgroep(project: Project, projectgroepen: readonly Projectgroep[]): Projectgroep | null {
  const naam = zonderJaar(project.naam)
  return (
    projectgroepen.find((g) => {
      if (g.project_id) return false
      const lijkt = zonderJaar(g.naam) === naam
      const overlapt = g.startdatum <= project.einddatum && (g.einddatum === null || g.einddatum >= project.startdatum)
      return lijkt && overlapt
    }) ?? null
  )
}

export interface Controle {
  ingediend: Projectregel[]
  akkoordZonderInzet: Projectregel[]
  akkoordZonderBudget: Projectregel[]
}

/** Wat het MT vóór het definitief maken moet zien. */
export function controle(regels: readonly Projectregel[]): Controle {
  const akkoord = regels.filter((r) => r.projectjaar.status === 'akkoord')
  return {
    ingediend: regels.filter((r) => r.projectjaar.status === 'ingediend'),
    akkoordZonderInzet: akkoord.filter((r) => r.inzet.length === 0),
    akkoordZonderBudget: akkoord.filter((r) => r.projectjaar.budget === null),
  }
}

// -----------------------------------------------------------------------------
// Afwijkingen na het vaststellen
// -----------------------------------------------------------------------------

export type Afwijking =
  | { soort: 'nieuw'; projectId: string; naam: string; status: ProjectStatus }
  | { soort: 'weg'; projectId: string; naam: string }
  | { soort: 'status'; projectId: string; naam: string; was: ProjectStatus; nu: ProjectStatus }
  | { soort: 'budget'; projectId: string; naam: string; was: number | null; nu: number | null }
  | { soort: 'uren'; projectId: string; naam: string; was: number; nu: number }
  | { soort: 'inzet'; projectId: string; naam: string }

/** Een vingerafdruk van de inzet, om ook wijzigingen met gelijke uren te zien. */
function inzetSleutel(inzet: readonly { functie_id: string; fase: string; uren: number; startdatum: string; einddatum: string }[]): string {
  return inzet
    .map((i) => `${i.functie_id}|${i.fase}|${Number(i.uren).toFixed(1)}|${i.startdatum}|${i.einddatum}`)
    .sort()
    .join(';')
}

/** Verschillen tussen de momentopname en nu, per project. */
export function afwijkingen(momentopname: readonly Momentopname[], regels: readonly Projectregel[]): Afwijking[] {
  const uit: Afwijking[] = []
  const toen = new Map(momentopname.map((m) => [m.project_id, m]))
  for (const r of regels) {
    const m = toen.get(r.project.id)
    const basis = { projectId: r.project.id, naam: r.project.naam }
    if (!m) {
      uit.push({ soort: 'nieuw', ...basis, status: r.projectjaar.status })
      continue
    }
    if (m.status !== r.projectjaar.status) uit.push({ soort: 'status', ...basis, was: m.status, nu: r.projectjaar.status })
    const wasBudget = m.budget === null ? null : Number(m.budget)
    if (wasBudget !== r.projectjaar.budget) uit.push({ soort: 'budget', ...basis, was: wasBudget, nu: r.projectjaar.budget })
    const wasUren = m.inzet.reduce((s, i) => s + Number(i.uren), 0)
    const nuUren = totaalUren(r.inzet)
    if (Math.abs(wasUren - nuUren) > 0.05) uit.push({ soort: 'uren', ...basis, was: wasUren, nu: nuUren })
    else if (inzetSleutel(m.inzet) !== inzetSleutel(r.inzet)) uit.push({ soort: 'inzet', ...basis })
  }
  const nu = new Set(regels.map((r) => r.project.id))
  for (const m of momentopname) if (!nu.has(m.project_id)) uit.push({ soort: 'weg', projectId: m.project_id, naam: m.naam })
  return uit
}

// -----------------------------------------------------------------------------
// Vergelijking met de Excel (proefjaar)
// -----------------------------------------------------------------------------

export interface Vergelijkregel {
  afdeling: Afdeling
  /** "Budget", "Uren totaal" of een code uit de kolom "inzet van". */
  wat: string
  excel: number
  /** null: geen vergelijkbaar getal in de app (bijv. code MT). */
  app: number | null
}

/**
 * Per afdelingstabblad: budget en uren in de Excel naast die van de projecten
 * van die afdeling in de app (akkoord en ingediend). Per code uit "inzet van":
 * een functieafkorting (LMC) telt de uren van die functie, een afdelingscode
 * (LDV) de uren van functies van die afdeling.
 */
export function vergelijkMetExcel(
  bladen: readonly Werkblad[],
  regels: readonly Projectregel[],
  afdelingen: readonly Afdeling[],
  functies: readonly Functie[],
): Vergelijkregel[] {
  const uit: Vergelijkregel[] = []
  const meetellend = regels.filter((r) => telMee(r.projectjaar.status, 'actief'))
  const functie = new Map(functies.map((f) => [f.id, f]))
  const afdelingAfkorting = new Map(afdelingen.map((a) => [a.id, normaal(a.afkorting)]))

  for (const blad of bladen) {
    const afdeling = afdelingVan(blad, afdelingen)
    if (!afdeling) continue
    const rijen = leesRijen(blad)
    const budgetcellen = new Map<string, number>()
    for (const r of rijen) if (r.budgetcel && r.budget !== null) budgetcellen.set(r.budgetcel, r.budget)
    const perCode = new Map<string, number>()
    for (const r of rijen) {
      const code = r.inzetVan.trim().toUpperCase() || '(leeg)'
      perCode.set(code, (perCode.get(code) ?? 0) + r.weekuren)
    }

    const vanAfdeling = meetellend.filter((r) => r.project.afdeling_id === afdeling.id)
    const inzet = vanAfdeling.flatMap((r) => r.inzet)
    uit.push({
      afdeling,
      wat: 'Budget',
      excel: [...budgetcellen.values()].reduce((a, b) => a + b, 0),
      app: vanAfdeling.reduce((s, r) => s + (r.projectjaar.budget ?? 0), 0),
    })
    uit.push({
      afdeling,
      wat: 'Uren totaal',
      excel: [...perCode.values()].reduce((a, b) => a + b, 0),
      app: totaalUren(inzet),
    })
    for (const [code, excel] of [...perCode].sort(([a], [b]) => a.localeCompare(b))) {
      const c = normaal(code)
      const isFunctie = functies.some((f) => f.afkorting && normaal(f.afkorting) === c)
      const isAfdeling = afdelingen.some((a) => a.afkorting && normaal(a.afkorting) === c)
      const app = isFunctie
        ? totaalUren(inzet.filter((i) => normaal(functie.get(i.functie_id)?.afkorting ?? '') === c))
        : isAfdeling
          ? totaalUren(inzet.filter((i) => afdelingAfkorting.get(functie.get(i.functie_id)?.afdeling_id ?? '') === c))
          : null
      uit.push({ afdeling, wat: code, excel, app })
    }
  }
  return uit
}
