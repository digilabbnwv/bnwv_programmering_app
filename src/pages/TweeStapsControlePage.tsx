import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { AuthKaart } from '../auth/AuthKaart'
import { codeFout, normaliseerCode } from '../auth/foutmeldingen'
import { Button } from '../components/Button'
import { Melding } from '../components/Melding'
import { TextField } from '../components/TextField'

export function TweeStapsControlePage() {
  const { client, session, uitloggen } = useAuth()
  const [code, setCode] = useState('')
  const [fout, setFout] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)

  const factor = session?.user.factors?.find((f) => f.factor_type === 'totp' && f.status === 'verified')

  async function opVersturen(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!factor) return
    const geldig = normaliseerCode(code)
    if (!geldig) {
      setFout('Vul de 6 cijfers uit je authenticator-app in.')
      return
    }
    setBezig(true)
    setFout(null)
    const { error } = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code: geldig })
    setBezig(false)
    if (error) {
      setFout(codeFout(error))
      setCode('')
    }
  }

  return (
    <AuthKaart titel="Code invullen" intro="Open je authenticator-app en vul de code van 6 cijfers in.">
      <form onSubmit={opVersturen} noValidate className="space-y-5">
        {fout && <Melding soort="fout">{fout}</Melding>}
        <TextField
          label="Code uit de app"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          // Dit scherm verschijnt direct na het inloggen: focus meteen op de code.
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <Button type="submit" disabled={bezig} className="w-full">
          {bezig ? 'Bezig met controleren…' : 'Doorgaan'}
        </Button>
      </form>
      <p className="mt-6 text-ui-sm text-neutral-700">
        Telefoon kwijt of nieuw? Vraag een beheerder om je tweestapsverificatie te resetten.
      </p>
      <p className="mt-4">
        <Button variant="link" onClick={() => void uitloggen()}>
          Uitloggen
        </Button>
      </p>
    </AuthKaart>
  )
}
