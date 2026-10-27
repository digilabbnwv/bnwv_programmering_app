import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { TextArea } from '../components/TextArea'
import { TextField } from '../components/TextField'
import { SelectField } from '../components/SelectField'
import { PROGRAMMATYPES, voerUit, type Programma, type ProgrammaType } from './api'
import { FormulierDialoog, ongeldig } from './onderdelen'

export function ProgrammaFormulier({
  programma,
  typeVast = false,
  onSluiten,
  onGelukt,
}: {
  programma: Programma | null
  /** Er hangen scholen of uitvoerders aan het programma: het type kan dan niet meer wijzigen. */
  typeVast?: boolean
  onSluiten: () => void
  onGelukt: (id: string) => void
}) {
  const { client } = useAuth()
  const [naam, setNaam] = useState(programma?.naam ?? '')
  const [omschrijving, setOmschrijving] = useState(programma?.omschrijving ?? '')
  const [type, setType] = useState<ProgrammaType>(programma?.type ?? 'scholen')

  async function opslaan() {
    if (!naam.trim()) return ongeldig('Vul een naam in.')
    const res = await voerUit<string>(
      client,
      'programma_opslaan',
      { p_id: programma?.id ?? null, p_naam: naam, p_omschrijving: omschrijving, p_type: type },
      {
        '23505': 'Er is al een programma met deze naam.',
        '23503': 'Het type kan niet meer wijzigen: er hangen nog scholen of uitvoerders aan dit programma.',
      },
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
      <SelectField
        label="Soort programma"
        hint={
          typeVast
            ? 'Vast zolang er scholen of uitvoerders aan dit programma hangen.'
            : PROGRAMMATYPES.find((t) => t.waarde === type)?.uitleg
        }
        disabled={typeVast}
        value={type}
        opties={PROGRAMMATYPES.map((t) => ({ waarde: t.waarde, label: t.label }))}
        onChange={(e) => setType(e.target.value as ProgrammaType)}
      />
      <TextArea label="Omschrijving" maxLength={1000} value={omschrijving} onChange={(e) => setOmschrijving(e.target.value)} />
    </FormulierDialoog>
  )
}
