import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { SelectField } from '../components/SelectField'
import { TextArea } from '../components/TextArea'
import { TextField } from '../components/TextField'
import { voerUit, type Medewerker, type Projectgroep } from './api'
import { FormulierDialoog, ongeldig } from './onderdelen'

export function ProjectgroepFormulier({
  projectgroep,
  medewerkers,
  onSluiten,
  onGelukt,
}: {
  projectgroep: Projectgroep | null
  medewerkers: Medewerker[]
  onSluiten: () => void
  onGelukt: (id: string) => void
}) {
  const { client } = useAuth()
  const [naam, setNaam] = useState(projectgroep?.naam ?? '')
  const [omschrijving, setOmschrijving] = useState(projectgroep?.omschrijving ?? '')
  const [start, setStart] = useState(projectgroep?.startdatum ?? `${new Date().getFullYear()}-01-01`)
  const [eind, setEind] = useState(projectgroep?.einddatum ?? '')
  const [trekker, setTrekker] = useState(projectgroep?.trekker_id ?? '')

  async function opslaan() {
    if (!naam.trim()) return ongeldig('Vul een naam in.')
    if (!start) return ongeldig('Kies een ingangsdatum.')
    if (eind && eind < start) return ongeldig('De einddatum ligt vóór de ingangsdatum.')
    const res = await voerUit<string>(client, 'projectgroep_opslaan', {
      p_id: projectgroep?.id ?? null,
      p_naam: naam,
      p_omschrijving: omschrijving,
      p_startdatum: start,
      p_einddatum: eind || null,
      p_trekker_id: trekker || null,
    })
    if (res.ok) onGelukt(res.data)
    return res
  }

  return (
    <FormulierDialoog
      titel={projectgroep ? 'Projectgroep wijzigen' : 'Nieuwe projectgroep'}
      onOpslaan={opslaan}
      onSluiten={onSluiten}
      onGelukt={() => undefined}
    >
      <TextField label="Naam" maxLength={120} value={naam} onChange={(e) => setNaam(e.target.value)} />
      <TextArea label="Omschrijving" maxLength={1000} value={omschrijving} onChange={(e) => setOmschrijving(e.target.value)} />
      <TextField label="Ingangsdatum" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      <TextField
        label="Einddatum"
        hint="Leeg laten als de projectgroep doorloopt."
        type="date"
        value={eind}
        onChange={(e) => setEind(e.target.value)}
      />
      <SelectField
        label="Trekker"
        value={trekker}
        opties={[
          { waarde: '', label: 'Geen trekker' },
          ...medewerkers
            .filter((m) => m.actief || m.id === projectgroep?.trekker_id)
            .map((m) => ({ waarde: m.id, label: m.naam })),
        ]}
        onChange={(e) => setTrekker(e.target.value)}
      />
    </FormulierDialoog>
  )
}
