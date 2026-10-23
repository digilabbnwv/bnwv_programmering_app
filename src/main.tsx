import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './router'
import { configResult } from './lib/config'
import { supabase } from './lib/supabase'
import { AuthProvider } from './auth/AuthProvider'
import { ConfigFoutPage } from './pages/ConfigFoutPage'
import './styles/index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Element #root ontbreekt in index.html')

// Clickjacking: GitHub Pages kan geen X-Frame-Options zetten en frame-ancestors
// werkt niet in een CSP-<meta>. Daarom weigert de app zelf om in een frame
// van een andere site te draaien.
if (window.top !== window.self) {
  root.textContent = 'BNWV Team Programmering kan niet binnen een andere website worden geopend.'
  throw new Error('In een frame geladen; gestopt')
}

createRoot(root).render(
  <StrictMode>
    {configResult.ok && supabase ? (
      <AuthProvider client={supabase} idleTimeoutMinutes={configResult.config.idleTimeoutMinutes}>
        <RouterProvider router={router} />
      </AuthProvider>
    ) : (
      <ConfigFoutPage fout={configResult.ok ? 'Supabase-client ontbreekt.' : configResult.fout} />
    )}
  </StrictMode>,
)
