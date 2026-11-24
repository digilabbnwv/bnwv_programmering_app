import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '../components/Button'
import { Dialoog } from '../components/Dialoog'
import { Melding } from '../components/Melding'
import type { Resultaat } from './api'
import type { DuoStatus } from './duo'

/**
 * Dialoog met een formulier. onOpslaan controleert de invoer (geeft dan een
 * melding terug) of slaat op. Bij succes sluit de dialoog en volgt onGelukt.
 */
export function FormulierDialoog({
  titel,
  opslaanLabel = 'Opslaan',
  bezigLabel = 'Bezig met opslaan…',
  onOpslaan,
  onSluiten,
  onGelukt,
  children,
}: {
  titel: string
  opslaanLabel?: string
  bezigLabel?: string
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
            {bezig ? bezigLabel : opslaanLabel}
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

const LABEL = 'ml-2 inline-block rounded-pill bg-neutral-100 px-2 py-0.5 text-ui-xs font-semibold text-neutral-700'

/** Label bij een leerlingaantal dat van het vorige jaar is overgenomen en nog niet is bijgewerkt. */
export function Overgenomen({ jaar }: { jaar: number }) {
  return (
    <span className={LABEL}>
      overgenomen<span className="sr-only"> van {jaar}, nog niet bijgewerkt</span>
    </span>
  )
}

/** Label of hint bij een leerlingaantal: van DUO, of een afwijkende telling van DUO. */
export function DuoLabel({ status, jaar }: { status: DuoStatus; jaar: number }) {
  if (!status) return null
  if (status.soort === 'duo') {
    return (
      <span className={LABEL} title={`Telling van DUO op 1 oktober ${jaar}`}>
        DUO<span className="sr-only">, telling 1 oktober {jaar}</span>
      </span>
    )
  }
  return (
    <span className="ml-2 text-ui-xs text-neutral-700" title={`Telling van DUO op 1 oktober ${jaar}`}>
      DUO: {status.aantal}
    </span>
  )
}
