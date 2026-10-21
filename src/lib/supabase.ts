import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { configResult } from './config'

/** Vaste sleutel, zodat uitloggen de sessie ook zonder netwerk kan wissen. */
export const SESSIE_SLEUTEL = 'bnwv.auth'

/**
 * De enige Supabase-client van de app, met alleen de publishable (anon) key.
 * Null als de configuratie ontbreekt; de app toont dan een melding.
 */
export const supabase: SupabaseClient | null = configResult.ok
  ? createClient(configResult.config.supabaseUrl, configResult.config.supabaseKey, {
      auth: {
        persistSession: true,
        storageKey: SESSIE_SLEUTEL,
        autoRefreshToken: true,
        // Geen magic links of OAuth: tokens in de URL nooit oppakken.
        detectSessionInUrl: false,
      },
    })
  : null
