import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js'

/** Een rij uit public.list_users(). */
export interface Gebruiker {
  user_id: string
  email: string
  weergavenaam: string
  role_id: string | null
  is_active: boolean
  must_change_password: boolean
  heeft_2fa: boolean
  laatst_ingelogd: string | null
  aangemaakt: string
}

export interface Rol {
  id: string
  naam: string
}

export type BeheerActie =
  | { actie: 'aanmaken'; email: string; weergavenaam: string; rol: string }
  | { actie: 'rol_wijzigen'; userId: string; rol: string }
  | { actie: 'actief_zetten'; userId: string; actief: boolean }
  | { actie: 'wachtwoord_resetten'; userId: string }
  | { actie: '2fa_resetten'; userId: string }

export type Resultaat<T> = { ok: true; data: T } | { ok: false; melding: string }

const MELDINGEN: Record<string, string> = {
  geen_rechten: 'Je hebt geen rechten voor gebruikersbeheer.',
  geen_toegang: 'Je sessie is verlopen. Log opnieuw in.',
  niet_gevonden: 'Deze gebruiker bestaat niet meer. Ververs de pagina.',
  ongeldig_email: 'Vul een geldig e-mailadres in.',
  ongeldige_naam: 'Vul een naam in van maximaal 100 tekens.',
  ongeldige_rol: 'Kies een bestaande rol.',
  email_bestaat: 'Er is al een account met dit e-mailadres.',
  eigen_rol: 'Je kunt jezelf de beheerdersrol niet afnemen.',
  eigen_account: 'Dit kun je niet voor je eigen account doen. Vraag een andere beheerder.',
  laatste_beheerder: 'Er moet minstens één actieve beheerder blijven.',
}

const ALGEMEEN = 'Dat lukt nu niet. Probeer het later opnieuw.'

export function beheerMelding(code: string | undefined): string {
  return (code && MELDINGEN[code]) || ALGEMEEN
}

export async function beheer<T = { ok: true }>(
  client: SupabaseClient,
  actie: BeheerActie,
): Promise<Resultaat<T>> {
  const { data, error } = await client.functions.invoke<T>('admin-users', { body: actie })
  if (!error) return { ok: true, data: data as T }
  let code: string | undefined
  if (error instanceof FunctionsHttpError) {
    try {
      const body: unknown = await (error.context as Response).json()
      if (typeof body === 'object' && body !== null && 'code' in body) code = String(body.code)
    } catch {
      // Geen JSON: algemene melding.
    }
  }
  return { ok: false, melding: beheerMelding(code) }
}

export async function haalGebruikers(client: SupabaseClient): Promise<Resultaat<Gebruiker[]>> {
  const { data, error } = await client.rpc('list_users')
  if (error) return { ok: false, melding: 'Het overzicht laden lukt nu niet. Probeer het later opnieuw.' }
  return { ok: true, data: (data ?? []) as Gebruiker[] }
}

export async function haalRollen(client: SupabaseClient): Promise<Rol[]> {
  const { data } = await client.from('roles').select('id, naam').order('volgorde')
  return (data ?? []) as Rol[]
}

const datumTijd = new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' })

export function formatDatumTijd(waarde: string | null): string {
  return waarde ? datumTijd.format(new Date(waarde)) : 'Nog nooit'
}
