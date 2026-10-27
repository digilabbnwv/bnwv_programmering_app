import type { SupabaseClient } from '@supabase/supabase-js'
import {
  lees,
  type Contract,
  type Deelnemer,
  type ExtraUren,
  type Medewerker,
  type Programma,
  type ProgrammaUitvoerder,
  type Projectgroep,
  type Resultaat,
  type School,
  type SchoolJaargegevens,
  type StaffelSchijf,
  type Taak,
  type TaakUitvoerder,
  type Toelichting,
  type Toewijzing,
  type Totalen,
  type Werkjaar,
} from './api'
import {
  aandeelInJaar,
  berekenWerkbelasting,
  formatPercentage,
  formatPerWeek,
  formatUren,
  perWeek,
  programmaVolgorde,
  type Invoer,
  type ProgrammaRef,
  type Werkbelasting,
} from './berekening'
import { alles } from './useGegevens'

/**
 * Alle gegevens voor de rapportage van één jaar. RLS bepaalt wat erin zit:
 * een medewerker krijgt alleen de eigen rijen, werkbelasting.bekijken alles.
 */
export interface Rapportagegegevens {
  werkjaren: Werkjaar[]
  medewerkers: Medewerker[]
  contracten: Contract[]
  scholen: School[]
  programmas: Programma[]
  jaargegevens: SchoolJaargegevens[]
  staffel: StaffelSchijf[]
  toewijzingen: Toewijzing[]
  projectgroepen: Projectgroep[]
  deelnemers: Deelnemer[]
  taken: Taak[]
  uitvoerders: TaakUitvoerder[]
  programmaUitvoerders: ProgrammaUitvoerder[]
  extraUren: ExtraUren[]
  toelichtingen: Toelichting[]
}

export async function laadRapportage(client: SupabaseClient, jaar: number): Promise<Resultaat<Rapportagegegevens>> {
  const jaarFilter = { kolom: 'jaar', waarde: jaar }
  const res = alles<
    [
      Werkjaar[],
      Medewerker[],
      Contract[],
      School[],
      Programma[],
      SchoolJaargegevens[],
      StaffelSchijf[],
      Toewijzing[],
      Projectgroep[],
      Deelnemer[],
      Taak[],
      TaakUitvoerder[],
      ProgrammaUitvoerder[],
      ExtraUren[],
      Toelichting[],
    ]
  >(
    await Promise.all([
      lees<Werkjaar>(client, 'werkjaren', 'jaar'),
      lees<Medewerker>(client, 'medewerkers', 'naam'),
      lees<Contract>(client, 'contracten', 'ingangsdatum'),
      lees<School>(client, 'scholen', 'naam'),
      lees<Programma>(client, 'programmas', 'naam'),
      lees<SchoolJaargegevens>(client, 'school_jaargegevens', 'school_id', jaarFilter),
      lees<StaffelSchijf>(client, 'staffel_schijven', 'min_leerlingen', jaarFilter),
      lees<Toewijzing>(client, 'school_toewijzingen', 'startdatum'),
      lees<Projectgroep>(client, 'projectgroepen', 'naam'),
      lees<Deelnemer>(client, 'projectgroep_deelnemers', 'startdatum'),
      lees<Taak>(client, 'taken', 'naam'),
      lees<TaakUitvoerder>(client, 'taak_uitvoerders', 'startdatum'),
      lees<ProgrammaUitvoerder>(client, 'programma_uitvoerders', 'startdatum'),
      lees<ExtraUren>(client, 'extra_uren', 'omschrijving', jaarFilter),
      lees<Toelichting>(client, 'werkbelasting_toelichtingen', 'medewerker_id', jaarFilter),
    ]),
  )
  if (!res.ok) return res
  const [
    werkjaren,
    medewerkers,
    contracten,
    scholen,
    programmas,
    jaargegevens,
    staffel,
    toewijzingen,
    projectgroepen,
    deelnemers,
    taken,
    uitvoerders,
    programmaUitvoerders,
    extraUren,
    toelichtingen,
  ] = res.data
  return {
    ok: true,
    data: {
      werkjaren,
      medewerkers,
      contracten,
      scholen,
      programmas,
      jaargegevens,
      staffel,
      toewijzingen,
      projectgroepen,
      deelnemers,
      taken,
      uitvoerders,
      programmaUitvoerders,
      extraUren,
      toelichtingen,
    },
  }
}

/** De invoer voor het rekenmodel van één medewerker. */
export function bouwInvoer(g: Rapportagegegevens, medewerkerId: string, werkjaar: Werkjaar): Invoer {
  const jaar = werkjaar.jaar
  return {
    werkjaar,
    contracten: g.contracten.filter((c) => c.medewerker_id === medewerkerId),
    staffel: g.staffel.filter((s) => s.jaar === jaar),
    scholen: g.toewijzingen
      .filter((t) => t.medewerker_id === medewerkerId)
      .flatMap((t) => {
        const school = g.scholen.find((s) => s.id === t.school_id)
        const programma = g.programmas.find((p) => p.id === school?.programma_id)
        if (!school || !programma) return []
        const jg = g.jaargegevens.find((j) => j.school_id === school.id && j.jaar === jaar)
        return [
          {
            schoolId: school.id,
            naam: school.naam,
            soort: school.soort,
            programma: { id: programma.id, naam: programma.naam },
            jaargegevens: jg ? { leerlingaantal: jg.leerlingaantal, uren_correctie: jg.uren_correctie } : null,
            startdatum: t.startdatum,
            einddatum: t.einddatum,
          },
        ]
      }),
    uitvoering: g.programmaUitvoerders
      .filter((u) => u.medewerker_id === medewerkerId)
      .flatMap((u) => {
        const programma = g.programmas.find((p) => p.id === u.programma_id)
        if (!programma) return []
        return [
          {
            uitvoerderId: u.id,
            programma: { id: programma.id, naam: programma.naam },
            uren_per_jaar: u.uren_per_jaar,
            startdatum: u.startdatum,
            einddatum: u.einddatum,
          },
        ]
      }),
    projecten: g.deelnemers
      .filter((d) => d.medewerker_id === medewerkerId)
      .flatMap((d) => {
        const groep = g.projectgroepen.find((p) => p.id === d.projectgroep_id)
        if (!groep) return []
        return [
          {
            projectgroepId: groep.id,
            naam: groep.naam,
            uren_per_jaar: d.uren_per_jaar,
            startdatum: d.startdatum,
            einddatum: d.einddatum,
          },
        ]
      }),
    taken: g.uitvoerders
      .filter((u) => u.medewerker_id === medewerkerId)
      .flatMap((u) => {
        const taak = g.taken.find((t) => t.id === u.taak_id)
        if (!taak) return []
        return [{ taakId: taak.id, naam: taak.naam, uren_per_jaar: u.uren_per_jaar, startdatum: u.startdatum, einddatum: u.einddatum }]
      }),
    extraUren: g.extraUren
      .filter((e) => e.medewerker_id === medewerkerId && e.jaar === jaar)
      .map((e) => ({ omschrijving: e.omschrijving, uren: e.uren, financier: e.financier })),
  }
}

export interface Rij {
  medewerker: Medewerker
  werkbelasting: Werkbelasting
  toelichting: Toelichting | null
  gewijzigdNaVaststellen: boolean
}

/** Een rij per medewerker die in dit jaar een contract of inzet heeft (of actief is). */
export function teamRijen(g: Rapportagegegevens, werkjaar: Werkjaar): Rij[] {
  return g.medewerkers
    .map((medewerker) => {
      const werkbelasting = berekenWerkbelasting(bouwInvoer(g, medewerker.id, werkjaar))
      const toelichting = g.toelichtingen.find((t) => t.medewerker_id === medewerker.id && t.jaar === werkjaar.jaar) ?? null
      return {
        medewerker,
        werkbelasting,
        toelichting,
        gewijzigdNaVaststellen: isGewijzigd(toelichting, werkbelasting),
      }
    })
    .filter(
      ({ medewerker, werkbelasting: w }) =>
        medewerker.actief ||
        w.contracturen > 0 ||
        w.scholen.length > 0 ||
        w.uitvoering.length > 0 ||
        w.projecten.length > 0 ||
        w.taken.length > 0,
    )
    .sort((a, b) => a.medewerker.naam.localeCompare(b.medewerker.naam, 'nl'))
}

/** Uren van het hele team per programma: schooluren en programma-uitvoering samen. */
export interface TeamProgramma {
  programma: ProgrammaRef
  uren: number
  scholen: number
  medewerkers: number
}

export function teamProgrammas(rijen: readonly Rij[]): TeamProgramma[] {
  type Groep = { programma: ProgrammaRef; uren: number; scholen: Set<string>; medewerkers: Set<string> }
  const groepen = new Map<string, Groep>()
  for (const { medewerker, werkbelasting } of rijen) {
    const regels = [
      ...werkbelasting.scholen.map((r) => ({ r, school: true })),
      ...werkbelasting.uitvoering.map((r) => ({ r, school: false })),
    ]
    for (const { r, school } of regels) {
      const groep = groepen.get(r.programma.id) ?? { programma: r.programma, uren: 0, scholen: new Set(), medewerkers: new Set() }
      groep.uren += r.jaaruren
      if (school) groep.scholen.add(r.id)
      groep.medewerkers.add(medewerker.id)
      groepen.set(r.programma.id, groep)
    }
  }
  return [...groepen.values()]
    .map((g) => ({ programma: g.programma, uren: g.uren, scholen: g.scholen.size, medewerkers: g.medewerkers.size }))
    .sort(programmaVolgorde)
}

export function totalenVan(w: Werkbelasting): Totalen {
  const rond = (n: number) => Math.round(n * 10) / 10
  return {
    contracturen: rond(w.contracturen),
    mijmertijd: rond(w.mijmertijd),
    schooluren: rond(w.schooluren),
    uitvoeringsuren: rond(w.uitvoeringsuren),
    projecturen: rond(w.projecturen),
    takenuren: rond(w.takenuren),
    overig: rond(w.overig),
    extraTotaal: rond(w.extraTotaal),
  }
}

/** Wijken de huidige uren af van wat er bij het vaststellen bewaard is? */
export function isGewijzigd(toelichting: Toelichting | null, w: Werkbelasting): boolean {
  if (toelichting?.status !== 'vastgesteld' || !toelichting.totalen) return false
  const nu = totalenVan(w)
  const toen = toelichting.totalen
  return (Object.keys(nu) as (keyof Totalen)[]).some((k) => Math.abs((nu[k] ?? 0) - (toen[k] ?? 0)) >= 0.05)
}

export type Teamsignaal =
  | { soort: 'school-zonder-medewerker'; schoolId: string; naam: string; aandeelZonder: number }
  | { soort: 'projectgroep-zonder-deelnemers'; projectgroepId: string; naam: string }
  | { soort: 'taak-zonder-uitvoerders'; taakId: string; naam: string }

/** Signalen over het hele team: scholen of projectgroepen die (deels) niemand hebben. */
export function teamSignalen(g: Rapportagegegevens, jaar: number): Teamsignaal[] {
  const signalen: Teamsignaal[] = []
  for (const school of g.scholen) {
    if (!school.actief) continue
    const gedekt = g.toewijzingen
      .filter((t) => t.school_id === school.id)
      .reduce((som, t) => som + aandeelInJaar(t, jaar), 0)
    if (gedekt < 0.999) {
      signalen.push({ soort: 'school-zonder-medewerker', schoolId: school.id, naam: school.naam, aandeelZonder: 1 - gedekt })
    }
  }
  for (const groep of g.projectgroepen) {
    if (aandeelInJaar(groep, jaar) === 0) continue
    const heeftDeelnemers = g.deelnemers.some((d) => d.projectgroep_id === groep.id && aandeelInJaar(d, jaar) > 0)
    if (!heeftDeelnemers) signalen.push({ soort: 'projectgroep-zonder-deelnemers', projectgroepId: groep.id, naam: groep.naam })
  }
  for (const taak of g.taken) {
    if (aandeelInJaar(taak, jaar) === 0) continue
    const heeftUitvoerders = g.uitvoerders.some((u) => u.taak_id === taak.id && aandeelInJaar(u, jaar) > 0)
    if (!heeftUitvoerders) signalen.push({ soort: 'taak-zonder-uitvoerders', taakId: taak.id, naam: taak.naam })
  }
  return signalen.sort((a, b) => a.naam.localeCompare(b.naam, 'nl'))
}

/** De lopende tekst van de memo, met de getallen erin. */
export function memoTeksten(naam: string, w: Werkbelasting): { inleiding: string; conclusie: string } {
  const weken = formatUren(w.werkweken).replace(/,0$/, '')
  const urenPerWeek = formatPerWeek(perWeek(w.contracturen, w.werkweken)).replace(/,00$/, '')
  const mijmer = formatPercentage(w.contracturen > 0 ? (w.mijmertijd / w.contracturen) * 100 : 0).replace(/,0%$/, '%')
  const beschikbaar = formatPercentage(w.contracturen > 0 ? (w.beschikbaar / w.contracturen) * 100 : 0).replace(/,0%$/, '%')

  const inleiding =
    w.contracturen > 0
      ? `In dit overzicht wordt de beschikbare inzet van ${naam} voor ${w.jaar} inzichtelijk gemaakt. De berekening is ` +
        `gebaseerd op een contractomvang van gemiddeld ${urenPerWeek} uur per week en ${weken} werkweken. Conform de ` +
        `organisatiebrede uitgangspunten wordt ${mijmer} van de contracturen gereserveerd voor mijmertijd en is ` +
        `${beschikbaar} beschikbaar voor programma-uitvoering, projecten en overige werkzaamheden.`
      : `Voor ${naam} is in ${w.jaar} geen contract vastgelegd. Zonder contracturen kan de verdeling niet worden berekend.`

  const vrij = w.overig
  const conclusie =
    w.contracturen === 0
      ? ''
      : `Van de totale contractomvang wordt ${formatPercentage(w.percentage.scholen)} ingezet op de scholen, ` +
        (w.uitvoering.length > 0 ? `${formatPercentage(w.percentage.uitvoering)} aan programma-uitvoering, ` : '') +
        `${formatPercentage(w.percentage.projecten)} in projectgroepen en ` +
        `${formatPercentage(w.percentage.taken)} aan overige taken. ` +
        (vrij >= 0
          ? `Nog niet ingevuld is ${formatUren(vrij)} uur per jaar, gemiddeld ` +
            `${formatPerWeek(perWeek(vrij, w.werkweken))} uur per week. `
          : `De inzet is ${formatUren(-vrij)} uur per jaar hoger dan de beschikbare werktijd ` +
            `(gemiddeld ${formatPerWeek(perWeek(-vrij, w.werkweken))} uur per week te veel). `) +
        `Daarnaast blijft ${formatUren(w.mijmertijd)} uur per jaar gereserveerd voor mijmertijd.`

  return { inleiding, conclusie }
}
