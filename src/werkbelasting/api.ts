import type { SupabaseClient } from '@supabase/supabase-js'
import type { Schoolsoort } from './berekening'

/**
 * Gegevens en databasefuncties van de werkbelasting. Lezen gaat rechtstreeks
 * (RLS bepaalt wat je ziet), wijzigen via de functies uit de migratie
 * werkbelasting. Foutmeldingen zijn vaste teksten op basis van de foutcode.
 */

export type { Schoolsoort }

export const SCHOOLSOORTEN: readonly { waarde: Schoolsoort; label: string }[] = [
  { waarde: 'PO', label: 'Primair onderwijs (PO)' },
  { waarde: 'VO', label: 'Voortgezet onderwijs (VO)' },
  { waarde: 'KDV', label: 'Kinderdagverblijf (KDV)' },
]

export interface Werkjaar {
  jaar: number
  werkweken: number
  mijmer_percentage: number
}

/** Een programma werkt met scholen (uren via de staffel) of met vaste uitvoerders. */
export type ProgrammaType = 'scholen' | 'uitvoerders'

export const PROGRAMMATYPES: readonly { waarde: ProgrammaType; label: string; uitleg: string }[] = [
  { waarde: 'scholen', label: 'Met scholen', uitleg: 'De uren komen uit de staffel van de scholen, zoals bij dBos en BoekStart.' },
  { waarde: 'uitvoerders', label: 'Met vaste uitvoerders', uitleg: 'Collega’s met een ureninschatting per jaar, zoals bij Digilabs.' },
]

export interface Programma {
  id: string
  naam: string
  omschrijving: string
  type: ProgrammaType
}

export interface StaffelSchijf {
  id: string
  jaar: number
  schoolsoort: Schoolsoort
  min_leerlingen: number
  max_leerlingen: number | null
  uren: number
}

export interface School {
  id: string
  naam: string
  soort: Schoolsoort
  programma_id: string
  brin: string | null
  matt_projectnummer: string
  adres: string
  postcode: string
  plaats: string
  contactpersoon: string
  email: string
  telefoon: string
  opmerking: string
  actief: boolean
}

export interface SchoolJaargegevens {
  school_id: string
  jaar: number
  leerlingaantal: number
  uren_correctie: number
  correctie_reden: string
}

export interface Medewerker {
  id: string
  naam: string
  email: string
  functie: string
  user_id: string | null
  actief: boolean
  opmerking: string
}

export interface Contract {
  id: string
  medewerker_id: string
  ingangsdatum: string
  uren_per_week: number
  werkweken: number | null
  mijmer_percentage: number | null
}

export interface Toewijzing {
  id: string
  school_id: string
  medewerker_id: string
  startdatum: string
  einddatum: string | null
}

export interface Projectgroep {
  id: string
  naam: string
  omschrijving: string
  startdatum: string
  einddatum: string | null
  trekker_id: string | null
}

export interface Deelnemer {
  id: string
  projectgroep_id: string
  medewerker_id: string
  uren_per_jaar: number
  startdatum: string
  einddatum: string | null
}

export interface Taak {
  id: string
  naam: string
  omschrijving: string
  startdatum: string
  einddatum: string | null
}

export interface TaakUitvoerder {
  id: string
  taak_id: string
  medewerker_id: string
  uren_per_jaar: number
  startdatum: string
  einddatum: string | null
}

/** Vaste uitvoerder van een programma met het type 'uitvoerders'. */
export interface ProgrammaUitvoerder {
  id: string
  programma_id: string
  medewerker_id: string
  uren_per_jaar: number
  startdatum: string
  einddatum: string | null
}

export interface ExtraUren {
  id: string
  medewerker_id: string
  jaar: number
  omschrijving: string
  uren: number
  financier: string
  school_id: string | null
}

/** Bij vaststellen bewaarde totalen, in uren per jaar. */
export interface Totalen {
  contracturen: number
  mijmertijd: number
  schooluren: number
  projecturen: number
  /** Ontbreekt bij vaststellingen van vóór de overige taken. */
  takenuren?: number
  /** Ontbreekt bij vaststellingen van vóór de programma-uitvoering. */
  uitvoeringsuren?: number
  overig: number
  extraTotaal: number
}

export interface Toelichting {
  medewerker_id: string
  jaar: number
  toelichting: string
  status: 'concept' | 'vastgesteld'
  vastgesteld_door: string | null
  vastgesteld_op: string | null
  totalen: Totalen | null
}

export type Resultaat<T> = { ok: true; data: T } | { ok: false; melding: string }

const ALGEMEEN = 'Dat lukt nu niet. Probeer het later opnieuw.'

const MELDINGEN: Record<string, string> = {
  '42501': 'Je hebt geen rechten om dit te wijzigen.',
  '23505': 'Dit bestaat al.',
  '23P01': 'Dit overlapt met een bestaande periode.',
  '23514': 'Een of meer waarden zijn ongeldig. Controleer het formulier.',
  '23503': 'Dit is nog in gebruik en kan niet worden verwijderd.',
  '23502': 'Vul alle verplichte velden in.',
  P0002: 'Dit bestaat niet meer. Ververs de pagina.',
}

export type Meldingen = Partial<Record<string, string>>

export function foutmelding(code: string | undefined, eigen: Meldingen = {}): string {
  if (!code) return ALGEMEEN
  return eigen[code] ?? MELDINGEN[code] ?? ALGEMEEN
}

type Tabel =
  | 'werkjaren'
  | 'programmas'
  | 'staffel_schijven'
  | 'scholen'
  | 'school_jaargegevens'
  | 'medewerkers'
  | 'contracten'
  | 'school_toewijzingen'
  | 'projectgroepen'
  | 'projectgroep_deelnemers'
  | 'extra_uren'
  | 'taken'
  | 'taak_uitvoerders'
  | 'programma_uitvoerders'
  | 'werkbelasting_toelichtingen'

/** Leest een hele tabel (voor zover RLS hem laat zien). */
export async function lees<T>(
  client: SupabaseClient,
  tabel: Tabel,
  volgorde: string,
  filter?: { kolom: string; waarde: string | number },
): Promise<Resultaat<T[]>> {
  let query = client.from(tabel).select('*')
  if (filter) query = query.eq(filter.kolom, filter.waarde)
  const { data, error } = await query.order(volgorde)
  if (error) return { ok: false, melding: 'Laden lukt nu niet. Probeer het later opnieuw.' }
  return { ok: true, data: (data ?? []) as T[] }
}

/** Roept een schrijffunctie aan. */
export async function voerUit<T = null>(
  client: SupabaseClient,
  functie: string,
  args: Record<string, unknown>,
  meldingen?: Meldingen,
): Promise<Resultaat<T>> {
  const { data, error } = await client.rpc(functie, args)
  if (error) return { ok: false, melding: foutmelding(error.code, meldingen) }
  return { ok: true, data: data as T }
}

export type VerwijderTabel =
  | 'programmas'
  | 'staffel_schijven'
  | 'scholen'
  | 'medewerkers'
  | 'contracten'
  | 'school_toewijzingen'
  | 'projectgroepen'
  | 'projectgroep_deelnemers'
  | 'extra_uren'
  | 'taken'
  | 'taak_uitvoerders'
  | 'programma_uitvoerders'

export function verwijder(
  client: SupabaseClient,
  tabel: VerwijderTabel,
  id: string,
  meldingen?: Meldingen,
): Promise<Resultaat<null>> {
  return voerUit(client, 'werkbelasting_verwijderen', { p_tabel: tabel, p_id: id }, meldingen)
}
