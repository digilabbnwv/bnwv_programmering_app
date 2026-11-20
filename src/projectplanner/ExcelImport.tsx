import { useId, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'
import { Melding } from '../components/Melding'
import type { Afdeling, Tak } from '../organisatie/api'
import { voerUit, type Programma } from '../werkbelasting/api'
import { formatUren } from '../werkbelasting/berekening'
import { formatEuro } from './berekening'
import { leesWerkboek } from './excel'
import { alsImport, maakVoorstel, type Voorstel } from './voorstel'

/**
 * Concept-jaarplan uit de projectplanner-Excel overnemen. De browser leest het
 * bestand; daarna kiest de gebruiker welke projecten erin komen. Alleen die
 * gaan naar de database (jaarplan_importeren), het bestand zelf niet.
 */
export function ExcelImport({
  jaar,
  afdelingen,
  takken,
  programmas,
  onGelukt,
}: {
  jaar: number
  afdelingen: Afdeling[]
  takken: Tak[]
  programmas: Programma[]
  onGelukt: () => void
}) {
  const { client } = useAuth()
  const invoerId = useId()
  const [voorstellen, setVoorstellen] = useState<Voorstel[] | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)

  async function lees(bestand: File | undefined) {
    if (!bestand) return
    setFout(null)
    setBezig(true)
    try {
      const v = maakVoorstel(await leesWerkboek(await bestand.arrayBuffer()), afdelingen, takken, programmas)
      if (v.length === 0) setFout('Geen projecten gevonden. Is dit de projectplanner, met een tabblad per afdeling?')
      setVoorstellen(v.length > 0 ? v : null)
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Het bestand kan niet gelezen worden.')
    }
    setBezig(false)
  }

  async function overnemen() {
    if (!voorstellen) return
    setBezig(true)
    setFout(null)
    const res = await voerUit(
      client,
      'jaarplan_importeren',
      { p_jaar: jaar, p_projecten: alsImport(voorstellen, jaar) },
      { '23505': 'Dit jaarplan heeft al projecten.', '23503': 'Een afdeling uit de Excel bestaat niet in de app.' },
    )
    setBezig(false)
    if (res.ok) onGelukt()
    else setFout(res.melding)
  }

  const zet = (sleutel: string, overnemen: boolean) =>
    setVoorstellen((oud) => oud?.map((v) => (v.sleutel === sleutel ? { ...v, overnemen } : v)) ?? null)
  const gekozen = voorstellen?.filter((v) => v.overnemen).length ?? 0

  if (!voorstellen) {
    return (
      <Melding soort="info">
        <h2 className="mb-2 font-bold">Projecten uit de Excel overnemen</h2>
        <p className="mb-4 max-w-prose">
          Het jaarplan is nog leeg. Kies de projectplanner-Excel; de app leest hem in je browser en laat zien wat hij overneemt. Je kiest
          zelf welke projecten erin komen. Het bestand zelf wordt niet opgeslagen.
        </p>
        {fout && (
          <p role="alert" className="mb-4 font-semibold">
            {fout}
          </p>
        )}
        <label htmlFor={invoerId} className="block font-semibold">
          Excel-bestand (.xlsx)
        </label>
        <input
          id={invoerId}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={bezig}
          className="mt-2 block"
          onChange={(e) => void lees(e.target.files?.[0])}
        />
        {bezig && <p role="status">Bezig met lezen…</p>}
      </Melding>
    )
  }

  return (
    <section aria-labelledby={`${invoerId}-titel`} className="rounded-card bg-neutral-0 p-5 shadow-card">
      <h2 id={`${invoerId}-titel`} className="text-subkop font-bold">
        Controleer wat er overgenomen wordt
      </h2>
      <p className="mt-2 max-w-prose">
        {voorstellen.length} projecten gevonden. Rijen van hetzelfde project zijn samengevoegd. Programma’s staan uit. Zet ook uit wat dubbel
        is of niet in het jaarplan hoort; namen, looptijd en inzet pas je daarna per project aan. Alles komt erin als ingediend, met de
        looptijd van heel {jaar} en de gegevens uit de Excel in de toelichting.
      </p>
      {fout && (
        <div className="mt-4">
          <Melding soort="fout">{fout}</Melding>
        </div>
      )}

      {afdelingen.map((afdeling) => {
        const lijst = voorstellen.filter((v) => v.afdeling.id === afdeling.id)
        if (lijst.length === 0) return null
        return (
          <fieldset key={afdeling.id} className="mt-6">
            <legend className="font-bold">
              {afdeling.naam} ({lijst.filter((v) => v.overnemen).length} van {lijst.length})
            </legend>
            <ul className="mt-2 divide-y divide-neutral-100">
              {lijst.map((v) => (
                <VoorstelRegel key={v.sleutel} voorstel={v} onWijzig={(aan) => zet(v.sleutel, aan)} />
              ))}
            </ul>
          </fieldset>
        )
      })}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={() => void overnemen()} disabled={bezig || gekozen === 0}>
          {bezig ? 'Bezig met overnemen…' : `${gekozen} projecten overnemen`}
        </Button>
        <Button variant="secundair" onClick={() => setVoorstellen(null)} disabled={bezig}>
          Annuleren
        </Button>
      </div>
    </section>
  )
}

function VoorstelRegel({ voorstel: v, onWijzig }: { voorstel: Voorstel; onWijzig: (aan: boolean) => void }) {
  const id = useId()
  const notities = [
    v.tak ? v.tak.naam : v.takNaam ? `tak “${v.takNaam}” niet gevonden` : 'geen tak',
    v.isProgramma ? `is het programma ${v.programma?.naam ?? ''}` : v.programma ? `hoort bij programma ${v.programma.naam}` : '',
    v.zonderUren ? 'zonder uren' : '',
    v.inzetVan.length > 0 ? `inzet van ${v.inzetVan.join(', ')}` : '',
    v.weekuren > 0 ? `${formatUren(v.weekuren)} uur in het weekraster` : '',
    v.budget !== null ? `budget ${formatEuro(v.budget)}` : '',
  ].filter(Boolean)
  const samengevoegd = v.rijen.length > 1 ? `Samengevoegd uit ${v.rijen.join(' en ')}.` : ''
  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          className="mt-1 size-5 shrink-0 accent-anthracite"
          checked={v.overnemen}
          aria-describedby={`${id}-details`}
          onChange={(e) => onWijzig(e.target.checked)}
        />
        <div>
          <label htmlFor={id} className="font-semibold">
            {v.naam}
          </label>
          <p id={`${id}-details`} className="text-ui-sm text-neutral-700">
            {notities.join(' · ')}
            {samengevoegd && <span className="block">{samengevoegd}</span>}
            {v.lijktOp.length > 0 && <span className="block font-semibold text-anthracite">Lijkt op: {v.lijktOp.join(', ')}.</span>}
          </p>
        </div>
      </div>
    </li>
  )
}
