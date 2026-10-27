import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Selectievakje } from '../components/Selectievakje'
import { SelectField } from '../components/SelectField'
import { TextArea } from '../components/TextArea'
import { TextField } from '../components/TextField'
import { SCHOOLSOORTEN, voerUit, type Programma, type School, type Schoolsoort } from './api'
import { FormulierDialoog, ongeldig } from './onderdelen'

export function SchoolFormulier({
  school,
  programmas,
  onSluiten,
  onGelukt,
}: {
  school: School | null
  programmas: Programma[]
  onSluiten: () => void
  onGelukt: (id: string) => void
}) {
  const { client } = useAuth()
  const [v, setV] = useState({
    naam: school?.naam ?? '',
    soort: school?.soort ?? ('PO' as Schoolsoort),
    programma_id: school ? (school.programma_id ?? '') : (programmas.find((p) => p.naam === 'dBos')?.id ?? ''),
    brin: school?.brin ?? '',
    matt_projectnummer: school?.matt_projectnummer ?? '',
    adres: school?.adres ?? '',
    postcode: school?.postcode ?? '',
    plaats: school?.plaats ?? '',
    contactpersoon: school?.contactpersoon ?? '',
    email: school?.email ?? '',
    telefoon: school?.telefoon ?? '',
    opmerking: school?.opmerking ?? '',
    actief: school?.actief ?? true,
  })
  const zet = <K extends keyof typeof v>(veld: K, waarde: (typeof v)[K]) => setV((oud) => ({ ...oud, [veld]: waarde }))

  async function opslaan() {
    if (!v.naam.trim()) return ongeldig('Vul de naam van de school in.')
    if (v.brin.trim() && !/^[0-9A-Z]{4}([0-9]{2})?$/i.test(v.brin.trim()))
      return ongeldig('Een BRIN-nummer bestaat uit 4 tekens, eventueel gevolgd door 2 cijfers (bijv. 12AB of 12AB00).')
    if (v.postcode.trim() && !/^[1-9][0-9]{3} ?[A-Z]{2}$/i.test(v.postcode.trim()))
      return ongeldig('Vul een postcode in zoals 3841 AB.')
    if (v.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) return ongeldig('Vul een geldig e-mailadres in.')
    const res = await voerUit<string>(client, 'school_opslaan', {
      p_id: school?.id ?? null,
      p_naam: v.naam,
      p_soort: v.soort,
      p_programma_id: v.programma_id || null,
      p_brin: v.brin,
      p_matt_projectnummer: v.matt_projectnummer,
      p_adres: v.adres,
      p_postcode: v.postcode,
      p_plaats: v.plaats,
      p_contactpersoon: v.contactpersoon,
      p_email: v.email,
      p_telefoon: v.telefoon,
      p_opmerking: v.opmerking,
      p_actief: v.actief,
    })
    if (res.ok) onGelukt(res.data)
    return res
  }

  return (
    <FormulierDialoog
      titel={school ? 'School wijzigen' : 'Nieuwe school'}
      onOpslaan={opslaan}
      onSluiten={onSluiten}
      onGelukt={() => undefined}
    >
      <TextField label="Naam" maxLength={120} value={v.naam} onChange={(e) => zet('naam', e.target.value)} />
      <SelectField
        label="Soort"
        value={v.soort}
        opties={SCHOOLSOORTEN.map((s) => ({ waarde: s.waarde, label: s.label }))}
        onChange={(e) => zet('soort', e.target.value as Schoolsoort)}
      />
      <SelectField
        label="Programma"
        value={v.programma_id}
        opties={[{ waarde: '', label: 'Geen programma' }, ...programmas.map((p) => ({ waarde: p.id, label: p.naam }))]}
        onChange={(e) => zet('programma_id', e.target.value)}
      />
      <TextField label="BRIN-nummer" hint="Optioneel." maxLength={6} value={v.brin} onChange={(e) => zet('brin', e.target.value)} />
      <TextField
        label="MATT projectnummer"
        hint="Optioneel."
        autoComplete="off"
        maxLength={30}
        value={v.matt_projectnummer}
        onChange={(e) => zet('matt_projectnummer', e.target.value)}
      />
      <TextField label="Adres" autoComplete="off" maxLength={200} value={v.adres} onChange={(e) => zet('adres', e.target.value)} />
      <div className="grid gap-5 sm:grid-cols-[10rem_1fr]">
        <TextField label="Postcode" autoComplete="off" maxLength={7} value={v.postcode} onChange={(e) => zet('postcode', e.target.value)} />
        <TextField label="Plaats" autoComplete="off" maxLength={100} value={v.plaats} onChange={(e) => zet('plaats', e.target.value)} />
      </div>
      <TextField
        label="Contactpersoon"
        autoComplete="off"
        maxLength={120}
        value={v.contactpersoon}
        onChange={(e) => zet('contactpersoon', e.target.value)}
      />
      <TextField label="E-mailadres" type="email" autoComplete="off" maxLength={254} value={v.email} onChange={(e) => zet('email', e.target.value)} />
      <TextField label="Telefoon" type="tel" autoComplete="off" maxLength={30} value={v.telefoon} onChange={(e) => zet('telefoon', e.target.value)} />
      <TextArea label="Opmerking" maxLength={2000} value={v.opmerking} onChange={(e) => zet('opmerking', e.target.value)} />
      <Selectievakje label="Actief" checked={v.actief} onChange={(e) => zet('actief', e.target.checked)} />
    </FormulierDialoog>
  )
}
