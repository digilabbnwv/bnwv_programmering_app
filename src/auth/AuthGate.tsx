import { Outlet } from 'react-router'
import { useAuth } from './AuthProvider'
import { LoginPage } from '../pages/LoginPage'
import { TweeStapsInstellenPage } from '../pages/TweeStapsInstellenPage'
import { TweeStapsControlePage } from '../pages/TweeStapsControlePage'
import { WachtwoordWijzigenPage } from '../pages/WachtwoordWijzigenPage'

/**
 * Toont de pagina's van de app pas als de inlogflow klaar is. Tot die tijd
 * staat op elke URL het scherm van de huidige stap; na afloop blijft de
 * gevraagde URL staan.
 */
export function AuthGate() {
  const { laden, stap } = useAuth()

  if (laden) {
    return (
      <main className="px-4 py-12">
        <p role="status">Bezig met laden…</p>
      </main>
    )
  }

  switch (stap) {
    case 'inloggen':
      return <LoginPage />
    case '2fa-instellen':
      return <TweeStapsInstellenPage />
    case '2fa-controleren':
      return <TweeStapsControlePage />
    case 'wachtwoord-wijzigen':
      return <WachtwoordWijzigenPage />
    case 'klaar':
      return <Outlet />
  }
}
