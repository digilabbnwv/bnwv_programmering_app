/**
 * Integratietest van gebruikersbeheer via de Edge Function admin-users, met
 * echte Supabase Auth: aanmaken met tijdelijk wachtwoord, rol wijzigen,
 * (de)activeren, wachtwoord en 2FA resetten, de regels voor beheerders en
 * wat een teamleider wel en niet mag.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { claims, functie, inloggenMet2fa, maakGebruiker, nieuweClient, sql } from './hulp.mjs'

const BEHEERDER = 'beheer-admin@test.nl'
const LEIDER = 'beheer-leider@test.nl'
const NIEUW = 'beheer-nieuw@test.nl'
const START = 'Start-Wachtwoord-42'

const TIJDELIJK_PATROON = /^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/

const beheer = (session, body) => functie('admin-users', session, body)

describe('gebruikersbeheer via admin-users', () => {
  let admin
  let adminId
  let leider
  let nieuwId
  let tijdelijk

  const gebruiker = async (id) => {
    const { data, error } = await admin.client.rpc('list_users')
    expect(error).toBeNull()
    return data.find((g) => g.user_id === id)
  }

  beforeAll(async () => {
    adminId = await maakGebruiker(BEHEERDER, START, 'beheerder', { naam: 'Beheerder Test' })
    await maakGebruiker(LEIDER, START, 'teamleider', { naam: 'Teamleider Test' })
    admin = await inloggenMet2fa(BEHEERDER, START)
    leider = await inloggenMet2fa(LEIDER, START)
  }, 120_000)

  it('weigert een beheerder zonder 2FA (AAL1)', async () => {
    const c = nieuweClient()
    const { data } = await c.auth.signInWithPassword({ email: BEHEERDER, password: START })
    expect(claims(data.session).aal).toBe('aal1')
    const res = await beheer(data.session, { actie: 'aanmaken', email: 'x@test.nl', weergavenaam: 'X', rol: 'medewerker' })
    expect(res).toEqual({ status: 403, body: { code: 'geen_toegang' } })
  })

  it('maakt een gebruiker aan met een tijdelijk wachtwoord', async () => {
    const res = await beheer(admin.session, {
      actie: 'aanmaken',
      email: NIEUW,
      weergavenaam: 'Nieuwe Collega',
      rol: 'medewerker',
    })
    expect(res.status).toBe(200)
    expect(res.body.tijdelijkWachtwoord).toMatch(TIJDELIJK_PATROON)
    nieuwId = res.body.userId
    tijdelijk = res.body.tijdelijkWachtwoord

    expect(await gebruiker(nieuwId)).toMatchObject({
      email: NIEUW,
      weergavenaam: 'Nieuwe Collega',
      role_id: 'medewerker',
      is_active: true,
      must_change_password: true,
      heeft_2fa: false,
    })
  })

  it('laat de nieuwe gebruiker inloggen met het tijdelijke wachtwoord', async () => {
    const { data, error } = await nieuweClient().auth.signInWithPassword({ email: NIEUW, password: tijdelijk })
    expect(error).toBeNull()
    expect(claims(data.session)).toMatchObject({ aal: 'aal1', user_role: 'medewerker', must_change_password: true })
  })

  it('weigert een bestaand e-mailadres en een onbekende rol, zonder los Auth-account', async () => {
    const dubbel = await beheer(admin.session, { actie: 'aanmaken', email: NIEUW, weergavenaam: 'Dubbel', rol: 'medewerker' })
    expect(dubbel).toEqual({ status: 409, body: { code: 'email_bestaat' } })

    const rol = await beheer(admin.session, {
      actie: 'aanmaken',
      email: 'beheer-rol@test.nl',
      weergavenaam: 'Verkeerde Rol',
      rol: 'bestaat-niet',
    })
    expect(rol).toEqual({ status: 400, body: { code: 'ongeldige_rol' } })
    expect(sql(`select count(*) from auth.users where email = 'beheer-rol@test.nl'`)).toBe('0')
  })

  it('laat een teamleider kijken, maar niet beheren', async () => {
    const res = await beheer(leider.session, {
      actie: 'aanmaken',
      email: 'beheer-leider-maakt@test.nl',
      weergavenaam: 'Mag Niet',
      rol: 'medewerker',
    })
    expect(res).toEqual({ status: 403, body: { code: 'geen_rechten' } })
    expect(sql(`select count(*) from auth.users where email = 'beheer-leider-maakt@test.nl'`)).toBe('0')

    const rolRes = await beheer(leider.session, { actie: 'rol_wijzigen', userId: nieuwId, rol: 'beheerder' })
    expect(rolRes).toEqual({ status: 403, body: { code: 'geen_rechten' } })

    const { data: lijst, error } = await leider.client.rpc('list_users')
    expect(error).toBeNull()
    expect(lijst.map((g) => g.email)).toContain(NIEUW)

    const { data: log } = await leider.client.from('audit_log').select('id')
    expect(log).toEqual([])
  })

  it('wijzigt een rol en legt dat vast in de auditlog', async () => {
    expect(await beheer(admin.session, { actie: 'rol_wijzigen', userId: nieuwId, rol: 'teamleider' })).toEqual({
      status: 200,
      body: { ok: true },
    })
    expect((await gebruiker(nieuwId)).role_id).toBe('teamleider')
    expect(
      sql(`select details::text from public.audit_log
            where action = 'gebruiker.rol_gewijzigd' and target_user_id = '${nieuwId}'`),
    ).toBe('{"van": "medewerker", "naar": "teamleider"}')
  })

  it('weigert beheeracties op het eigen account', async () => {
    const eigenRol = await beheer(admin.session, { actie: 'rol_wijzigen', userId: adminId, rol: 'medewerker' })
    expect(eigenRol).toEqual({ status: 409, body: { code: 'eigen_rol' } })
    const eigenAccount = await beheer(admin.session, { actie: 'actief_zetten', userId: adminId, actief: false })
    expect(eigenAccount).toEqual({ status: 409, body: { code: 'eigen_account' } })
    const eigenReset = await beheer(admin.session, { actie: 'wachtwoord_resetten', userId: adminId })
    expect(eigenReset).toEqual({ status: 409, body: { code: 'eigen_account' } })
    expect((await gebruiker(adminId)).role_id).toBe('beheerder')
  })

  it('meldt een onbekende gebruiker', async () => {
    const res = await beheer(admin.session, {
      actie: 'rol_wijzigen',
      userId: '00000000-0000-4000-8000-000000000000',
      rol: 'medewerker',
    })
    expect(res).toEqual({ status: 404, body: { code: 'niet_gevonden' } })
  })

  it('reset de 2FA: de gebruiker wordt uitgelogd en koppelt opnieuw', async () => {
    const nieuw = await inloggenMet2fa(NIEUW, tijdelijk)
    expect((await gebruiker(nieuwId)).heeft_2fa).toBe(true)

    expect(await beheer(admin.session, { actie: '2fa_resetten', userId: nieuwId })).toEqual({
      status: 200,
      body: { ok: true },
    })
    expect((await gebruiker(nieuwId)).heeft_2fa).toBe(false)
    const { error } = await nieuw.client.auth.refreshSession()
    expect(error).not.toBeNull()
  })

  it('reset het wachtwoord naar een nieuw tijdelijk wachtwoord', async () => {
    const res = await beheer(admin.session, { actie: 'wachtwoord_resetten', userId: nieuwId })
    expect(res.status).toBe(200)
    expect(res.body.tijdelijkWachtwoord).toMatch(TIJDELIJK_PATROON)
    expect(res.body.tijdelijkWachtwoord).not.toBe(tijdelijk)

    const oud = await nieuweClient().auth.signInWithPassword({ email: NIEUW, password: tijdelijk })
    expect(oud.error?.code).toBe('invalid_credentials')
    tijdelijk = res.body.tijdelijkWachtwoord
    const nieuw = await nieuweClient().auth.signInWithPassword({ email: NIEUW, password: tijdelijk })
    expect(nieuw.error).toBeNull()
    expect(claims(nieuw.data.session).must_change_password).toBe(true)
  })

  it('deactiveert en activeert een account', async () => {
    expect(await beheer(admin.session, { actie: 'actief_zetten', userId: nieuwId, actief: false })).toEqual({
      status: 200,
      body: { ok: true },
    })
    const geweigerd = await nieuweClient().auth.signInWithPassword({ email: NIEUW, password: tijdelijk })
    expect(geweigerd.error?.status).toBe(403)

    expect(await beheer(admin.session, { actie: 'actief_zetten', userId: nieuwId, actief: true })).toEqual({
      status: 200,
      body: { ok: true },
    })
    const weer = await nieuweClient().auth.signInWithPassword({ email: NIEUW, password: tijdelijk })
    expect(weer.error).toBeNull()
  })

  it('toont de beheeracties in de auditlog voor de beheerder', async () => {
    const { data, error } = await admin.client
      .from('audit_log')
      .select('action, actor_id')
      .eq('target_user_id', nieuwId)
      .order('id')
    expect(error).toBeNull()
    const beheerActies = data.filter((r) => r.actor_id === adminId).map((r) => r.action)
    expect(beheerActies).toEqual([
      'gebruiker.aangemaakt',
      'gebruiker.rol_gewijzigd',
      'gebruiker.2fa_gereset',
      'gebruiker.wachtwoord_gereset',
      'gebruiker.gedeactiveerd',
      'gebruiker.geactiveerd',
    ])
  })

  it('laat de sessie van de beheerder zelf staan', async () => {
    const { data, error } = await admin.client.auth.refreshSession()
    expect(error).toBeNull()
    expect(claims(data.session).aal).toBe('aal2')
  })
})
