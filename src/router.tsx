import { createHashRouter } from 'react-router'
import { AuthGate } from './auth/AuthGate'
import { AppLayout } from './layout/AppLayout'
import { VereistRecht } from './layout/Pagina'
import { StartPage } from './pages/StartPage'
import { GebruikersPage } from './pages/GebruikersPage'
import { AuditlogPage } from './pages/AuditlogPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ScholenPage } from './pages/ScholenPage'
import { SchoolDetailPage } from './pages/SchoolDetailPage'
import { MedewerkersPage } from './pages/MedewerkersPage'
import { MedewerkerDetailPage } from './pages/MedewerkerDetailPage'
import { ProjectgroepenPage } from './pages/ProjectgroepenPage'
import { ProjectgroepDetailPage } from './pages/ProjectgroepDetailPage'
import { StaffelPage } from './pages/StaffelPage'

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
            path: '/scholen',
            element: (
              <VereistRecht recht="werkbelasting.beheren">
                <ScholenPage />
              </VereistRecht>
            ),
          },
          {
            path: '/scholen/:id',
            element: (
              <VereistRecht recht="werkbelasting.beheren">
                <SchoolDetailPage />
              </VereistRecht>
            ),
          },
          {
            path: '/medewerkers',
            element: (
              <VereistRecht recht="werkbelasting.beheren">
                <MedewerkersPage />
              </VereistRecht>
            ),
          },
          {
            path: '/medewerkers/:id',
            element: (
              <VereistRecht recht="werkbelasting.beheren">
                <MedewerkerDetailPage />
              </VereistRecht>
            ),
          },
          {
            path: '/projectgroepen',
            element: (
              <VereistRecht recht="werkbelasting.beheren">
                <ProjectgroepenPage />
              </VereistRecht>
            ),
          },
          {
            path: '/projectgroepen/:id',
            element: (
              <VereistRecht recht="werkbelasting.beheren">
                <ProjectgroepDetailPage />
              </VereistRecht>
            ),
          },
          {
            path: '/staffel',
            element: (
              <VereistRecht recht="werkbelasting.beheren">
                <StaffelPage />
              </VereistRecht>
            ),
          },
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
