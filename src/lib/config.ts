/**
 * Publieke configuratie uit de build (VITE_-variabelen, zie .env.example).
 * Ontbreekt er iets, dan toont de app een melding in plaats van te crashen.
 */
export interface AppConfig {
  supabaseUrl: string
  supabaseKey: string
  idleTimeoutMinutes: number
}

export type ConfigResult = { ok: true; config: AppConfig } | { ok: false; fout: string }

const STANDAARD_INACTIVITEIT = 15

export function parseConfig(env: Record<string, string | undefined>): ConfigResult {
  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    return { ok: false, fout: 'VITE_SUPABASE_URL of VITE_SUPABASE_PUBLISHABLE_KEY ontbreekt.' }
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { ok: false, fout: 'VITE_SUPABASE_URL is geen geldige URL.' }
  }
  const lokaal = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'
  if (parsed.protocol !== 'https:' && !lokaal) {
    return { ok: false, fout: 'VITE_SUPABASE_URL moet met https:// beginnen.' }
  }

  const minuten = Number(env.VITE_IDLE_TIMEOUT_MINUTES ?? STANDAARD_INACTIVITEIT)
  if (!Number.isInteger(minuten) || minuten < 5 || minuten > 60) {
    return { ok: false, fout: 'VITE_IDLE_TIMEOUT_MINUTES moet een heel getal van 5 tot en met 60 zijn.' }
  }

  return { ok: true, config: { supabaseUrl: parsed.origin, supabaseKey: key, idleTimeoutMinutes: minuten } }
}

export const configResult = parseConfig(import.meta.env)
