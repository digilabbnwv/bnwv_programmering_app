import { createHashRouter } from 'react-router'
import { AuthGate } from './auth/AuthGate'
import { AppLayout } from './layout/AppLayout'
import { VereistRecht } from './layout/Pagina'
import { StartPage } from './pages/StartPage'
import { GebruikersPage } from './pages/GebruikersPage'
import { AuditlogPage } from './pages/AuditlogPage'
import { NotFoundPage } from './pages/NotFoundPage'

// Hash-routing: GitHub Pages kan geen server-side rewrites doen.
// Alles onder AuthGate is pas zichtbaar na inloggen met 2FA. Het recht per
// pagina is gelijk aan dat in layout/navigatie.ts.
export const router = createHashRouter([
  {
    element: <AuthGate />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <StartPage /> },
          {
            path: '/gebruikers',
            element: (
              <VereistRecht recht="gebruikers.bekijken">
                <GebruikersPage />
              </VereistRecht>
            ),
          },
          {
            path: '/auditlog',
            element: (
              <VereistRecht recht="auditlog.lezen">
                <AuditlogPage />
              </VereistRecht>
            ),
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
