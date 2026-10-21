import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'
import { Dialoog } from '../components/Dialoog'
import { Melding } from '../components/Melding'
import { SelectField } from '../components/SelectField'
import { TextField } from '../components/TextField'
import { beheer, type Rol } from './api'
import { TijdelijkWachtwoord } from './TijdelijkWachtwoord'

export function GebruikerAanmaken({
  rollen,
  onSluiten,
  onAangemaakt,
}: {
  rollen: Rol[]
  onSluiten: () => void
  onAangemaakt: () => void
}) {
  const { client } = useAuth()
  const [naam, setNaam] = useState('')
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState(rollen.some((r) => r.id === 'medewerker') ? 'medewerker' : (rollen[0]?.id ?? ''))
  const [veldFout, setVeldFout] = useState<{ naam?: string; email?: string }>({})
  const [fout, setFout] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)
  const [wachtwoord, setWachtwoord] = useState<string | null>(null)

  async function opVersturen(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const nieuw = {
      naam: naam.trim() ? undefined : 'Vul een naam in.',
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? undefined : 'Vul een geldig e-mailadres in.',
    }
    setVeldFout(nieuw)
    if (nieuw.naam || nieuw.email) return

    setBezig(true)
    setFout(null)
    const res = await beheer<{ tijdelijkWachtwoord: string }>(client, {
      actie: 'aanmaken',
      email: email.trim(),
      weergavenaam: naam.trim(),
      rol,
    })
    setBezig(false)
    if (!res.ok) {
      setFout(res.melding)
      return
    }
    setWachtwoord(res.data.tijdelijkWachtwoord)
    onAangemaakt()
  }

  return (
    <Dialoog titel={wachtwoord ? 'Gebruiker aangemaakt' : 'Nieuwe gebruiker'} onSluiten={onSluiten}>
      {wachtwoord ? (
        <div className="space-y-6">
          <TijdelijkWachtwoord wachtwoord={wachtwoord} naam={naam.trim()} />
          <Button onClick={onSluiten}>Klaar</Button>
        </div>
      ) : (
        <form onSubmit={opVersturen} noValidate className="space-y-5">
          {fout && <Melding soort="fout">{fout}</Melding>}
          <TextField
            label="Naam"
            hint="Zoals collega's de persoon kennen, bijv. Anna de Vries."
            autoComplete="off"
            maxLength={100}
            value={naam}
            fout={veldFout.naam}
            onChange={(e) => setNaam(e.target.value)}
          />
          <TextField
            label="E-mailadres"
            type="email"
            autoComplete="off"
            maxLength={254}
            value={email}
            fout={veldFout.email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <SelectField
            label="Rol"
            value={rol}
            opties={rollen.map((r) => ({ waarde: r.id, label: r.naam }))}
            onChange={(e) => setRol(e.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={bezig}>
              {bezig ? 'Bezig met aanmaken…' : 'Gebruiker aanmaken'}
            </Button>
            <Button variant="secundair" onClick={onSluiten}>
              Annuleren
            </Button>
          </div>
        </form>
      )}
    </Dialoog>
  )
}
