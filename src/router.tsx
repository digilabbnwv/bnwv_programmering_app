import { createHashRouter } from 'react-router'
import { StartPage } from './pages/StartPage'
import { NotFoundPage } from './pages/NotFoundPage'

// Hash-routing: GitHub Pages kan geen server-side rewrites doen.
export const router = createHashRouter([
  { path: '/', element: <StartPage /> },
  { path: '*', element: <NotFoundPage /> },
])
