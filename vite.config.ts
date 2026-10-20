import { defineConfig, loadEnv, type Plugin, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Zet de Content Security Policy als <meta> in index.html. GitHub Pages kan
 * geen HTTP-headers zetten, dus dit is de enige plek. Alleen bij de build: de
 * dev-server van Vite heeft inline scripts nodig voor hot reload.
 */
function contentSecurityPolicy(supabaseUrl: string): Plugin {
  return {
    name: 'bnwv-csp',
    apply: 'build',
    transformIndexHtml() {
      const { origin, host } = new URL(supabaseUrl)
      const policy = [
        "default-src 'none'",
        "script-src 'self'",
        "style-src 'self'",
        // data: alleen voor de QR-code bij het instellen van 2FA (SVG via <img>).
        "img-src 'self' data:",
        "font-src 'self'",
        `connect-src 'self' ${origin} wss://${host}`,
        "manifest-src 'self'",
        "base-uri 'none'",
        "form-action 'self'",
        "object-src 'none'",
        // Blokkeert innerHTML en vergelijkbare sinks met gewone strings.
        "require-trusted-types-for 'script'",
        "trusted-types 'none'",
      ].join('; ')
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}

function requireSupabaseUrl(value: string | undefined): string {
  if (!value) {
    throw new Error('VITE_SUPABASE_URL ontbreekt. Zie .env.example.')
  }
  const url = new URL(value)
  if (url.protocol !== 'https:') {
    throw new Error('VITE_SUPABASE_URL moet met https:// beginnen.')
  }
  return url.origin
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const plugins: PluginOption[] = [react(), tailwindcss()]
  if (command === 'build') {
    plugins.push(contentSecurityPolicy(requireSupabaseUrl(env.VITE_SUPABASE_URL)))
  }

  return {
    // Relatief pad: werkt op GitHub Pages ongeacht de reponaam.
    base: './',
    plugins,
    build: {
      // Geen data:-URI's voor assets, zodat de CSP strikt kan blijven.
      assetsInlineLimit: 0,
      modulePreload: { polyfill: false },
      sourcemap: false,
    },
  }
})
