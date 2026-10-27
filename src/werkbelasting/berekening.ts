/**
 * Rekenmodel voor de werkurenverdeling per medewerker per kalenderjaar, zoals
 * de memo "Werkurenverdeling". Zie docs/werkbelasting.md voor de regels.
 *
 * Alles wat een periode heeft (contract, school, projectgroep) telt naar rato
 * van het aantal dagen in het jaar. Datums zijn ISO-strings (jjjj-mm-dd);
 * een einddatum is inclusief, null betekent lopend.
 */

export type Schoolsoort = 'PO' | 'VO' | 'KDV'

export interface Werkjaar {
  jaar: number
  werkweken: number
  mijmer_percentage: number
}

export interface Contract {
  ingangsdatum: string
  uren_per_week: number
  /** null: de waarde van het werkjaar */
  werkweken: number | null
  mijmer_percentage: number | null
}

export interface StaffelSchijf {
  jaar: number
  schoolsoort: Schoolsoort
  min_leerlingen: number
  /** null: geen bovengrens */
  max_leerlingen: number | null
  uren: number
}

export interface Periode {
  startdatum: string
  einddatum: string | null
}

export interface ProgrammaRef {
  id: string
  naam: string
}

export interface SchoolInzet extends Periode {
  schoolId: string
  naam: string
  soort: Schoolsoort
  /** null: de school valt onder geen programma. */
  programma: ProgrammaRef | null
  /** Gegevens van de school voor dit jaar; null als ze ontbreken. */
  jaargegevens: { leerlingaantal: number; uren_correctie: number } | null
}

export interface ProjectInzet extends Periode {
  projectgroepId: string
  naam: string
  uren_per_jaar: number
}

export interface TaakInzet extends Periode {
  taakId: string
  naam: string
  uren_per_jaar: number
}

export interface ExtraUren {
  omschrijving: string
  uren: number
  financier: string
}

export interface Invoer {
  werkjaar: Werkjaar
  contracten: readonly Contract[]
  staffel: readonly StaffelSchijf[]
  scholen: readonly SchoolInzet[]
  projecten: readonly ProjectInzet[]
  taken: readonly TaakInzet[]
  extraUren: readonly ExtraUren[]
}

export interface Regel {
  id: string
  naam: string
  /** Uren in dit jaar, naar rato van de periode. */
  jaaruren: number
  /** Uren voor een heel jaar, zonder naar rato. */
  volleJaaruren: number
  /** Aandeel van het jaar dat de regel geldt (0–1). */
  aandeel: number
  periode: Periode
}

export interface SchoolRegel extends Regel {
  programma: ProgrammaRef | null
}

/** Schooluren van één programma; programma null: scholen zonder programma. */
export interface ProgrammaUren {
  programma: ProgrammaRef | null
  uren: number
  /** Aantal verschillende scholen. */
  scholen: number
}

export type Signaal =
  | { soort: 'geen-contract' }
  | { soort: 'overbelast'; tekortUren: number }
  | { soort: 'school-zonder-gegevens'; schoolId: string; naam: string }
  | { soort: 'school-buiten-staffel'; schoolId: string; naam: string }

export interface Werkbelasting {
  jaar: number
  /** Werkweken in dit jaar, naar rato van de contractperiodes. */
  werkweken: number
  contracturen: number
  mijmertijd: number
  beschikbaar: number
  scholen: SchoolRegel[]
  schooluren: number
  /** Schooluren per programma, op naam; zonder programma als laatste. */
  programmas: ProgrammaUren[]
  projecten: Regel[]
  projecturen: number
  /** Overige taken met een eigen ureninschatting. */
  taken: Regel[]
  takenuren: number
  /** Nog niet ingevuld: beschikbaar − scholen − projecten − taken. Negatief: overbelast. */
  overig: number
  extraUren: ExtraUren[]
  extraTotaal: number
  /** Ten opzichte van de contracturen, zoals de memo. 0 zonder contracturen. */
  percentage: { scholen: number; projecten: number; taken: number; overig: number; mijmertijd: number }
  signalen: Signaal[]
}

const DAG_MS = 24 * 60 * 60 * 1000

function dagnummer(iso: string): number {
  const [j = NaN, m = NaN, d = NaN] = iso.split('-').map(Number)
  return Math.round(Date.UTC(j, m - 1, d) / DAG_MS)
}

export function dagenInJaar(jaar: number): number {
  return dagnummer(`${jaar + 1}-01-01`) - dagnummer(`${jaar}-01-01`)
}

/** Deel van het jaar (0–1) waarin de periode loopt. */
export function aandeelInJaar(periode: Periode, jaar: number): number {
  const jaarStart = dagnummer(`${jaar}-01-01`)
  const jaarEind = dagnummer(`${jaar}-12-31`)
  const start = Math.max(dagnummer(periode.startdatum), jaarStart)
  const eind = Math.min(periode.einddatum ? dagnummer(periode.einddatum) : jaarEind, jaarEind)
  if (eind < start) return 0
  return (eind - start + 1) / dagenInJaar(jaar)
}

/** Uren volgens de staffel, of null als het leerlingaantal in geen schijf valt. */
export function staffelUren(
  staffel: readonly StaffelSchijf[],
  jaar: number,
  soort: Schoolsoort,
  leerlingaantal: number,
): number | null {
  const schijf = staffel.find(
    (s) =>
      s.jaar === jaar &&
      s.schoolsoort === soort &&
      leerlingaantal >= s.min_leerlingen &&
      (s.max_leerlingen === null || leerlingaantal <= s.max_leerlingen),
  )
  return schijf ? schijf.uren : null
}

/** Contractperiodes: elk contract loopt tot de dag vóór het volgende. */
export function contractPeriodes<C extends Contract>(contracten: readonly C[]): (C & Periode)[] {
  const gesorteerd = [...contracten].sort((a, b) => a.ingangsdatum.localeCompare(b.ingangsdatum))
  return gesorteerd.map((c, i) => {
    const volgende = gesorteerd[i + 1]
    return {
      ...c,
      startdatum: c.ingangsdatum,
      einddatum: volgende ? dagErvoor(volgende.ingangsdatum) : null,
    }
  })
}

function dagErvoor(iso: string): string {
  return new Date((dagnummer(iso) - 1) * DAG_MS).toISOString().slice(0, 10)
}

export function berekenWerkbelasting(invoer: Invoer): Werkbelasting {
  const { werkjaar } = invoer
  const jaar = werkjaar.jaar
  const signalen: Signaal[] = []

  let werkweken = 0
  let contracturen = 0
  let mijmertijd = 0
  for (const c of contractPeriodes(invoer.contracten)) {
    const aandeel = aandeelInJaar(c, jaar)
    if (aandeel === 0) continue
    const weken = (c.werkweken ?? werkjaar.werkweken) * aandeel
    const uren = c.uren_per_week * weken
    werkweken += weken
    contracturen += uren
    mijmertijd += (uren * (c.mijmer_percentage ?? werkjaar.mijmer_percentage)) / 100
  }
  if (contracturen === 0) signalen.push({ soort: 'geen-contract' })
  const beschikbaar = contracturen - mijmertijd

  const scholen: SchoolRegel[] = []
  for (const s of invoer.scholen) {
    const aandeel = aandeelInJaar(s, jaar)
    if (aandeel === 0) continue
    let volleJaaruren = 0
    if (!s.jaargegevens) {
      signalen.push({ soort: 'school-zonder-gegevens', schoolId: s.schoolId, naam: s.naam })
    } else {
      const norm = staffelUren(invoer.staffel, jaar, s.soort, s.jaargegevens.leerlingaantal)
      if (norm === null) signalen.push({ soort: 'school-buiten-staffel', schoolId: s.schoolId, naam: s.naam })
      volleJaaruren = Math.max(0, (norm ?? 0) + s.jaargegevens.uren_correctie)
    }
    scholen.push({
      id: s.schoolId,
      naam: s.naam,
      volleJaaruren,
      aandeel,
      jaaruren: volleJaaruren * aandeel,
      periode: { startdatum: s.startdatum, einddatum: s.einddatum },
      programma: s.programma,
    })
  }

  const projecten = naarRato(
    invoer.projecten.map((p) => ({ ...p, id: p.projectgroepId })),
    jaar,
  )
  const taken = naarRato(
    invoer.taken.map((t) => ({ ...t, id: t.taakId })),
    jaar,
  )

  const schooluren = som(scholen.map((r) => r.jaaruren))
  const projecturen = som(projecten.map((r) => r.jaaruren))
  const takenuren = som(taken.map((r) => r.jaaruren))
  const overig = beschikbaar - schooluren - projecturen - takenuren
  // Afronden voorkomt een signaal door rekenruis.
  if (contracturen > 0 && overig < -0.05) signalen.push({ soort: 'overbelast', tekortUren: -overig })

  const extraUren = [...invoer.extraUren]
  const deel = (uren: number) => (contracturen > 0 ? (uren / contracturen) * 100 : 0)

  return {
    jaar,
    werkweken,
    contracturen,
    mijmertijd,
    beschikbaar,
    scholen,
    schooluren,
    programmas: perProgramma(scholen),
    projecten,
    projecturen,
    taken,
    takenuren,
    overig,
    extraUren,
    extraTotaal: som(extraUren.map((e) => e.uren)),
    percentage: {
      scholen: deel(schooluren),
      projecten: deel(projecturen),
      taken: deel(takenuren),
      overig: deel(overig),
      mijmertijd: deel(mijmertijd),
    },
    signalen,
  }
}

/** Regels met uren per jaar en een periode, naar rato van het jaar; buiten het jaar vallen ze weg. */
function naarRato(
  rijen: readonly (Periode & { id: string; naam: string; uren_per_jaar: number })[],
  jaar: number,
): Regel[] {
  return rijen.flatMap((r) => {
    const aandeel = aandeelInJaar(r, jaar)
    if (aandeel === 0) return []
    return [
      {
        id: r.id,
        naam: r.naam,
        volleJaaruren: r.uren_per_jaar,
        aandeel,
        jaaruren: r.uren_per_jaar * aandeel,
        periode: { startdatum: r.startdatum, einddatum: r.einddatum },
      },
    ]
  })
}

/** Schooluren opgeteld per programma, op naam; scholen zonder programma als laatste. */
export function perProgramma(scholen: readonly SchoolRegel[]): ProgrammaUren[] {
  const groepen = new Map<string | null, { programma: ProgrammaRef | null; uren: number; scholen: Set<string> }>()
  for (const s of scholen) {
    const sleutel = s.programma?.id ?? null
    const groep = groepen.get(sleutel) ?? { programma: s.programma, uren: 0, scholen: new Set<string>() }
    groep.uren += s.jaaruren
    groep.scholen.add(s.id)
    groepen.set(sleutel, groep)
  }
  return [...groepen.values()]
    .map((g) => ({ programma: g.programma, uren: g.uren, scholen: g.scholen.size }))
    .sort(programmaVolgorde)
}

/** Op programmanaam; "zonder programma" (null) als laatste. */
export function programmaVolgorde(a: { programma: ProgrammaRef | null }, b: { programma: ProgrammaRef | null }): number {
  if (!a.programma || !b.programma) return (a.programma ? 0 : 1) - (b.programma ? 0 : 1)
  return a.programma.naam.localeCompare(b.programma.naam, 'nl')
}

/** Uren per week, uitgaande van de werkweken van de medewerker in dit jaar. */
export function perWeek(uren: number, werkweken: number): number {
  return werkweken > 0 ? uren / werkweken : 0
}

function som(getallen: readonly number[]): number {
  return getallen.reduce((a, b) => a + b, 0)
}

const formatUrenNl = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const formatWeekNl = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 1504 → "1.504,0" */
export function formatUren(uren: number): string {
  return formatUrenNl.format(uren)
}

/** 14.893 → "14,89" */
export function formatPerWeek(uren: number): string {
  return formatWeekNl.format(uren)
}

/** 46.54 → "46,5%" */
export function formatPercentage(percentage: number): string {
  return `${formatUrenNl.format(percentage)}%`
}
