import { useState, type FormEvent } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { useAuth } from '../auth/AuthProvider'
import { AuthKaart } from '../auth/AuthKaart'
import { MIN_LENGTE, wachtwoordProblemen } from '../auth/wachtwoord'
import { Button } from '../components/Button'
import { Melding } from '../components/Melding'
import { TextField } from '../components/TextField'

const SERVERFOUTEN: Record<string, string> = {
  zwak_wachtwoord: 'Het wachtwoord voldoet niet aan de eisen.',
  niet_nodig: 'Je wachtwoord is al gewijzigd. Log opnieuw in.',
  geen_toegang: 'Je sessie is verlopen. Log opnieuw in.',
}

/** Na een tijdelijk wachtwoord van de beheerder: zelf een nieuw wachtwoord kiezen. */
export function WachtwoordWijzigenPage() {
  const { client, session, uitloggen } = useAuth()
  const [wachtwoord, setWachtwoord] = useState('')
  const [herhaling, setHerhaling] = useState('')
  const [veldFout, setVeldFout] = useState<{ wachtwoord?: string; herhaling?: string }>({})
  const [fout, setFout] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)

  async function opVersturen(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const problemen = wachtwoordProblemen(wachtwoord)
    const nieuweVeldFout = {
      wachtwoord: problemen.length ? `Je wachtwoord mist nog: ${problemen.join(', ')}.` : undefined,
      herhaling: herhaling !== wachtwoord ? 'De wachtwoorden zijn niet hetzelfde.' : undefined,
    }
    setVeldFout(nieuweVeldFout)
    if (nieuweVeldFout.wachtwoord || nieuweVeldFout.herhaling) return

    setBezig(true)
    setFout(null)
    const { error } = await client.functions.invoke('wachtwoord-wijzigen', {
      body: { wachtwoord },
    })
    if (error) {
      setBezig(false)
      setFout(await serverFout(error))
      return
    }
    // Nieuw token ophalen: de claim must_change_password is nu false.
    const { error: refreshFout } = await client.auth.refreshSession()
    setBezig(false)
    if (refreshFout) {
      await uitloggen('Je wachtwoord is gewijzigd. Log opnieuw in met je nieuwe wachtwoord.')
    }
  }

  return (
    <AuthKaart
      titel="Kies een nieuw wachtwoord"
      intro="Je hebt een tijdelijk wachtwoord gekregen. Kies nu een eigen wachtwoord dat alleen jij kent."
    >
      <form onSubmit={opVersturen} noValidate className="space-y-5">
        {fout && <Melding soort="fout">{fout}</Melding>}
        {/* Verborgen gebruikersnaam: zo slaat een wachtwoordmanager het juiste account op. */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          value={session?.user.email ?? ''}
          readOnly
          hidden
        />
        <TextField
          label="Nieuw wachtwoord"
          type="password"
          name="new-password"
          autoComplete="new-password"
          hint={`Minstens ${MIN_LENGTE} tekens, met een hoofdletter, een kleine letter en een cijfer.`}
          required
          maxLength={72}
          value={wachtwoord}
          fout={veldFout.wachtwoord}
          onChange={(e) => setWachtwoord(e.target.value)}
        />
        <TextField
          label="Herhaal nieuw wachtwoord"
          type="password"
          name="new-password-repeat"
          autoComplete="new-password"
          required
          maxLength={72}
          value={herhaling}
          fout={veldFout.herhaling}
          onChange={(e) => setHerhaling(e.target.value)}
        />
        <Button type="submit" disabled={bezig} className="w-full">
          {bezig ? 'Bezig met opslaan…' : 'Wachtwoord opslaan'}
        </Button>
      </form>
      <p className="mt-6">
        <Button variant="link" onClick={() => void uitloggen()}>
          Uitloggen
        </Button>
      </p>
    </AuthKaart>
  )
}

async function serverFout(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body: unknown = await (error.context as Response).json()
      const code = typeof body === 'object' && body !== null && 'code' in body ? String(body.code) : ''
      const tekst = SERVERFOUTEN[code]
      if (tekst) return tekst
    } catch {
      // Geen JSON: algemene melding hieronder.
    }
  }
  return 'Opslaan lukt nu niet. Probeer het later opnieuw.'
}
