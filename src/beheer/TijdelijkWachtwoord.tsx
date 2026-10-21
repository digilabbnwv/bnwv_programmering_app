import { useState } from 'react'
import { Button } from '../components/Button'
import { Melding } from '../components/Melding'

/** Toont een tijdelijk wachtwoord één keer, om persoonlijk door te geven. */
export function TijdelijkWachtwoord({ wachtwoord, naam }: { wachtwoord: string; naam: string }) {
  const [gekopieerd, setGekopieerd] = useState(false)

  async function kopieer() {
    try {
      await navigator.clipboard.writeText(wachtwoord)
      setGekopieerd(true)
    } catch {
      setGekopieerd(false)
    }
  }

  return (
    <div className="space-y-4">
      <Melding soort="info">
        Geef dit tijdelijke wachtwoord persoonlijk door aan {naam}. Je ziet het maar één keer.
      </Melding>
      <p>
        <span className="block font-semibold">Tijdelijk wachtwoord</span>
        <code className="mt-2 block rounded-md bg-neutral-100 px-3 py-3 text-ui-lg font-semibold tracking-wider break-all">
          {wachtwoord}
        </code>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secundair" onClick={() => void kopieer()}>
          Kopiëren
        </Button>
        <span role="status" className="text-ui-sm text-neutral-700">
          {gekopieerd ? 'Gekopieerd.' : ''}
        </span>
      </div>
      <p className="text-ui-sm text-neutral-700">
        Bij de eerste keer inloggen stelt {naam} tweestapsverificatie in en kiest een eigen
        wachtwoord.
      </p>
    </div>
  )
}
