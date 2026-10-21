import { defineConfig } from 'vitest/config'

// Integratietests tegen een lokale Supabase; draaien alleen in CI.
export default defineConfig({
  test: {
    include: ['tests/integratie/**/*.test.mjs'],
    environment: 'node',
    // De tests bouwen op elkaar voort (één gebruiker door de hele flow).
    sequence: { concurrent: false },
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
