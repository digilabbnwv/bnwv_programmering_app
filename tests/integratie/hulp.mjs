/**
 * Hulpfuncties voor de integratietests tegen een lokale Supabase (alleen in
 * CI, zie .github/workflows/ci.yml).
 *
 * Omgeving: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DB_URL.
 */
import { createHmac } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const env = (naam) => {
  const waarde = process.env[naam]
  if (!waarde) throw new Error(`${naam} ontbreekt`)
  return waarde
}

export const URL = env('SUPABASE_URL')
export const ANON = env('SUPABASE_ANON_KEY')
const SERVICE = env('SUPABASE_SERVICE_ROLE_KEY')
const DB_URL = env('DB_URL')

const opties = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
export const nieuweClient = () => createClient(URL, ANON, opties)
export const serviceClient = () => createClient(URL, SERVICE, opties)

export function sql(query) {
  return execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-At', '-c', query], {
    encoding: 'utf8',
  }).trim()
}

export function claims(session) {
  return JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString('utf8'))
}

// RFC 6238 (TOTP, SHA-1, 30 seconden, 6 cijfers), zoals een authenticator-app.
export function totp(base32Secret, tijd = Date.now()) {
  const alfabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const teken of base32Secret.replace(/=+$/, '').toUpperCase()) {
    bits += alfabet.indexOf(teken).toString(2).padStart(5, '0')
  }
  const sleutel = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)))
  const teller = Buffer.alloc(8)
  teller.writeBigUInt64BE(BigInt(Math.floor(tijd / 1000 / 30)))
  const hmac = createHmac('sha1', sleutel).update(teller).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const getal = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return String(getal).padStart(6, '0')
}

// Een TOTP-code geldt 30 seconden. Weigert Auth de code (bijv. omdat dezelfde
// code net al gebruikt is), dan opnieuw met de code van het volgende venster.
export async function verifieer(c, factorId, secret) {
  const eerste = await c.auth.mfa.challengeAndVerify({ factorId, code: totp(secret) })
  if (!eerste.error) return eerste
  await new Promise((r) => setTimeout(r, 30_000 - (Date.now() % 30_000) + 1000))
  return c.auth.mfa.challengeAndVerify({ factorId, code: totp(secret) })
}

/** Roept een Edge Function aan met het token van de sessie. */
export async function functie(naam, session, body) {
  const res = await fetch(`${URL}/functions/v1/${naam}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: ANON,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

/**
 * Maakt een gebruiker met profiel en rol, zoals de eerste beheerder in de
 * README: account via de Auth-API, profiel en rol via SQL.
 */
export async function maakGebruiker(email, wachtwoord, rol, { tijdelijk = false, naam = email } = {}) {
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password: wachtwoord,
    email_confirm: true,
  })
  if (error) throw error
  const id = data.user.id
  sql(`insert into public.profiles (user_id, weergavenaam, must_change_password)
       values ('${id}', '${naam.replace(/'/g, "''")}', ${tijdelijk});
       insert into public.user_roles (user_id, role_id) values ('${id}', '${rol}');`)
  return id
}

/** Logt in, koppelt een authenticator-app en geeft een client op AAL2. */
export async function inloggenMet2fa(email, wachtwoord) {
  const client = nieuweClient()
  const { error } = await client.auth.signInWithPassword({ email, password: wachtwoord })
  if (error) throw error
  const { data: factor, error: enrollFout } = await client.auth.mfa.enroll({ factorType: 'totp' })
  if (enrollFout) throw enrollFout
  const { error: verifyFout } = await verifieer(client, factor.id, factor.totp.secret)
  if (verifyFout) throw verifyFout
  const { data } = await client.auth.getSession()
  return { client, session: data.session, factor }
}
