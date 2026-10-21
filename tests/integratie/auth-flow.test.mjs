/**
 * Integratietest van de inlogflow tegen een lokale Supabase (alleen in CI,
 * zie .github/workflows/ci.yml). Anders dan de pgTAP-tests gaat dit door de
 * echte Supabase Auth: inloggen, de access token hook, 2FA (TOTP), de Edge
 * Function wachtwoord-wijzigen en het weigeren van gedeactiveerde accounts.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { claims, functie, maakGebruiker, nieuweClient, sql, verifieer } from './hulp.mjs'

const EMAIL = 'integratie@test.nl'
const TIJDELIJK = 'Tijdelijk-Wachtwoord-1'
const NIEUW = 'Eigen-Wachtwoord-2026'
const FOUT = 'Fout-Wachtwoord-1'
const REGISTRATIE = 'Sterk-Wachtwoord-1'

const wijzigWachtwoord = (session, wachtwoord) => functie('wachtwoord-wijzigen', session, { wachtwoord })

describe('inlogflow met echte Supabase Auth', () => {
  let client = nieuweClient()
  let userId
  let factor

  beforeAll(async () => {
    userId = await maakGebruiker(EMAIL, TIJDELIJK, 'medewerker', { tijdelijk: true, naam: 'Integratietest' })
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
