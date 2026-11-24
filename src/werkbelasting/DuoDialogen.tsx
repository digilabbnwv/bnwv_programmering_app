import { useCallback, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Laadstatus, Melding } from '../components/Melding'
import { SelectField } from '../components/SelectField'
import { voerUit, type School } from './api'
import { formatMoment, ophalenBijDuo, rondeTekst, standaardKeuze, type BrinVoorstel, type DuoRonde } from './duo'
import { FormulierDialoog, ongeldig } from './onderdelen'
import { opNaam } from './opmaak'
import { useGegevens } from './useGegevens'

/** Bevestigen en ophalen bij DUO. onGelukt krijgt de tekst voor de pagina. */
export function DuoOphalenDialoog({
  laatste,
  onSluiten,
  onGelukt,
}: {
  laatste: DuoRonde | null
  onSluiten: () => void
  onGelukt: (tekst: string) => void
}) {
  const { client } = useAuth()

  async function ophalen() {
    const res = await ophalenBijDuo(client)
    if (res.ok) onGelukt(rondeTekst(res.data))
    return res
  }

  return (
    <FormulierDialoog
      titel="Leerlingaantallen ophalen bij DUO"
      opslaanLabel="Ophalen"
      bezigLabel="Bezig met ophalen…"
      onOpslaan={ophalen}
      onSluiten={onSluiten}
      onGelukt={() => undefined}
    >
      <p>
        De app haalt de tellingen van 1 oktober op voor alle actieve scholen met een BRIN-nummer. De telling van
        1 oktober van een jaar hoort bij dat werkjaar.
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Lege en overgenomen aantallen worden ingevuld en krijgen het label “DUO”.</li>
        <li>Aantallen die je met de hand hebt ingevuld, blijven staan. Wijkt DUO af, dan zie je dat erachter.</li>
      </ul>
      <p className="text-ui-sm text-neutral-700">
        Dit gebeurt ook elke maand automatisch. DUO publiceert de telling van 1 oktober in januari.
        {laatste && (
          <>
            {' '}
            Laatst opgehaald: {formatMoment(laatste.gestart_op)} ({laatste.door ? 'met de knop' : 'automatisch'}
            {laatste.gelukt ? '' : ', mislukt'}).
          </>
        )}
      </p>
      <p className="text-ui-sm text-neutral-700">Bron: DUO, open onderwijsdata (CC BY).</p>
    </FormulierDialoog>
  )
}

/**
 * Per actieve school zonder BRIN de best passende vestigingen van DUO. Na het
 * koppelen worden de aantallen meteen opgehaald.
 */
export function BrinKoppelenDialoog({
  scholen,
  onSluiten,
  onGelukt,
}: {
  scholen: School[]
  onSluiten: () => void
  onGelukt: (tekst: string) => void
}) {
  const { client } = useAuth()
  const laden = useCallback(() => voerUit<BrinVoorstel[]>(client, 'duo_brin_voorstellen', {}), [client])
  const { data: voorstellen, fout } = useGegevens(laden)
  const [keuze, setKeuze] = useState<Record<string, string>>({})

  const zonderBrin = scholen.filter((s) => s.actief && !s.brin && s.soort !== 'KDV').sort(opNaam)
  const voorstellenVan = (schoolId: string) => (voorstellen ?? []).filter((v) => v.school_id === schoolId)
  const metVoorstel = zonderBrin.filter((s) => voorstellenVan(s.id).length > 0)
  const gekozen = (schoolId: string) => keuze[schoolId] ?? standaardKeuze(voorstellenVan(schoolId))

  async function koppelen() {
    const koppelingen = metVoorstel
      .map((s) => ({ school_id: s.id, brin: gekozen(s.id) }))
      .filter((k) => k.brin)
    if (koppelingen.length === 0) return ongeldig('Kies bij minstens één school een vestiging.')
    const res = await voerUit<number>(client, 'school_brin_koppelen', { p_koppelingen: koppelingen })
    if (!res.ok) return res
    const gekoppeld = `${res.data === 1 ? '1 school is' : `${res.data} scholen zijn`} gekoppeld aan een BRIN-nummer.`
    const ronde = await ophalenBijDuo(client)
    onGelukt(`${gekoppeld} ${ronde.ok ? rondeTekst(ronde.data) : ronde.melding}`)
    return res
  }

  return (
    <FormulierDialoog
      titel="BRIN-nummers koppelen"
      opslaanLabel="Koppelen en ophalen"
      bezigLabel="Bezig met koppelen…"
      onOpslaan={koppelen}
      onSluiten={onSluiten}
      onGelukt={() => undefined}
    >
      {!voorstellen ? (
        <Laadstatus fout={fout} />
      ) : metVoorstel.length === 0 ? (
        <Melding soort="info">
          Er zijn geen voorstellen gevonden. Haal eerst de gegevens op bij DUO, of vul het BRIN-nummer bij de school
          zelf in.
        </Melding>
      ) : (
        <>
          <p>
            Voorstellen uit de vestigingenlijst van DUO (Gelderland), op naam, postcode en plaats. Controleer elk
            voorstel; alleen duidelijke overeenkomsten staan al gekozen.
          </p>
          {metVoorstel.map((s) => (
            <SelectField
              key={s.id}
              label={s.plaats ? `${s.naam} (${s.plaats})` : s.naam}
              value={gekozen(s.id)}
              opties={[
                { waarde: '', label: 'Niet koppelen' },
                ...voorstellenVan(s.id).map((v) => ({
                  waarde: v.vestigingscode,
                  label: `${v.naam} – ${[v.adres, v.plaats].filter(Boolean).join(', ')} (${v.vestigingscode})`,
                })),
              ]}
              onChange={(e) => setKeuze((oud) => ({ ...oud, [s.id]: e.target.value }))}
            />
          ))}
          {zonderBrin.length > metVoorstel.length && (
            <p className="text-ui-sm text-neutral-700">
              {zonderBrin.length - metVoorstel.length === 1
                ? '1 school heeft'
                : `${zonderBrin.length - metVoorstel.length} scholen hebben`}{' '}
              geen voorstel. Vul het BRIN-nummer daar bij de school zelf in.
            </p>
          )}
        </>
      )}
    </FormulierDialoog>
  )
}
