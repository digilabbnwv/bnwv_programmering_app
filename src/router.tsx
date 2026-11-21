import type { ReactNode } from 'react'
import { createHashRouter, Navigate, useLocation, type RouteObject } from 'react-router'
import { AuthGate } from './auth/AuthGate'
import { AppLayout } from './layout/AppLayout'
import { VereistRecht } from './layout/Pagina'
import { PAGINAS, type PaginaDefinitie } from './layout/paginas'
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
import { OrganisatiePage } from './pages/OrganisatiePage'
import { JaarplanPage } from './pages/JaarplanPage'
import { ProjectPage } from './pages/ProjectPage'
import { ProjectplannerDashboardPage } from './pages/ProjectplannerDashboardPage'
import { ProgrammasPage } from './pages/ProgrammasPage'
import { ProgrammaDetailPage } from './pages/ProgrammaDetailPage'
import { TakenPage } from './pages/TakenPage'
import { TaakDetailPage } from './pages/TaakDetailPage'
import { RapportageMedewerkersPage, RapportageProgrammasPage, RapportageSignalenPage } from './pages/RapportagePage'
import { MijnWerkurenverdelingPage, WerkbelastingPage } from './pages/WerkbelastingPage'

/** Route voor een pagina uit PAGINAS, alleen zichtbaar met het recht dat daar staat. */
function route(pagina: PaginaDefinitie, element: ReactNode): RouteObject {
  return { path: pagina.pad, element: <VereistRecht recht={pagina.recht}>{element}</VereistRecht> }
}

// Hash-routing: GitHub Pages kan geen server-side rewrites doen.
// Alles onder AuthGate is pas zichtbaar na inloggen met 2FA. Pad en recht per
// pagina staan in layout/paginas.ts, samen met het menu.
export const router = createHashRouter([
  {
    element: <AuthGate />,
    children: [
      {
        element: <AppLayout />,
        children: [
          // De startpagina wacht zelf op de rechten en toont per recht wat er is.
          { path: PAGINAS.start.pad, element: <StartPage /> },
          // Oude links naar /rapportage (met ?jaar=) komen op de signalen uit.
          { path: '/rapportage', element: <Doorsturen naar={PAGINAS.signalen.pad} /> },
          // Het dashboard van de projectplanner stond tot fase 2 van de navigatie onder Rapportage.
          { path: '/rapportage/projectplanner', element: <Doorsturen naar={PAGINAS.projectplanner.pad} /> },
          route(PAGINAS.mijnWerkurenverdeling, <MijnWerkurenverdelingPage />),
          route(PAGINAS.signalen, <RapportageSignalenPage />),
          route(PAGINAS.verdelingProgrammas, <RapportageProgrammasPage />),
          route(PAGINAS.verdelingMedewerkers, <RapportageMedewerkersPage />),
          route(PAGINAS.projectplanner, <ProjectplannerDashboardPage />),
          route(PAGINAS.werkbelasting, <WerkbelastingPage />),
          route(PAGINAS.scholen, <ScholenPage />),
          route(PAGINAS.school, <SchoolDetailPage />),
          route(PAGINAS.medewerkers, <MedewerkersPage />),
          route(PAGINAS.medewerker, <MedewerkerDetailPage />),
          route(PAGINAS.projectgroepen, <ProjectgroepenPage />),
          route(PAGINAS.projectgroep, <ProjectgroepDetailPage />),
          route(PAGINAS.taken, <TakenPage />),
          route(PAGINAS.taak, <TaakDetailPage />),
          route(PAGINAS.programmas, <ProgrammasPage />),
          route(PAGINAS.programma, <ProgrammaDetailPage />),
          route(PAGINAS.staffel, <StaffelPage />),
          route(PAGINAS.jaarplan, <JaarplanPage />),
          route(PAGINAS.project, <ProjectPage />),
          route(PAGINAS.organisatie, <OrganisatiePage />),
          route(PAGINAS.gebruikers, <GebruikersPage />),
          route(PAGINAS.auditlog, <AuditlogPage />),
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])

/** Stuurt een oud adres door naar het nieuwe, met dezelfde zoekparameters (bijv. ?jaar=). */
function Doorsturen({ naar }: { naar: string }) {
  const { search } = useLocation()
  return <Navigate to={{ pathname: naar, search }} replace />
}
