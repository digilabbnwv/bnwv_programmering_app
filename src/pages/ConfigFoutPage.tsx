export function ConfigFoutPage({ fout }: { fout: string }) {
  return (
    <main className="mx-auto max-w-page px-4 py-12 md:px-8">
      <h1 className="text-kop-medium font-extrabold">De app is niet goed ingesteld</h1>
      <p className="mt-4 max-w-prose">{fout} Zie .env.example en de README.</p>
    </main>
  )
}
