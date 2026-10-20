#!/usr/bin/env node
/**
 * Faalt als de build (standaard dist/) een secret bevat. In de frontend hoort
 * alleen de publishable/anon key thuis; al het andere is een lek.
 *
 * Gebruik: node scripts/check-build-secrets.mjs [map]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const JWT = /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g

const PATTERNS = [
  { name: 'Supabase secret key', regex: /sb_secret_[A-Za-z0-9_-]{8,}/g },
  { name: 'Private key', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: 'GitHub-token', regex: /\b(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/g },
  { name: 'AWS access key', regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'Database-URL met wachtwoord', regex: /postgres(?:ql)?:\/\/[^:\s/"'`]+:[^@\s"'`]+@/g },
]

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

/** Geeft een lijst met bevindingen voor één stuk tekst. */
export function scanText(text) {
  const findings = []

  for (const match of text.matchAll(JWT)) {
    const payload = decodeJwtPayload(match[0])
    // Alleen een anon-token mag publiek zijn; elke andere rol is een lek.
    if (payload?.role !== 'anon') {
      findings.push(`JWT met rol "${payload?.role ?? 'onbekend'}"`)
    }
  }

  for (const { name, regex } of PATTERNS) {
    if (regex.test(text)) findings.push(name)
    regex.lastIndex = 0
  }

  return findings
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) yield* walk(path)
    else yield path
  }
}

const TEXT_FILES = /\.(js|mjs|cjs|css|html|json|map|txt|svg|webmanifest)$/i

/** Scant een map en geeft { bestand, bevindingen } terug per probleem. */
export function scanDirectory(dir) {
  const results = []
  for (const file of walk(dir)) {
    if (!TEXT_FILES.test(file)) continue
    const findings = scanText(readFileSync(file, 'utf8'))
    if (findings.length) results.push({ file: relative(dir, file), findings })
  }
  return results
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] ?? 'dist'
  let results
  try {
    results = scanDirectory(dir)
  } catch (error) {
    console.error(`Kan "${dir}" niet scannen: ${error.message}`)
    process.exit(2)
  }

  if (results.length) {
    console.error('Secrets gevonden in de build:')
    for (const { file, findings } of results) {
      console.error(`  ${file}: ${findings.join(', ')}`)
    }
    process.exit(1)
  }
  console.log(`Geen secrets gevonden in ${dir}/.`)
}
