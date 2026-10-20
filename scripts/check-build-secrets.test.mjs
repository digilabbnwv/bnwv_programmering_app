import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanDirectory, scanText } from './check-build-secrets.mjs'

// Nep-tokens worden hier opgebouwd, zodat er geen token-achtige string in de
// repository staat (anders slaat gitleaks terecht alarm op dit bestand).
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
const fakeJwt = (role) =>
  `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: 'supabase', role })}.${'x'.repeat(43)}`

describe('scanText', () => {
  it('staat een anon key toe', () => {
    expect(scanText(`const key = "${fakeJwt('anon')}"`)).toEqual([])
  })

  it('staat een publishable key toe', () => {
    expect(scanText(`const key = "sb_publishable_${'a'.repeat(30)}"`)).toEqual([])
  })

  it('vindt een service role JWT', () => {
    expect(scanText(`x="${fakeJwt('service_role')}"`)).toEqual(['JWT met rol "service_role"'])
  })

  it('vindt een Supabase secret key', () => {
    expect(scanText(`x="sb_secret_${'a'.repeat(30)}"`)).toEqual(['Supabase secret key'])
  })

  it('vindt een database-URL met wachtwoord', () => {
    expect(scanText('postgresql://postgres:geheim@db.example.supabase.co:5432/postgres')).toEqual([
      'Database-URL met wachtwoord',
    ])
  })

  it('vindt een private key', () => {
    expect(scanText(`-----BEGIN ${'PRIVATE'} KEY-----`)).toEqual(['Private key'])
  })
})

describe('scanDirectory', () => {
  it('meldt alleen bestanden met een secret', () => {
    const dir = mkdtempSync(join(tmpdir(), 'secret-check-'))
    writeFileSync(join(dir, 'ok.js'), `const k="${fakeJwt('anon')}"`)
    writeFileSync(join(dir, 'lek.js'), `const k="${fakeJwt('service_role')}"`)
    writeFileSync(join(dir, 'afbeelding.png'), `sb_secret_${'a'.repeat(30)}`)

    expect(scanDirectory(dir)).toEqual([
      { file: 'lek.js', findings: ['JWT met rol "service_role"'] },
    ])
  })
})
