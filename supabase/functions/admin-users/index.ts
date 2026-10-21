// Edge Function: gebruikersbeheer door een beheerder.
//
// Acties (POST, JSON met "actie"):
//   aanmaken            { email, weergavenaam, rol }  → { userId, tijdelijkWachtwoord }
//   rol_wijzigen        { userId, rol }
//   actief_zetten       { userId, actief }
//   wachtwoord_resetten { userId }                     → { tijdelijkWachtwoord }
//   2fa_resetten        { userId }
//
// Elke actie loopt via een databasefunctie (migratie gebruikersbeheer) die zelf
// controleert of de aanroeper gebruikers.beheren heeft, de regels voor
// beheerders afdwingt en de auditlog schrijft. Deze functie controleert vooraf
// het token (AAL2) en vertaalt fouten naar vaste codes voor de interface.
//
// Tijdelijke wachtwoorden maakt de functie zelf; ze komen één keer terug naar
// de beheerder, die ze persoonlijk doorgeeft. De app verstuurt geen e-mail.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'
import { adminClient, antwoord, ingelogdeGebruiker, serveer } from '../_shared/http.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ROL = /^[a-z][a-z0-9-]{1,39}$/

// Zonder tekens die op elkaar lijken (0/O, 1/l/I), want de beheerder geeft het
// wachtwoord mondeling of op papier door.
const KLEIN = 'abcdefghijkmnopqrstuvwxyz'
const GROOT = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const CIJFERS = '23456789'

function willekeurig(tekens: string): string {
  // Afwijzen boven het veelvoud, zodat elk teken even waarschijnlijk is.
  const grens = 256 - (256 % tekens.length)
  const buf = new Uint8Array(1)
  do crypto.getRandomValues(buf)
  while (buf[0] >= grens)
  return tekens[buf[0] % tekens.length]
}

/** 16 tekens in groepjes van 4, met minstens één kleine letter, hoofdletter en cijfer. */
export function tijdelijkWachtwoord(): string {
  const alle = KLEIN + GROOT + CIJFERS
  const tekens = [willekeurig(KLEIN), willekeurig(GROOT), willekeurig(CIJFERS)]
  while (tekens.length < 16) tekens.push(willekeurig(alle))
  // Fisher-Yates, zodat de verplichte tekens niet altijd vooraan staan.
  for (let i = tekens.length - 1; i > 0; i--) {
    const j = Number(crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1))
    ;[tekens[i], tekens[j]] = [tekens[j], tekens[i]]
  }
  return tekens.join('').match(/.{4}/g)!.join('-')
}

interface DbFout {
  code?: string
  message?: string
}

/** Vertaalt een fout van een beheerfunctie naar HTTP-status en vaste code. */
function dbFout(req: Request, fout: DbFout, context: string): Response {
  switch (fout.code) {
    case '42501':
      return antwoord(req, 403, { code: 'geen_rechten' })
    case 'P0002':
      return antwoord(req, 404, { code: 'niet_gevonden' })
    case '23503':
      return antwoord(req, 400, { code: 'ongeldige_rol' })
    case '23514':
      // Teksten uit private.guard_beheerders (migratie gebruikersbeheer).
      if (fout.message?.includes('beheerdersrol niet afnemen')) return antwoord(req, 409, { code: 'eigen_rol' })
      if (fout.message?.includes('eigen account niet deactiveren')) {
        return antwoord(req, 409, { code: 'eigen_account' })
      }
      if (fout.message?.includes('minstens één actieve beheerder')) {
        return antwoord(req, 409, { code: 'laatste_beheerder' })
      }
  }
  console.error(`${context}:`, fout.code, fout.message)
  return antwoord(req, 500, { code: 'serverfout' })
}

async function aanmaken(req: Request, admin: SupabaseClient, actor: string, body: Record<string, unknown>) {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const naam = typeof body.weergavenaam === 'string' ? body.weergavenaam.trim() : ''
  const rol = typeof body.rol === 'string' ? body.rol : ''
  if (!EMAIL.test(email) || email.length > 254) return antwoord(req, 400, { code: 'ongeldig_email' })
  if (naam.length < 1 || naam.length > 100) return antwoord(req, 400, { code: 'ongeldige_naam' })
  if (!ROL.test(rol)) return antwoord(req, 400, { code: 'ongeldige_rol' })

  // Eerst het recht controleren: anders ontstaat er een Auth-account zonder profiel.
  const { data: mag, error: magFout } = await admin.rpc('can_manage_users', { p_actor: actor })
  if (magFout) return dbFout(req, magFout, 'can_manage_users')
  if (mag !== true) return antwoord(req, 403, { code: 'geen_rechten' })

  const wachtwoord = tijdelijkWachtwoord()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: wachtwoord,
    email_confirm: true,
  })
  if (error || !data.user) {
    if (error?.code === 'email_exists') return antwoord(req, 409, { code: 'email_bestaat' })
    console.error('createUser:', error?.code, error?.status)
    return antwoord(req, 500, { code: 'serverfout' })
  }

  const { error: profielFout } = await admin.rpc('admin_create_profile', {
    p_actor: actor,
    p_user: data.user.id,
    p_weergavenaam: naam,
    p_role: rol,
  })
  if (profielFout) {
    // Terugdraaien: geen account zonder profiel en rol laten staan.
    const { error: verwijderFout } = await admin.auth.admin.deleteUser(data.user.id)
    if (verwijderFout) console.error('deleteUser na mislukt profiel:', verwijderFout.code)
    return dbFout(req, profielFout, 'admin_create_profile')
  }

  return antwoord(req, 200, { userId: data.user.id, tijdelijkWachtwoord: wachtwoord })
}

async function wachtwoordResetten(req: Request, admin: SupabaseClient, actor: string, userId: string) {
  // Eerst de databasefunctie: die controleert het recht, zet must_change_password,
  // trekt de sessies in en schrijft de auditlog. Pas daarna het wachtwoord.
  const { error } = await admin.rpc('admin_reset_password', { p_actor: actor, p_user: userId })
  if (error) return dbFout(req, error, 'admin_reset_password')

  const wachtwoord = tijdelijkWachtwoord()
  const { error: updateFout } = await admin.auth.admin.updateUserById(userId, { password: wachtwoord })
  if (updateFout) {
    console.error('updateUserById:', updateFout.code, updateFout.status)
    return antwoord(req, 500, { code: 'serverfout' })
  }
  return antwoord(req, 200, { tijdelijkWachtwoord: wachtwoord })
}

serveer(async (req) => {
  const admin = adminClient()
  if (!admin) return antwoord(req, 500, { code: 'configuratie' })

  const gebruiker = await ingelogdeGebruiker(req, admin)
  if ('fout' in gebruiker) return gebruiker.fout
  const actor = gebruiker.userId

  let body: Record<string, unknown>
  try {
    const json: unknown = await req.json()
    if (typeof json !== 'object' || json === null) throw new Error('geen object')
    body = json as Record<string, unknown>
  } catch {
    return antwoord(req, 400, { code: 'ongeldig' })
  }

  if (body.actie === 'aanmaken') return aanmaken(req, admin, actor, body)

  const userId = typeof body.userId === 'string' && UUID.test(body.userId) ? body.userId : null
  if (!userId) return antwoord(req, 400, { code: 'ongeldig' })

  switch (body.actie) {
    case 'rol_wijzigen': {
      if (typeof body.rol !== 'string' || !ROL.test(body.rol)) return antwoord(req, 400, { code: 'ongeldige_rol' })
      const { error } = await admin.rpc('admin_set_role', { p_actor: actor, p_user: userId, p_role: body.rol })
      return error ? dbFout(req, error, 'admin_set_role') : antwoord(req, 200, { ok: true })
    }
    case 'actief_zetten': {
      if (typeof body.actief !== 'boolean') return antwoord(req, 400, { code: 'ongeldig' })
      const { error } = await admin.rpc('admin_set_active', {
        p_actor: actor,
        p_user: userId,
        p_active: body.actief,
      })
      return error ? dbFout(req, error, 'admin_set_active') : antwoord(req, 200, { ok: true })
    }
    case 'wachtwoord_resetten':
      // Je eigen wachtwoord of 2FA reset je niet zo: dan sluit je jezelf buiten.
      if (userId === actor) return antwoord(req, 409, { code: 'eigen_account' })
      return wachtwoordResetten(req, admin, actor, userId)
    case '2fa_resetten': {
      if (userId === actor) return antwoord(req, 409, { code: 'eigen_account' })
      const { error } = await admin.rpc('admin_reset_mfa', { p_actor: actor, p_user: userId })
      return error ? dbFout(req, error, 'admin_reset_mfa') : antwoord(req, 200, { ok: true })
    }
    default:
      return antwoord(req, 400, { code: 'ongeldig' })
  }
})
