import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '../components/Button'
import { Dialoog } from '../components/Dialoog'
import { Melding } from '../components/Melding'
import type { Resultaat } from './api'

/**
 * Dialoog met een formulier. onOpslaan controleert de invoer (geeft dan een
 * melding terug) of slaat op. Bij succes sluit de dialoog en volgt onGelukt.
 */
export function FormulierDialoog({
  titel,
  opslaanLabel = 'Opslaan',
  onOpslaan,
  onSluiten,
  onGelukt,
  children,
}: {
  titel: string
  opslaanLabel?: string
  onOpslaan: () => Promise<Resultaat<unknown>> | Resultaat<unknown>
  onSluiten: () => void
  onGelukt: () => void
  children: ReactNode
}) {
  const [fout, setFout] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)

  async function opVersturen(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBezig(true)
    setFout(null)
    const res = await onOpslaan()
    setBezig(false)
    if (!res.ok) {
      setFout(res.melding)
      return
    }
    onGelukt()
    onSluiten()
  }

  return (
    <Dialoog titel={titel} onSluiten={onSluiten}>
      <form onSubmit={opVersturen} noValidate className="space-y-5">
        {fout && <Melding soort="fout">{fout}</Melding>}
        {children}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={bezig}>
            {bezig ? 'Bezig met opslaan…' : opslaanLabel}
          </Button>
          <Button variant="secundair" onClick={onSluiten}>
            Annuleren
          </Button>
        </div>
      </form>
    </Dialoog>
  )
}

/** Vraagt om bevestiging voordat iets verwijderd wordt. */
export function VerwijderDialoog({
  wat,
  toelichting,
  onVerwijderen,
  onSluiten,
  onGelukt,
}: {
  wat: string
  toelichting?: string
  onVerwijderen: () => Promise<Resultaat<unknown>>
  onSluiten: () => void
  onGelukt: () => void
}) {
  return (
    <FormulierDialoog
      titel={`${wat} verwijderen`}
      opslaanLabel="Verwijderen"
      onOpslaan={onVerwijderen}
      onSluiten={onSluiten}
      onGelukt={onGelukt}
    >
      <p>Weet je het zeker? Dit kan niet ongedaan worden gemaakt.</p>
      {toelichting && <p className="text-ui-sm text-neutral-700">{toelichting}</p>}
    </FormulierDialoog>
  )
}

/** Fout bij ongeldige invoer, zonder de database aan te roepen. */
export function ongeldig(melding: string): Resultaat<never> {
  return { ok: false, melding }
}

export function Sectie({
  titel,
  acties,
  children,
}: {
  titel: string
  acties?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="mt-10 first:mt-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-subkop font-bold">{titel}</h2>
        {acties && <div className="flex flex-wrap gap-3">{acties}</div>}
      </div>
      {children}
    </section>
  )
}

/** Gegevens als lijst van label en waarde. Lege waarden worden weggelaten. */
export function Gegevens({ regels }: { regels: [string, ReactNode][] }) {
  const gevuld = regels.filter(([, waarde]) => waarde !== '' && waarde !== null && waarde !== undefined)
  return (
    <dl className="grid gap-x-6 gap-y-2 rounded-card bg-neutral-0 p-5 shadow-card sm:grid-cols-[max-content_1fr]">
      {gevuld.map(([label, waarde]) => (
        <div key={label} className="contents">
          <dt className="font-semibold">{label}</dt>
          <dd className="mb-2 sm:mb-0">{waarde}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Laad- en foutstatus van een pagina. */
export function Laadstatus({ fout }: { fout: string | null }) {
  if (fout) return <Melding soort="fout">{fout}</Melding>
  return <p role="status">Bezig met laden…</p>
}
