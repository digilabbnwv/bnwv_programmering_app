import type { SupabaseClient } from '@supabase/supabase-js'
import { voerUit, type Meldingen, type Resultaat } from '../werkbelasting/api'

/**
 * Jaarplannen, projecten, projectjaren en inzet (migratie projectplanner).
 * Lezen met projectplan.bekijken, wijzigen met projectplan.beheren.
 * Zie docs/projectplanner.md.
 */

export type JaarplanFase = 'wensen' | 'concept' | 'definitief' | 'afgesloten'

export const JAARPLANFASES: readonly { waarde: JaarplanFase; label: string; uitleg: string }[] = [
  { waarde: 'wensen', label: 'Wensen', uitleg: 'Specialisten dienen projecten in.' },
  { waarde: 'concept', label: 'Concept', uitleg: 'Het MT stelt het jaarplan op.' },
  { waarde: 'definitief', label: 'Definitief', uitleg: 'Vastgesteld door het MT.' },
  { waarde: 'afgesloten', label: 'Afgesloten', uitleg: 'Het jaar is voorbij.' },
]

export interface Jaarplan {
  jaar: number
  fase: JaarplanFase
  /** De app draait mee naast de Excel, die leidend is. */
  proefjaar: boolean
  vastgesteld_op: string | null
  vastgesteld_door_naam: string
  /** Bij definitief maken bewaard; null in concept. */
  momentopname: Momentopname[] | null
}

/** Een projectjaar zoals het was bij het definitief maken. */
export interface Momentopname {
  project_id: string
  naam: string
  afdeling_id: string
  status: ProjectStatus
  budget: number | null
  inzet: { functie_id: string; fase: InzetFase; uren: number; startdatum: string; einddatum: string }[]
}

export interface Project {
  id: string
  naam: string
  omschrijving: string
  afdeling_id: string
  tak_id: string | null
  indiener_id: string | null
  programma_id: string | null
  startdatum: string
  einddatum: string
}

export type ProjectStatus = 'ingediend' | 'akkoord' | 'afgewezen' | 'uitgesteld'

export const STATUSSEN: readonly { waarde: ProjectStatus; label: string }[] = [
  { waarde: 'ingediend', label: 'Ingediend' },
  { waarde: 'akkoord', label: 'Akkoord' },
  { waarde: 'uitgesteld', label: 'Uitgesteld' },
  { waarde: 'afgewezen', label: 'Afgewezen' },
]

export interface Projectjaar {
  id: string
  project_id: string
  jaar: number
  status: ProjectStatus
  /** null: nog niet bekend. */
  budget: number | null
  toelichting: string
}

export type InzetFase = 'voorbereiding' | 'uitvoering'

export const INZETFASES: readonly { waarde: InzetFase; label: string }[] = [
  { waarde: 'voorbereiding', label: 'Voorbereiding' },
  { waarde: 'uitvoering', label: 'Uitvoering' },
]

export interface Inzet {
  id: string
  projectjaar_id: string
  functie_id: string
  fase: InzetFase
  aantal_collegas: number
  /** Totaal voor alle collega's samen. */
  uren: number
  startdatum: string
  einddatum: string
}

export function verwijderProjectplan(
  client: SupabaseClient,
  tabel: 'projecten' | 'projectjaren' | 'projectjaar_inzet',
  id: string,
  meldingen?: Meldingen,
): Promise<Resultaat<null>> {
  return voerUit(client, 'projectplan_verwijderen', { p_tabel: tabel, p_id: id }, meldingen)
}

export const statusLabel = (status: ProjectStatus) => STATUSSEN.find((s) => s.waarde === status)?.label ?? status
export const faseLabel = (fase: JaarplanFase) => JAARPLANFASES.find((f) => f.waarde === fase)?.label ?? fase
export const inzetfaseLabel = (fase: InzetFase) => INZETFASES.find((f) => f.waarde === fase)?.label ?? fase
