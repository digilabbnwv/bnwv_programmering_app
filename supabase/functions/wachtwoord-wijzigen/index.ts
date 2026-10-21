// Edge Function: een gebruiker met een tijdelijk wachtwoord kiest een eigen
// wachtwoord.
//
// Waarom niet supabase.auth.updateUser() vanuit de browser? Dan moet de
// browser daarna zelf melden dat het gelukt is, en de vlag
// must_change_password kan alleen de service role wijzigen. Deze functie doet
// beide in één keer, zodat de vlag alleen omgaat als het wachtwoord echt is
// gewijzigd.
//
// Voorwaarden: geldig token met AAL2 (2FA gedaan) en must_change_password nog
// true. Na de wijziging is de vlag false, dus de functie werkt één keer per
// reset door een beheerder.

import { adminClient, antwoord, ingelogdeGebruiker, serveer, wachtwoordIsSterk } from '../_shared/http.ts'

serveer(async (req) => {
  const admin = adminClient()
  if (!admin) return antwoord(req, 500, { code: 'configuratie' })

  const gebruiker = await ingelogdeGebruiker(req, admin)
  if ('fout' in gebruiker) return gebruiker.fout
  const { userId } = gebruiker

  let wachtwoord: unknown
  try {
    wachtwoord = (await req.json())?.wachtwoord
  } catch {
    return antwoord(req, 400, { code: 'ongeldig' })
  }
  if (typeof wachtwoord !== 'string' || !wachtwoordIsSterk(wachtwoord)) {
    return antwoord(req, 400, { code: 'zwak_wachtwoord' })
  }

  // De vlag uit de database, niet uit het token: dat kan verouderd zijn.
  const { data: status, error: statusFout } = await admin.rpc('password_change_status', {
    p_user: userId,
  })
  if (statusFout) {
    console.error('password_change_status:', statusFout.code, statusFout.message)
    return antwoord(req, 500, { code: 'serverfout' })
  }
  if (status === 'niet_nodig') return antwoord(req, 409, { code: 'niet_nodig' })
  if (status !== 'toegestaan') return antwoord(req, 403, { code: 'geen_toegang' })

  const { error: updateFout } = await admin.auth.admin.updateUserById(userId, { password: wachtwoord })
  if (updateFout) {
    // Supabase Auth kan het wachtwoord ook weigeren, bijv. als het gelekt is.
    console.error('updateUserById:', updateFout.code, updateFout.status)
    const zwak = updateFout.code === 'weak_password' || updateFout.status === 422
    return antwoord(req, zwak ? 400 : 500, { code: zwak ? 'zwak_wachtwoord' : 'serverfout' })
  }

  const { error: rpcFout } = await admin.rpc('complete_password_change', { p_user: userId })
  if (rpcFout) {
    console.error('complete_password_change:', rpcFout.code, rpcFout.message)
    return antwoord(req, 500, { code: 'serverfout' })
  }

  return antwoord(req, 200, { ok: true })
})
