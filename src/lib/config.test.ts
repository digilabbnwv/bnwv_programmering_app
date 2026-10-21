import { describe, expect, it } from 'vitest'
import { parseConfig } from './config'

const geldig = {
  VITE_SUPABASE_URL: 'https://abc.supabase.co/',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
}

describe('parseConfig', () => {
  it('leest een geldige configuratie met standaard 15 minuten', () => {
    expect(parseConfig(geldig)).toEqual({
      ok: true,
      config: { supabaseUrl: 'https://abc.supabase.co', supabaseKey: 'sb_publishable_x', idleTimeoutMinutes: 15 },
    })
  })

  it('eist https, behalve voor een lokale Supabase', () => {
    expect(parseConfig({ ...geldig, VITE_SUPABASE_URL: 'http://abc.supabase.co' }).ok).toBe(false)
    expect(parseConfig({ ...geldig, VITE_SUPABASE_URL: 'http://127.0.0.1:54321' }).ok).toBe(true)
  })

  it('weigert ontbrekende waarden en een onzinnige timeout', () => {
    expect(parseConfig({}).ok).toBe(false)
    expect(parseConfig({ ...geldig, VITE_IDLE_TIMEOUT_MINUTES: '0' }).ok).toBe(false)
    expect(parseConfig({ ...geldig, VITE_IDLE_TIMEOUT_MINUTES: '2.5' }).ok).toBe(false)
  })
})
