/**
 * Integratietest van de inlogflow tegen een lokale Supabase (alleen in CI,
 * zie .github/workflows/ci.yml). Anders dan de pgTAP-tests gaat dit door de
 * echte Supabase Auth: inloggen, de access token hook, 2FA (TOTP), de Edge
 * Function wachtwoord-wijzigen en het weigeren van gedeactiveerde accounts.
 *
 * Omgeving: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DB_URL.
 */
import { createHmac } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const env = (naam) => {
  const waarde = process.env[naam]
  if (!waarde) throw new Error(`${naam} ontbreekt`)
  return waarde
}

const URL = env('SUPABASE_URL')
const ANON = env('SUPABASE_ANON_KEY')
const SERVICE = env('SUPABASE_SERVICE_ROLE_KEY')
const DB_URL = env('DB_URL')

const EMAIL = 'integratie@test.nl'
const TIJDELIJK = 'Tijdelijk-Wachtwoord-1'
const NIEUW = 'Eigen-Wachtwoord-2026'
const FOUT = 'Fout-Wachtwoord-1'
const REGISTRATIE = 'Sterk-Wachtwoord-1'

const opties = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const nieuweClient = () => createClient(URL, ANON, opties)

function sql(query) {
  return execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-At', '-c', query], {
    encoding: 'utf8',
  }).trim()
}

function claims(session) {
  return JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString('utf8'))
}

// RFC 6238 (TOTP, SHA-1, 30 seconden, 6 cijfers), zoals een authenticator-app.
function totp(base32Secret, tijd = Date.now()) {
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

async function wijzigWachtwoord(session, wachtwoord) {
  const res = await fetch(`${URL}/functions/v1/wachtwoord-wijzigen`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: ANON,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ wachtwoord }),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

// Een TOTP-code geldt 30 seconden. Weigert Auth de code (bijv. omdat dezelfde
// code net al gebruikt is), dan opnieuw met de code van het volgende venster.
async function verifieer(c, factorId, secret) {
  const eerste = await c.auth.mfa.challengeAndVerify({ factorId, code: totp(secret) })
  if (!eerste.error) return eerste
  await new Promise((r) => setTimeout(r, 30_000 - (Date.now() % 30_000) + 1000))
  return c.auth.mfa.challengeAndVerify({ factorId, code: totp(secret) })
}

describe('inlogflow met echte Supabase Auth', () => {
  let client = nieuweClient()
  let userId
  let factor

  beforeAll(async () => {
    const admin = createClient(URL, SERVICE, opties)
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: TIJDELIJK,
      email_confirm: true,
    })
    if (error) throw error
    userId = data.user.id
    // Zoals de eerste beheerder in de README: profiel en rol via SQL.
    sql(`insert into public.profiles (user_id, weergavenaam, must_change_password)
         values ('${userId}', 'Integratietest', true);
         insert into public.user_roles (user_id, role_id) values ('${userId}', 'medewerker');`)
  })

  it('weigert registreren: alleen een beheerder maakt accounts aan', async () => {
    const { error } = await nieuweClient().auth.signUp({ email: 'nieuw@test.nl', password: REGISTRATIE })
    expect(error?.code).toBe('signup_disabled')
  })

  it('weigert een verkeerd wachtwoord', async () => {
    const { error } = await nieuweClient().auth.signInWithPassword({ email: EMAIL, password: FOUT })
    expect(error?.code).toBe('invalid_credentials')
  })

  it('zet na inloggen met wachtwoord rol en status in het token (AAL1)', async () => {
    const { data, error } = await client.auth.signInWithPassword({ email: EMAIL, password: TIJDELIJK })
    expect(error).toBeNull()
    const c = claims(data.session)
    expect(c.aal).toBe('aal1')
    expect(c.user_role).toBe('medewerker')
    expect(c.is_active).toBe(true)
    expect(c.must_change_password).toBe(true)
  })

  it('geeft zonder 2FA geen data en mag het wachtwoord niet wijzigen', async () => {
    const { data } = await client.from('profiles').select('user_id')
    expect(data).toEqual([])
    const { data: s } = await client.auth.getSession()
    expect((await wijzigWachtwoord(s.session, NIEUW)).status).toBe(403)
  })

  it('koppelt een authenticator-app en komt daarmee op AAL2', async () => {
    const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Test' })
    expect(error).toBeNull()
    factor = data
    expect(factor.totp.qr_code).toMatch(/^data:image\/svg\+xml/)

    const fout = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code: '000000' })
    expect(fout.error?.code).toBe('mfa_verification_failed')

    const { error: verifyFout } = await verifieer(client, factor.id, factor.totp.secret)
    expect(verifyFout).toBeNull()
    const { data: s } = await client.auth.getSession()
    expect(claims(s.session).aal).toBe('aal2')
  })

  it('geeft met een tijdelijk wachtwoord alleen het eigen profiel', async () => {
    const { data: profielen } = await client.from('profiles').select('user_id')
    expect(profielen).toEqual([{ user_id: userId }])
    const { data: rollen } = await client.from('roles').select('id')
    expect(rollen).toEqual([])
  })

  it('weigert een zwak wachtwoord', async () => {
    const { data: s } = await client.auth.getSession()
    const res = await wijzigWachtwoord(s.session, 'kortwachtwoord')
    expect(res).toEqual({ status: 400, body: { code: 'zwak_wachtwoord' } })
  })

  it('wijzigt het wachtwoord één keer en beëindigt daarna de sessies', async () => {
    const { data: s } = await client.auth.getSession()
    expect(await wijzigWachtwoord(s.session, NIEUW)).toEqual({ status: 200, body: { ok: true } })
    expect((await wijzigWachtwoord(s.session, 'Nog-Een-Wachtwoord-3')).status).toBe(409)

    // Supabase Auth trekt bij een nieuw wachtwoord alle sessies in: opnieuw inloggen.
    const { error } = await client.auth.refreshSession()
    expect(error?.code).toBe('refresh_token_not_found')
  })

  it('logt in met het nieuwe wachtwoord en 2FA, niet meer met het oude', async () => {
    const oud = await nieuweClient().auth.signInWithPassword({ email: EMAIL, password: TIJDELIJK })
    expect(oud.error?.code).toBe('invalid_credentials')

    client = nieuweClient()
    const nieuw = await client.auth.signInWithPassword({ email: EMAIL, password: NIEUW })
    expect(nieuw.error).toBeNull()
    // Met een gekoppelde app is na het wachtwoord nog de 2FA-stap nodig.
    expect(claims(nieuw.data.session).aal).toBe('aal1')

    const { data, error } = await verifieer(client, factor.id, factor.totp.secret)
    expect(error).toBeNull()
    const c = claims(data)
    expect(c.aal).toBe('aal2')
    expect(c.must_change_password).toBe(false)

    const { data: rollen } = await client.from('roles').select('id')
    expect(rollen).toHaveLength(4)
  })

  it('schrijft inloggen en de wachtwoordwijziging naar de auditlog', () => {
    const regels = sql(`select action || ':' || coalesce(details ->> 'methode', '')
                          from public.audit_log where target_user_id = '${userId}' order by id`)
      .split('\n')
    expect(regels).toContain('auth.ingelogd:password')
    expect(regels.some((r) => r.startsWith('auth.ingelogd:') && r.includes('totp'))).toBe(true)
    expect(regels).toContain('auth.wachtwoord_gewijzigd:')
  })

  it('stopt een lopende sessie en weigert inloggen na deactiveren', async () => {
    sql(`update public.profiles set is_active = false where user_id = '${userId}'`)

    const { error: refreshFout } = await client.auth.refreshSession()
    expect(refreshFout).not.toBeNull()

    const { error } = await nieuweClient().auth.signInWithPassword({ email: EMAIL, password: NIEUW })
    // Hele fout vergelijken, zodat een afwijking in de CI-annotatie leesbaar is.
    expect({ status: error?.status, message: error?.message }).toEqual({
      status: 403,
      message: 'Dit account is niet actief. Neem contact op met een beheerder.',
    })
  })
})
