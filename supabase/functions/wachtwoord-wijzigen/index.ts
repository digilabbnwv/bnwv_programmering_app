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
//
// De service role key komt uit de omgeving van Supabase, nooit uit de repo.

import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

const MIN_LENGTE = 12
const MAX_BYTES = 72

// Gelijk aan src/auth/wachtwoord.ts en supabase/config.toml.
function wachtwoordIsSterk(wachtwoord: string): boolean {
  return (
    wachtwoord.length >= MIN_LENGTE &&
    new TextEncoder().encode(wachtwoord).length <= MAX_BYTES &&
    /[a-z]/.test(wachtwoord) &&
    /[A-Z]/.test(wachtwoord) &&
    /[0-9]/.test(wachtwoord)
  )
}

// Toegestane origins voor CORS, komma-gescheiden (secret ALLOWED_ORIGINS).
// Zonder instelling alleen de lokale dev- en preview-server.
const ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ??
  'http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:4173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin')
  if (!origin || !ORIGINS.includes(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

function antwoord(req: Request, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(req) },
  })
}

async function verwerk(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) })
  if (req.method !== 'POST') return antwoord(req, 405, { code: 'methode' })

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return antwoord(req, 500, { code: 'configuratie' })

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return antwoord(req, 401, { code: 'geen_toegang' })

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Controleert de handtekening van het token (JWKS, of via Auth zelf).
  const { data: claimData, error: claimFout } = await admin.auth.getClaims(token)
  const claims = claimData?.claims
  if (claimFout || !claims?.sub || claims.role !== 'authenticated') {
    if (claimFout) console.error('token geweigerd:', claimFout.code ?? claimFout.message)
    return antwoord(req, 401, { code: 'geen_toegang' })
  }
  if (claims.aal !== 'aal2') return antwoord(req, 403, { code: 'geen_toegang' })
  const userId = claims.sub

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
}

Deno.serve(async (req) => {
  try {
    return await verwerk(req)
  } catch (e) {
    // Alleen de fout loggen, nooit het verzoek (daar staat het wachtwoord in).
    console.error('onverwachte fout:', e instanceof Error ? `${e.name}: ${e.message}` : 'onbekend')
    return antwoord(req, 500, { code: 'serverfout' })
  }
})
