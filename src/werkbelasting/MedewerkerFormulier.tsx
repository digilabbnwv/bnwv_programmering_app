import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { haalGebruikers, type Gebruiker } from '../beheer/api'
import { Selectievakje } from '../components/Selectievakje'
import { SelectField } from '../components/SelectField'
import { TextArea } from '../components/TextArea'
import { TextField } from '../components/TextField'
import { afdelingNaFunctiekeuze, functieOpties, type Afdeling, type Functie } from '../organisatie/api'
import { voerUit, type Medewerker } from './api'
import { FormulierDialoog, ongeldig } from './onderdelen'

export function MedewerkerFormulier({
  medewerker,
  gekoppeld,
  afdelingen,
  functies,
  onSluiten,
  onGelukt,
}: {
  medewerker: Medewerker | null
  /** Accounts die al aan een andere medewerker gekoppeld zijn. */
  gekoppeld: string[]
  afdelingen: Afdeling[]
  functies: Functie[]
  onSluiten: () => void
  onGelukt: (id: string) => void
}) {
  const { client } = useAuth()
  const [gebruikers, setGebruikers] = useState<Gebruiker[] | null>(null)
  const [v, setV] = useState({
    naam: medewerker?.naam ?? '',
    email: medewerker?.email ?? '',
    afdeling_id: medewerker?.afdeling_id ?? '',
    functie_id: medewerker?.functie_id ?? '',
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
  const functie = (id: string) => functies.find((f) => f.id === id)
  // Vrije tekst van vóór de functielijst, als hulp bij het indelen.
  const oudeTekst = medewerker && !medewerker.functie_id && medewerker.functie ? medewerker.functie : ''

  function kiesFunctie(id: string) {
    setV((oud) => ({
      ...oud,
      functie_id: id,
      afdeling_id: afdelingNaFunctiekeuze(oud.afdeling_id, functie(oud.functie_id), functie(id)),
    }))
  }

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
        p_afdeling_id: v.afdeling_id || null,
        p_functie_id: v.functie_id || null,
        p_user_id: v.user_id || null,
        p_actief: v.actief,
        p_opmerking: v.opmerking,
      },
      {
        '23505': 'Dit account is al aan een andere medewerker gekoppeld.',
        '23503': 'Deze functie of afdeling bestaat niet meer. Ververs de pagina.',
      },
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
      <SelectField
        label="Functie"
        hint={oudeTekst ? `Eerder ingevuld als tekst: “${oudeTekst}”.` : undefined}
        value={v.functie_id}
        opties={[{ waarde: '', label: 'Nog niet ingedeeld' }, ...functieOpties(functies, afdelingen, medewerker?.functie_id)]}
        onChange={(e) => kiesFunctie(e.target.value)}
      />
      <SelectField
        label="Afdeling"
        hint="Volgt de functie. Kies een andere afdeling als de medewerker ergens anders werkt."
        value={v.afdeling_id}
        opties={[
          { waarde: '', label: 'Nog niet ingedeeld' },
          ...[...afdelingen].sort((a, b) => a.volgorde - b.volgorde).map((a) => ({ waarde: a.id, label: a.naam })),
        ]}
        onChange={(e) => zet('afdeling_id', e.target.value)}
      />
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
