import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { TextArea } from '../components/TextArea'
import { TextField } from '../components/TextField'
import { voerUit, type Programma } from './api'
import { FormulierDialoog, ongeldig } from './onderdelen'

export function ProgrammaFormulier({
  programma,
  onSluiten,
  onGelukt,
}: {
  programma: Programma | null
  onSluiten: () => void
  onGelukt: (id: string) => void
}) {
  const { client } = useAuth()
  const [naam, setNaam] = useState(programma?.naam ?? '')
  const [omschrijving, setOmschrijving] = useState(programma?.omschrijving ?? '')

  async function opslaan() {
    if (!naam.trim()) return ongeldig('Vul een naam in.')
    const res = await voerUit<string>(
      client,
      'programma_opslaan',
      { p_id: programma?.id ?? null, p_naam: naam, p_omschrijving: omschrijving },
      { '23505': 'Er is al een programma met deze naam.' },
    )
    if (res.ok) onGelukt(res.data)
    return res
  }

  return (
    <FormulierDialoog
      titel={programma ? 'Programma wijzigen' : 'Nieuw programma'}
      onOpslaan={opslaan}
      onSluiten={onSluiten}
      onGelukt={() => undefined}
    >
      <TextField
        label="Naam"
        hint="Bijv. dBos of BoekStart."
        maxLength={80}
        value={naam}
        onChange={(e) => setNaam(e.target.value)}
      />
      <TextArea label="Omschrijving" maxLength={1000} value={omschrijving} onChange={(e) => setOmschrijving(e.target.value)} />
    </FormulierDialoog>
  )
}
