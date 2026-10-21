import type { ReactNode } from 'react'

/** Gecentreerde kaart voor de schermen van de inlogflow. */
export function AuthKaart({
  titel,
  intro,
  children,
}: {
  titel: string
  intro?: ReactNode
  children: ReactNode
}) {
  return (
    <main className="flex min-h-dvh items-start justify-center bg-neutral-50 px-4 py-12 md:items-center">
      <div className="w-full max-w-md rounded-card bg-neutral-0 p-6 shadow-card md:p-8">
        <p className="text-ui-sm font-semibold text-neutral-700">Bibliotheek Noordwest Veluwe</p>
        <div className="mt-3 mb-6 h-1 w-16 rounded-pill bg-orange" aria-hidden="true" />
        <h1 className="text-kop-medium font-extrabold">{titel}</h1>
        {intro && <div className="mt-3 text-neutral-700">{intro}</div>}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  )
}
