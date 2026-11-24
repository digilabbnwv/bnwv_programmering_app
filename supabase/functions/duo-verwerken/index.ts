// Edge Function: ontvangt de leerlingaantallen die de workflow "DUO ophalen"
// (.github/workflows/duo-ophalen.yml) bij DUO heeft opgehaald.
//
// DUO verbreekt verbindingen vanuit Supabase, maar niet vanuit GitHub Actions.
// Daarom haalt de workflow op en levert hier aan. Toegang met een eigen sleutel
// (secret DUO_SLEUTEL, in Supabase en in GitHub), niet met de service role key:
// die blijft alleen in Supabase. Met de sleutel kun je alleen DUO-gegevens
// aanleveren, die net als bij de knop alleen lege, overgenomen en eerdere
// DUO-aantallen invullen.
//
// Acties (POST, JSON met "actie", header x-duo-sleutel):
//   te_vragen                          → { instellingen, peiljaren }
//   verwerken { tellingen, vestigingen } → de vastgelegde ronde
//   mislukt   { melding }              → de vastgelegde ronde

import { adminClient, antwoord, serveer } from '../_shared/http.ts'

const MAX_RIJEN = 20_000

/** Vergelijkt in vaste tijd, via de hash, zodat de lengte niets verraadt. */
async function gelijk(a: string, b: string): Promise<boolean> {
  const hash = async (t: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))
  const [x, y] = await Promise.all([hash(a), hash(b)])
  let verschil = 0
  for (let i = 0; i < x.length; i++) verschil |= x[i] ^ y[i]
  return verschil === 0
}

function rijen(waarde: unknown): unknown[] | null {
  return Array.isArray(waarde) && waarde.length <= MAX_RIJEN ? waarde : null
}

serveer(async (req) => {
  const admin = adminClient()
  const sleutel = Deno.env.get('DUO_SLEUTEL') ?? ''
  if (!admin || sleutel.length < 32) return antwoord(req, 500, { code: 'configuratie' })
  if (!(await gelijk(req.headers.get('x-duo-sleutel') ?? '', sleutel))) {
    return antwoord(req, 401, { code: 'geen_toegang' })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return antwoord(req, 400, { code: 'ongeldig' })
  }

  switch (body?.actie) {
    case 'te_vragen': {
      const { data, error } = await admin.rpc('duo_te_vragen')
      if (error) break
      return antwoord(req, 200, data)
    }
    case 'verwerken': {
      const tellingen = rijen(body.tellingen)
      const vestigingen = rijen(body.vestigingen)
      if (!tellingen || !vestigingen) return antwoord(req, 400, { code: 'ongeldig' })
      const { data, error } = await admin.rpc('duo_verwerken', {
        p_tellingen: tellingen,
        p_vestigingen: vestigingen,
      })
      if (error) break
      return antwoord(req, 200, data)
    }
    case 'mislukt': {
      const melding = typeof body.melding === 'string' ? body.melding.slice(0, 500) : ''
      const { data, error } = await admin.rpc('duo_mislukt', { p_melding: melding })
      if (error) break
      return antwoord(req, 200, data)
    }
    default:
      return antwoord(req, 400, { code: 'ongeldige_actie' })
  }
  console.error('database:', body.actie)
  return antwoord(req, 500, { code: 'serverfout' })
})
