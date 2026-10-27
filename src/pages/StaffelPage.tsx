import { useCallback, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'
import { SelectField } from '../components/SelectField'
import { Tabel } from '../components/Tabel'
import { TextField } from '../components/TextField'
import { Pagina } from '../layout/Pagina'
import {
  lees,
  SCHOOLSOORTEN,
  verwijder,
  voerUit,
  type Resultaat,
  type Schoolsoort,
  type StaffelSchijf,
  type Werkjaar,
} from '../werkbelasting/api'
import { formatUren } from '../werkbelasting/berekening'
import { FormulierDialoog, Gegevens, Laadstatus, ongeldig, Sectie, VerwijderDialoog } from '../werkbelasting/onderdelen'
import { getalAlsTekst, leesGetal } from '../werkbelasting/opmaak'
import { alles, useGegevens } from '../werkbelasting/useGegevens'

type Dialoog =
  | { soort: 'jaar-nieuw' }
  | { soort: 'jaar-wijzigen'; werkjaar: Werkjaar }
  | { soort: 'schijf'; schijf: StaffelSchijf | null; schoolsoort: Schoolsoort }
  | { soort: 'schijf-verwijderen'; schijf: StaffelSchijf }

/** Jaarinstellingen en staffel per jaar en soort school (werkbelasting.beheren). */
export function StaffelPage() {
  const { client } = useAuth()
  const laden = useCallback(
    async () =>
      alles<[Werkjaar[], StaffelSchijf[]]>(
        await Promise.all([
          lees<Werkjaar>(client, 'werkjaren', 'jaar'),
          lees<StaffelSchijf>(client, 'staffel_schijven', 'min_leerlingen'),
        ]),
      ),
    [client],
  )
  const { data, fout, herlaad } = useGegevens(laden)
  const [gekozenJaar, setGekozenJaar] = useState<number | null>(null)
  const [dialoog, setDialoog] = useState<Dialoog | null>(null)
  const [kopieerFout, setKopieerFout] = useState<string | null>(null)
  const sluit = () => setDialoog(null)

  if (!data) {
    return (
      <Pagina titel="Jaar en staffel">
        <Laadstatus fout={fout} />
      </Pagina>
    )
  }

  const [werkjaren, staffel] = data
  const ditJaar = new Date().getFullYear()
  const jaar =
    gekozenJaar ?? (werkjaren.some((w) => w.jaar === ditJaar) ? ditJaar : (werkjaren.at(-1)?.jaar ?? null))
  const werkjaar = werkjaren.find((w) => w.jaar === jaar) ?? null
  const vorigJaar = jaar === null ? [] : staffel.filter((s) => s.jaar === jaar - 1)
  const ditJaarStaffel = staffel.filter((s) => s.jaar === jaar)

  async function kopieerVorigJaar(): Promise<Resultaat<unknown>> {
    for (const s of vorigJaar) {
      const res = await voerUit(client, 'staffel_schijf_opslaan', {
        p_id: null,
        p_jaar: jaar,
        p_schoolsoort: s.schoolsoort,
        p_min_leerlingen: s.min_leerlingen,
        p_max_leerlingen: s.max_leerlingen,
        p_uren: s.uren,
      })
      if (!res.ok) return res
    }
    return { ok: true, data: null }
  }

  return (
    <Pagina
      titel="Jaar en staffel"
      intro="Per kalenderjaar: het aantal werkweken, de mijmertijd en de staffel die bepaalt hoeveel uren een school krijgt."
    >
      {fout && <Laadstatus fout={fout} />}

      <div className="mb-8 flex flex-wrap items-end gap-3">
        {werkjaren.length > 0 && jaar !== null && (
          <SelectField
            label="Jaar"
            value={String(jaar)}
            opties={werkjaren.map((w) => ({ waarde: String(w.jaar), label: String(w.jaar) }))}
            onChange={(e) => setGekozenJaar(Number(e.target.value))}
            className="w-40"
          />
        )}
        <Button variant="secundair" onClick={() => setDialoog({ soort: 'jaar-nieuw' })}>
          Jaar toevoegen
        </Button>
      </div>

      {werkjaar ? (
        <>
          <Sectie
            titel={`Instellingen ${werkjaar.jaar}`}
            acties={
              <Button variant="secundair" onClick={() => setDialoog({ soort: 'jaar-wijzigen', werkjaar })}>
                Wijzigen
              </Button>
            }
          >
            <Gegevens
              regels={[
                ['Werkweken per jaar', getalAlsTekst(werkjaar.werkweken)],
                ['Mijmertijd', `${getalAlsTekst(werkjaar.mijmer_percentage)}% van de contracturen`],
              ]}
            />
          </Sectie>

          {ditJaarStaffel.length === 0 && vorigJaar.length > 0 && (
            <div className="mt-8 space-y-4">
              {kopieerFout && <Laadstatus fout={kopieerFout} />}
              <Button
                variant="secundair"
                onClick={() =>
                  void kopieerVorigJaar().then((res) => {
                    setKopieerFout(res.ok ? null : res.melding)
                    herlaad()
                  })
                }
              >
                Staffel van {werkjaar.jaar - 1} overnemen
              </Button>
            </div>
          )}

          {SCHOOLSOORTEN.map(({ waarde, label }) => (
            <Sectie
              key={waarde}
              titel={`Staffel ${label}`}
              acties={
                <Button variant="secundair" onClick={() => setDialoog({ soort: 'schijf', schijf: null, schoolsoort: waarde })}>
                  Schijf toevoegen<span className="sr-only"> voor {waarde}</span>
                </Button>
              }
            >
              <Tabel
                bijschrift={`Staffel ${label} ${werkjaar.jaar}`}
                rijen={ditJaarStaffel.filter((s) => s.schoolsoort === waarde)}
                sleutel={(s) => s.id}
                leeg="Nog geen schijven voor dit jaar."
                kolommen={[
                  {
                    kop: 'Leerlingen',
                    inhoud: (s) =>
                      s.max_leerlingen === null ? `${s.min_leerlingen} of meer` : `${s.min_leerlingen} t/m ${s.max_leerlingen}`,
                  },
                  { kop: 'Uren per jaar', inhoud: (s) => formatUren(s.uren), getal: true },
                ]}
                acties={(s) => (
                  <>
                    <Button variant="link" onClick={() => setDialoog({ soort: 'schijf', schijf: s, schoolsoort: waarde })}>
                      Wijzigen
                    </Button>
                    <Button variant="link" onClick={() => setDialoog({ soort: 'schijf-verwijderen', schijf: s })}>
                      Verwijderen
                    </Button>
                  </>
                )}
              />
            </Sectie>
          ))}
        </>
      ) : (
        <p>Voeg eerst een jaar toe.</p>
      )}

      {(dialoog?.soort === 'jaar-nieuw' || dialoog?.soort === 'jaar-wijzigen') && (
        <WerkjaarFormulier
          werkjaar={dialoog.soort === 'jaar-wijzigen' ? dialoog.werkjaar : null}
          voorstel={werkjaren.at(-1) ?? null}
          bestaand={werkjaren.map((w) => w.jaar)}
          onSluiten={sluit}
          onGelukt={(nieuwJaar) => {
            setGekozenJaar(nieuwJaar)
            herlaad()
          }}
        />
      )}
      {dialoog?.soort === 'schijf' && jaar !== null && (
        <SchijfFormulier jaar={jaar} schijf={dialoog.schijf} schoolsoort={dialoog.schoolsoort} onSluiten={sluit} onGelukt={herlaad} />
      )}
      {dialoog?.soort === 'schijf-verwijderen' && (
        <VerwijderDialoog
          wat="Schijf"
          onVerwijderen={() => verwijder(client, 'staffel_schijven', dialoog.schijf.id)}
          onSluiten={sluit}
          onGelukt={herlaad}
        />
      )}
    </Pagina>
  )
}

function WerkjaarFormulier({
  werkjaar,
  voorstel,
  bestaand,
  onSluiten,
  onGelukt,
}: {
  werkjaar: Werkjaar | null
  voorstel: Werkjaar | null
  bestaand: number[]
  onSluiten: () => void
  onGelukt: (jaar: number) => void
}) {
  const { client } = useAuth()
  const basis = werkjaar ?? voorstel
  const [jaar, setJaar] = useState(String(werkjaar?.jaar ?? (voorstel ? voorstel.jaar + 1 : new Date().getFullYear())))
  const [werkweken, setWerkweken] = useState(getalAlsTekst(basis?.werkweken ?? 47))
  const [mijmer, setMijmer] = useState(getalAlsTekst(basis?.mijmer_percentage ?? 20))

  async function opslaan() {
    const j = leesGetal(jaar)
    const w = leesGetal(werkweken)
    const m = leesGetal(mijmer)
    if (j === null || !Number.isInteger(j) || j < 2000 || j > 2100) return ongeldig('Vul een jaar in tussen 2000 en 2100.')
    if (!werkjaar && bestaand.includes(j)) return ongeldig(`${j} bestaat al.`)
    if (w === null || w <= 0 || w > 53) return ongeldig('Vul een aantal werkweken in tussen 1 en 53.')
    if (m === null || m < 0 || m > 100) return ongeldig('Vul een mijmerpercentage in tussen 0 en 100.')
    const res = await voerUit(client, 'werkjaar_opslaan', { p_jaar: j, p_werkweken: w, p_mijmer_percentage: m })
    if (res.ok) onGelukt(j)
    return res
  }

  return (
    <FormulierDialoog
      titel={werkjaar ? `Instellingen ${werkjaar.jaar}` : 'Jaar toevoegen'}
      onOpslaan={opslaan}
      onSluiten={onSluiten}
      onGelukt={() => undefined}
    >
      {!werkjaar && (
        <TextField label="Jaar" inputMode="numeric" value={jaar} onChange={(e) => setJaar(e.target.value)} />
      )}
      <TextField
        label="Werkweken per jaar"
        hint="Weken waarin gewerkt wordt, zonder vakantie. Standaard 47."
        inputMode="decimal"
        value={werkweken}
        onChange={(e) => setWerkweken(e.target.value)}
      />
      <TextField
        label="Mijmertijd (%)"
        hint="Deel van de contracturen voor ontwikkeling en vernieuwing. Standaard 20."
        inputMode="decimal"
        value={mijmer}
        onChange={(e) => setMijmer(e.target.value)}
      />
    </FormulierDialoog>
  )
}

function SchijfFormulier({
  jaar,
  schijf,
  schoolsoort,
  onSluiten,
  onGelukt,
}: {
  jaar: number
  schijf: StaffelSchijf | null
  schoolsoort: Schoolsoort
  onSluiten: () => void
  onGelukt: () => void
}) {
  const { client } = useAuth()
  const [min, setMin] = useState(getalAlsTekst(schijf?.min_leerlingen ?? 0))
  const [max, setMax] = useState(getalAlsTekst(schijf?.max_leerlingen))
  const [uren, setUren] = useState(getalAlsTekst(schijf?.uren))

  function opslaan() {
    const van = leesGetal(min)
    const tot = max.trim() === '' ? null : leesGetal(max)
    const u = leesGetal(uren)
    if (van === null || !Number.isInteger(van) || van < 0) return ongeldig('Vul bij "Vanaf" een heel aantal leerlingen in.')
    if (max.trim() !== '' && (tot === null || !Number.isInteger(tot) || tot < van))
      return ongeldig('"Tot en met" moet een heel getal zijn, minstens gelijk aan "Vanaf". Laat het leeg voor geen bovengrens.')
    if (u === null || u < 0) return ongeldig('Vul het aantal uren per jaar in.')
    return voerUit(
      client,
      'staffel_schijf_opslaan',
      {
        p_id: schijf?.id ?? null,
        p_jaar: jaar,
        p_schoolsoort: schoolsoort,
        p_min_leerlingen: van,
        p_max_leerlingen: tot,
        p_uren: u,
      },
      { '23P01': 'Deze schijf overlapt met een andere schijf in dit jaar.' },
    )
  }

  return (
    <FormulierDialoog
      titel={`${schijf ? 'Schijf wijzigen' : 'Schijf toevoegen'} (${schoolsoort} ${jaar})`}
      onOpslaan={opslaan}
      onSluiten={onSluiten}
      onGelukt={onGelukt}
    >
      <TextField label="Vanaf (leerlingen)" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} />
      <TextField
        label="Tot en met (leerlingen)"
        hint="Leeg laten voor geen bovengrens."
        inputMode="numeric"
        value={max}
        onChange={(e) => setMax(e.target.value)}
      />
      <TextField label="Uren per jaar" inputMode="decimal" value={uren} onChange={(e) => setUren(e.target.value)} />
    </FormulierDialoog>
  )
}
