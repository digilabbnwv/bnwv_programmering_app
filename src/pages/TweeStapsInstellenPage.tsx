import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { AuthKaart } from '../auth/AuthKaart'
import { codeFout, normaliseerCode } from '../auth/foutmeldingen'
import { Button } from '../components/Button'
import { Melding } from '../components/Melding'
import { TextField } from '../components/TextField'

interface Factor {
  id: string
  qrCode: string
  secret: string
}

/** Eerste login: eerst een authenticator-app koppelen, daarna pas verder. */
export function TweeStapsInstellenPage() {
  const { client, uitloggen } = useAuth()
  const [factor, setFactor] = useState<Factor | null>(null)
  const [laadFout, setLaadFout] = useState(false)
  const [code, setCode] = useState('')
  const [fout, setFout] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)
  // StrictMode voert effecten in development twee keer uit: één factor aanmaken.
  const gestart = useRef(false)

  useEffect(() => {
    if (gestart.current) return
    gestart.current = true

    void (async () => {
      // Een eerder afgebroken koppeling opruimen, anders loopt het maximum vol.
      const lijst = await client.auth.mfa.listFactors()
      for (const oud of lijst.data?.all ?? []) {
        if (oud.status === 'unverified') await client.auth.mfa.unenroll({ factorId: oud.id })
      }
      const { data, error } = await client.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator-app',
      })
      if (error) {
        setLaadFout(true)
        return
      }
      setFactor({ id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
    })()
  }, [client])

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
    <AuthKaart
      titel="Tweestapsverificatie instellen"
      intro="Je logt voortaan in met je wachtwoord én een code uit een authenticator-app, zoals Microsoft Authenticator of Google Authenticator."
    >
      {laadFout && (
        <Melding soort="fout">
          Het instellen lukt nu niet. Log uit en probeer het later opnieuw.
        </Melding>
      )}

      {!factor && !laadFout && <p role="status">Bezig met voorbereiden…</p>}

      {factor && (
        <form onSubmit={opVersturen} noValidate className="space-y-5">
          <ol className="list-decimal space-y-4 pl-5">
            <li>
              Scan deze QR-code met je authenticator-app.
              <img
                src={factor.qrCode}
                alt="QR-code om BNWV Intern aan je authenticator-app toe te voegen"
                width={192}
                height={192}
                className="mt-3 rounded-md border-2 border-neutral-200 bg-white p-2"
              />
              <details className="mt-3">
                <summary className="cursor-pointer font-semibold underline underline-offset-4">
                  Kun je niet scannen? Typ dan deze code in
                </summary>
                <code className="mt-2 block break-all rounded-md bg-neutral-100 px-3 py-2 font-semibold tracking-wider">
                  {factor.secret.match(/.{1,4}/g)?.join(' ')}
                </code>
              </details>
            </li>
            <li>Vul de code van 6 cijfers in die de app toont.</li>
          </ol>
          {fout && <Melding soort="fout">{fout}</Melding>}
          <TextField
            label="Code uit de app"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button type="submit" disabled={bezig} className="w-full">
            {bezig ? 'Bezig met controleren…' : 'Koppelen'}
          </Button>
        </form>
      )}

      <p className="mt-6">
        <Button variant="link" onClick={() => void uitloggen()}>
          Uitloggen
        </Button>
      </p>
    </AuthKaart>
  )
}
