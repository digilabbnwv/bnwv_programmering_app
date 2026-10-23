import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { haalGebruikers, type Gebruiker } from '../beheer/api'
import { Selectievakje } from '../components/Selectievakje'
import { SelectField } from '../components/SelectField'
import { TextArea } from '../components/TextArea'
import { TextField } from '../components/TextField'
import { voerUit, type Medewerker } from './api'
import { FormulierDialoog, ongeldig } from './onderdelen'

export function MedewerkerFormulier({
  medewerker,
  gekoppeld,
  onSluiten,
  onGelukt,
}: {
  medewerker: Medewerker | null
  /** Accounts die al aan een andere medewerker gekoppeld zijn. */
  gekoppeld: string[]
  onSluiten: () => void
  onGelukt: (id: string) => void
}) {
  const { client } = useAuth()
  const [gebruikers, setGebruikers] = useState<Gebruiker[] | null>(null)
  const [v, setV] = useState({
    naam: medewerker?.naam ?? '',
    email: medewerker?.email ?? '',
    functie: medewerker?.functie ?? '',
    user_id: medewerker?.user_id ?? '',
    actief: medewerker?.actief ?? true,
    opmerking: medewerker?.opmerking ?? '',
  })
  const zet = <K extends keyof typeof v>(veld: K, waarde: (typeof v)[K]) => setV((oud) => ({ ...oud, [veld]: waarde }))

  useEffect(() => {
    let actueel = true
    void haalGebruikers(client).then((res) => {
      if (actueel) setGebruikers(res.ok ? res.data : [])
    })
    return () => {
      actueel = false
    }
  }, [client])

  const beschikbaar = (gebruikers ?? []).filter((g) => g.user_id === v.user_id || !gekoppeld.includes(g.user_id))

  async function opslaan() {
    if (!v.naam.trim()) return ongeldig('Vul een naam in.')
    if (v.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) return ongeldig('Vul een geldig e-mailadres in.')
    const res = await voerUit<string>(
      client,
      'medewerker_opslaan',
      {
        p_id: medewerker?.id ?? null,
        p_naam: v.naam,
        p_email: v.email,
        p_functie: v.functie,
        p_user_id: v.user_id || null,
        p_actief: v.actief,
        p_opmerking: v.opmerking,
      },
      { '23505': 'Dit account is al aan een andere medewerker gekoppeld.' },
    )
    if (res.ok) onGelukt(res.data)
    return res
  }

  return (
    <FormulierDialoog
      titel={medewerker ? 'Medewerker wijzigen' : 'Nieuwe medewerker'}
      onOpslaan={opslaan}
      onSluiten={onSluiten}
      onGelukt={() => undefined}
    >
      <TextField label="Naam" autoComplete="off" maxLength={100} value={v.naam} onChange={(e) => zet('naam', e.target.value)} />
      <TextField label="E-mailadres" type="email" autoComplete="off" maxLength={254} value={v.email} onChange={(e) => zet('email', e.target.value)} />
      <TextField label="Functie" maxLength={100} value={v.functie} onChange={(e) => zet('functie', e.target.value)} />
      <SelectField
        label="Inlogaccount"
        hint="Met een gekoppeld account ziet de medewerker de eigen werkbelasting op de startpagina."
        value={v.user_id}
        disabled={gebruikers === null}
        opties={[
          { waarde: '', label: gebruikers === null ? 'Bezig met laden…' : 'Geen account' },
          ...beschikbaar.map((g) => ({ waarde: g.user_id, label: `${g.weergavenaam} (${g.email})` })),
        ]}
        onChange={(e) => zet('user_id', e.target.value)}
      />
      <TextArea label="Opmerking" maxLength={2000} value={v.opmerking} onChange={(e) => zet('opmerking', e.target.value)} />
      <Selectievakje label="Actief" checked={v.actief} onChange={(e) => zet('actief', e.target.checked)} />
    </FormulierDialoog>
  )
}
