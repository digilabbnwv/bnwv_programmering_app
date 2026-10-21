// Gedeelde onderdelen van de Edge Functions: CORS, antwoorden en het
// controleren van het token van de ingelogde gebruiker.
//
// De service role key komt uit de omgeving van Supabase, nooit uit de repo.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'

// Toegestane origins voor CORS, komma-gescheiden (secret ALLOWED_ORIGINS).
// Zonder instelling alleen de lokale dev- en preview-server.
const ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ??
  'http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:4173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin')
  if (!origin || !ORIGINS.includes(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

export function antwoord(req: Request, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders(req) },
  })
}

export function adminClient(): SupabaseClient | null {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Controleert de handtekening van het token (JWKS, of via Auth zelf) en eist
 * AAL2. Geeft de user-id, of een kant-en-klaar foutantwoord.
 */
export async function ingelogdeGebruiker(
  req: Request,
  admin: SupabaseClient,
): Promise<{ userId: string } | { fout: Response }> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return { fout: antwoord(req, 401, { code: 'geen_toegang' }) }

  const { data, error } = await admin.auth.getClaims(token)
  const claims = data?.claims
  if (error || !claims?.sub || claims.role !== 'authenticated') {
    if (error) console.error('token geweigerd:', error.code ?? error.message)
    return { fout: antwoord(req, 401, { code: 'geen_toegang' }) }
  }
  if (claims.aal !== 'aal2') return { fout: antwoord(req, 403, { code: 'geen_toegang' }) }
  return { userId: claims.sub }
}

/** Vangt onverwachte fouten af; logt nooit het verzoek (daar kan een wachtwoord in staan). */
export function serveer(verwerk: (req: Request) => Promise<Response>): void {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) })
    if (req.method !== 'POST') return antwoord(req, 405, { code: 'methode' })
    try {
      return await verwerk(req)
    } catch (e) {
      console.error('onverwachte fout:', e instanceof Error ? `${e.name}: ${e.message}` : 'onbekend')
      return antwoord(req, 500, { code: 'serverfout' })
    }
  })
}

// Wachtwoordeisen, gelijk aan src/auth/wachtwoord.ts en supabase/config.toml.
const MIN_LENGTE = 12
const MAX_BYTES = 72

export function wachtwoordIsSterk(wachtwoord: string): boolean {
  return (
    wachtwoord.length >= MIN_LENGTE &&
    new TextEncoder().encode(wachtwoord).length <= MAX_BYTES &&
    /[a-z]/.test(wachtwoord) &&
    /[A-Z]/.test(wachtwoord) &&
    /[0-9]/.test(wachtwoord)
  )
}
