import type { SupabaseClient } from '@supabase/supabase-js'
import type { Resultaat, SchoolJaargegevens } from './api'

/**
 * Leerlingaantallen uit de open onderwijsdata van DUO (migraties duo_*). De
 * workflow "DUO ophalen" in GitHub Actions haalt ze elke maand op en levert ze
 * aan bij de Edge Function duo-verwerken. Werkjaar = peiljaar + 1: de telling van 1 oktober 2025
 * (gepubliceerd in januari 2026) hoort bij werkjaar 2026.
 */

export interface DuoTelling {
  vestigingscode: string
  peiljaar: number
  type_po: string
  /** null: 1 t/m 4 leerlingen, door DUO afgeschermd. */
  aantal: number | null
  opgehaald_op: string
}

export interface DuoRonde {
  id: number
  gestart_op: string
  /** null: automatisch (maandelijks). */
  door: string | null
  gelukt: boolean
  tellingen: number
  vestigingen: number
  ingevuld: number
  melding: string
}

export interface BrinVoorstel {
  school_id: string
  vestigingscode: string
  naam: string
  adres: string
  postcode: string
  plaats: string
  score: number
}

/** Hier start je het ophalen met de hand (Actions → DUO ophalen → Run workflow). */
export const DUO_WORKFLOW_URL = 'https://github.com/digilabbnwv/bnwv_programmering_app/actions/workflows/duo-ophalen.yml'

/** Het peiljaar van de telling die bij een werkjaar hoort. */
export function peiljaarBij(werkjaar: number): number {
  return werkjaar - 1
}

/** BRIN uit de app naar de vestigingscode van DUO: 4 tekens is de hoofdvestiging. */
export function duoCode(brin: string | null): string | null {
  if (!brin) return null
  return brin.length === 4 ? `${brin}00` : brin
}

/** Wat er bij een leerlingaantal over DUO te melden is. */
export type DuoStatus = { soort: 'duo' } | { soort: 'verschil'; aantal: number } | null

export function duoStatus(
  gegevens: Pick<SchoolJaargegevens, 'leerlingaantal' | 'van_duo'> | undefined,
  telling: DuoTelling | undefined,
): DuoStatus {
  if (gegevens?.van_duo) return { soort: 'duo' }
  if (!gegevens || !telling || telling.aantal === null) return null
  return gegevens.leerlingaantal === telling.aantal ? null : { soort: 'verschil', aantal: telling.aantal }
}

/**
 * Het voorstel dat vooraf gekozen staat: alleen als het duidelijk past (naam
 * én postcode of plaats) en duidelijk beter is dan het tweede.
 */
export function standaardKeuze(voorstellen: readonly BrinVoorstel[]): string {
  const [eerste, tweede] = [...voorstellen].sort((a, b) => b.score - a.score)
  if (!eerste || eerste.score < 1) return ''
  if (tweede && eerste.score - tweede.score < 0.2) return ''
  return eerste.vestigingscode
}

const moment = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Amsterdam',
})

/** "5 nov 2026 06:00" */
export function formatMoment(iso: string): string {
  return moment.format(new Date(iso))
}

function meervoud(n: number, enkel: string, meer: string): string {
  return `${n} ${n === 1 ? enkel : meer}`
}

/** Samenvatting van een ronde voor de gebruiker. */
export function rondeTekst(ronde: DuoRonde): string {
  if (!ronde.gelukt) return `Ophalen bij DUO is mislukt (${ronde.melding || 'onbekende fout'}). Er is niets gewijzigd.`
  const ingevuld =
    ronde.ingevuld === 0
      ? 'Er waren geen lege, overgenomen of gewijzigde aantallen om bij te werken.'
      : `${meervoud(ronde.ingevuld, 'aantal is', 'aantallen zijn')} ingevuld of bijgewerkt.`
  return `Opgehaald bij DUO: ${meervoud(ronde.tellingen, 'telling', 'tellingen')} en ${meervoud(ronde.vestigingen, 'vestiging', 'vestigingen')}. ${ingevuld}`
}

/** De laatste keer ophalen, of null als dat nog nooit is gebeurd. */
export async function laatsteRonde(client: SupabaseClient): Promise<Resultaat<DuoRonde | null>> {
  const { data, error } = await client
    .from('duo_ophaalrondes')
    .select('*')
    .order('gestart_op', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return { ok: false, melding: 'Laden lukt nu niet. Probeer het later opnieuw.' }
  return { ok: true, data: data as DuoRonde | null }
}

/** De tellingen van één peiljaar, of van één vestiging. */
export async function leesTellingen(
  client: SupabaseClient,
  filter: { peiljaar: number } | { vestigingscode: string },
): Promise<Resultaat<DuoTelling[]>> {
  const query = client.from('duo_leerlingaantallen').select('*')
  const { data, error } = await ('peiljaar' in filter
    ? query.eq('peiljaar', filter.peiljaar)
    : query.eq('vestigingscode', filter.vestigingscode)
  ).order('vestigingscode')
  if (error) return { ok: false, melding: 'Laden lukt nu niet. Probeer het later opnieuw.' }
  return { ok: true, data: (data ?? []) as DuoTelling[] }
}
