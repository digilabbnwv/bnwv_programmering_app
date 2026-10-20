import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-page px-4 py-12 md:px-8">
      <h1 className="text-kop-medium font-extrabold">Pagina niet gevonden</h1>
      <p className="mt-4">
        <Link to="/" className="font-semibold underline underline-offset-4 hover:no-underline">
          Naar de startpagina
        </Link>
      </p>
    </main>
  )
}
