import { createHashRouter } from 'react-router'
import { AuthGate } from './auth/AuthGate'
import { StartPage } from './pages/StartPage'
import { NotFoundPage } from './pages/NotFoundPage'

// Hash-routing: GitHub Pages kan geen server-side rewrites doen.
// Alles onder AuthGate is pas zichtbaar na inloggen met 2FA.
export const router = createHashRouter([
  {
    element: <AuthGate />,
    children: [
      { path: '/', element: <StartPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
