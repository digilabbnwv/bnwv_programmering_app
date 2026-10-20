#!/usr/bin/env node
/**
 * Lokaal moet de standalone Node uit node_bin/ draaien, niet een andere
 * geïnstalleerde Node. Start npm daarom via .\npm (zie npm.cmd).
 * In CI (CI=true) is er geen node_bin en wordt deze controle overgeslagen.
 */
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const nodeBin = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'node_bin')
const actual = dirname(process.execPath)

if (process.env.CI || !existsSync(nodeBin)) process.exit(0)

if (resolve(actual).toLowerCase() !== nodeBin.toLowerCase()) {
  console.error(
    `Verkeerde Node: ${process.execPath}\n` +
      `Gebruik de Node uit node_bin\\ door npm zo te starten: .\\npm run <script>`,
  )
  process.exit(1)
}
