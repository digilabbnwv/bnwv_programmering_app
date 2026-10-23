import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { TextArea } from '../components/TextArea'
import { TextField } from '../components/TextField'
import { voerUit, type Taak } from './api'
import { FormulierDialoog, ongeldig } from './onderdelen'

export function TaakFormulier({
  taak,
  onSluiten,
  onGelukt,
}: {
  taak: Taak | null
  onSluiten: () => void
  onGelukt: (id: string) => void
}) {
  const { client } = useAuth()
  const [naam, setNaam] = useState(taak?.naam ?? '')
  const [omschrijving, setOmschrijving] = useState(taak?.omschrijving ?? '')
  const [start, setStart] = useState(taak?.startdatum ?? `${new Date().getFullYear()}-01-01`)
  const [eind, setEind] = useState(taak?.einddatum ?? '')

  async function opslaan() {
    if (!naam.trim()) return ongeldig('Vul een naam in.')
    if (!start) return ongeldig('Kies een ingangsdatum.')
    if (eind && eind < start) return ongeldig('De einddatum ligt vóór de ingangsdatum.')
    const res = await voerUit<string>(client, 'taak_opslaan', {
      p_id: taak?.id ?? null,
      p_naam: naam,
      p_omschrijving: omschrijving,
      p_startdatum: start,
      p_einddatum: eind || null,
    })
    if (res.ok) onGelukt(res.data)
    return res
  }

  return (
    <FormulierDialoog
      titel={taak ? 'Taak wijzigen' : 'Nieuwe taak'}
      onOpslaan={opslaan}
      onSluiten={onSluiten}
      onGelukt={() => undefined}
    >
      <TextField
        label="Naam"
        hint="Bijv. Coördinatie groepsbezoeken of BHV."
        maxLength={120}
        value={naam}
        onChange={(e) => setNaam(e.target.value)}
      />
      <TextArea label="Omschrijving" maxLength={1000} value={omschrijving} onChange={(e) => setOmschrijving(e.target.value)} />
      <TextField label="Ingangsdatum" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      <TextField
        label="Einddatum"
        hint="Leeg laten als de taak doorloopt."
        type="date"
        value={eind}
        onChange={(e) => setEind(e.target.value)}
      />
    </FormulierDialoog>
  )
}
