import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { AuthKaart } from '../auth/AuthKaart'
import { inlogFout } from '../auth/foutmeldingen'
import { registreerActiviteit } from '../auth/inactiviteit'
import { Button } from '../components/Button'
import { Melding } from '../components/Melding'
import { TextField } from '../components/TextField'

export function LoginPage() {
  const { client, melding } = useAuth()
  const [email, setEmail] = useState('')
  const [wachtwoord, setWachtwoord] = useState('')
  const [fout, setFout] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)

  async function opVersturen(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim() || !wachtwoord) {
      setFout('Vul je e-mailadres en wachtwoord in.')
      return
    }
    setBezig(true)
    setFout(null)
    // Vóór het inloggen: de timer mag een verse sessie niet als verlopen zien.
    registreerActiviteit(localStorage)
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password: wachtwoord })
    setBezig(false)
    if (error) {
      setFout(inlogFout(error))
      setWachtwoord('')
    }
  }

  return (
    <AuthKaart titel="Inloggen" intro="Log in met je e-mailadres en wachtwoord van BNWV Intern.">
      <form onSubmit={opVersturen} noValidate className="space-y-5">
        {melding && !fout && <Melding soort="info">{melding}</Melding>}
        {fout && <Melding soort="fout">{fout}</Melding>}
        <TextField
          label="E-mailadres"
          type="email"
          name="email"
          autoComplete="username"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Wachtwoord"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          maxLength={200}
          value={wachtwoord}
          onChange={(e) => setWachtwoord(e.target.value)}
        />
        <Button type="submit" disabled={bezig} className="w-full">
          {bezig ? 'Bezig met inloggen…' : 'Inloggen'}
        </Button>
        <p className="text-ui-sm text-neutral-700">
          Wachtwoord vergeten of je telefoon met de authenticator-app kwijt? Vraag een beheerder om
          het te resetten.
        </p>
      </form>
    </AuthKaart>
  )
}
