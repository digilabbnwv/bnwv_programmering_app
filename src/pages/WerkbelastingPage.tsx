import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation, useParams } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useRechten } from '../auth/RechtenProvider'
import { Button } from '../components/Button'
import { Filterbalk } from '../components/Filterbalk'
import { Laadstatus, Melding } from '../components/Melding'
import { TextArea } from '../components/TextArea'
import { useEigenMedewerker } from '../layout/EigenMedewerker'
import { AndereJaren, useJaar } from '../layout/JaarProvider'
import { Pagina } from '../layout/Pagina'
import { PAGINAS } from '../layout/paginas'
import { voerUit, type Toelichting } from '../werkbelasting/api'
import {
  aandeelInJaar,
  berekenWerkbelasting,
  contractPeriodes,
  formatPercentage,
  formatPerWeek,
  formatUren,
  perWeek,
  programmaVolgorde,
  type Werkbelasting,
} from '../werkbelasting/berekening'
import { Verdelingsbalk } from '../werkbelasting/grafieken'
import { FormulierDialoog } from '../werkbelasting/onderdelen'
import { formatDatum, formatPeriode, getalAlsTekst } from '../werkbelasting/opmaak'
import {
  bouwInvoer,
  isGewijzigd,
  laadRapportage,
  memoTeksten,
  totalenVan,
  type Rapportagegegevens,
} from '../werkbelasting/rapportage'
import { signaalTekst } from '../werkbelasting/signalen'
import { useGegevens } from '../werkbelasting/useGegevens'

type Dialoog = 'toelichting' | 'vaststellen' | 'heropenen'

/**
 * Mijn werkurenverdeling: de werkurenverdeling van de medewerker die bij het
 * eigen account hoort, op een vast adres (voor het menu).
 */
export function MijnWerkurenverdelingPage() {
  const eigen = useEigenMedewerker()
  return (
    <Pagina titel="Mijn werkurenverdeling">
      {eigen === undefined ? (
        <Laadstatus fout={null} />
      ) : eigen === null ? (
        <p className="max-w-prose">
          Je account is nog niet gekoppeld aan een medewerker. Vraag de teamleider om dat te doen; daarna zie je hier je eigen
          werkurenverdeling.
        </p>
      ) : (
        <Werkurenverdeling medewerkerId={eigen} />
      )}
    </Pagina>
  )
}

/**
 * Oude links naar /werkbelasting/:id. Wie andere medewerkers mag zien, komt op
 * het tabblad Werkurenverdeling van de medewerker; de medewerker zelf op Mijn
 * werkurenverdeling. ?jaar= blijft staan.
 */
export function NaarWerkurenverdeling() {
  const { id = '' } = useParams()
  const { search } = useLocation()
  const { laden, heeftRecht } = useRechten()
  const eigen = useEigenMedewerker()
  if (laden || (eigen === undefined && !heeftRecht('werkbelasting.bekijken'))) {
    return <Laadstatus fout={null} />
  }
  const naar =
    heeftRecht('werkbelasting.bekijken') || eigen !== id
      ? `${PAGINAS.medewerkers.pad}/${id}/werkurenverdeling`
      : PAGINAS.mijnWerkurenverdeling.pad
  return <Navigate to={{ pathname: naar, search }} replace />
}

/**
 * De werkurenverdeling van één medewerker in het gekozen jaar, zoals de memo,
 * zonder paginakop: voor Mijn werkurenverdeling en het tabblad op de
 * medewerkerpagina. Iedereen kan de eigen verdeling zien; RLS laat anderen
 * alleen toe met werkbelasting.bekijken. Toelichting en vaststellen:
 * werkbelasting.beheren.
 */
export function Werkurenverdeling({ medewerkerId: id }: { medewerkerId: string }) {
  const { jaar } = useJaar()
  const { client } = useAuth()
  const { heeftRecht } = useRechten()
  const magBeheren = heeftRecht('werkbelasting.beheren')
  const laden = useCallback(async () => {
    const res = await laadRapportage(client, jaar)
    return res.ok ? { ok: true as const, data: { jaar, gegevens: res.data } } : res
  }, [client, jaar])
  const { data, fout, herlaad } = useGegevens(laden)
  const [dialoog, setDialoog] = useState<Dialoog | null>(null)
  const sluit = () => setDialoog(null)

  // Bij een ander jaar niet de gegevens van het vorige tonen.
  const gegevens = data?.jaar === jaar ? data.gegevens : null
  const medewerker = gegevens?.medewerkers.find((m) => m.id === id)
  const toelichting = gegevens?.toelichtingen.find((t) => t.medewerker_id === id) ?? null
  const vaststeller = useNaam(toelichting?.vastgesteld_door ?? null)

  if (!gegevens) return <Laadstatus fout={fout} />
  if (!medewerker) return <p>Deze medewerker bestaat niet, of je hebt geen toegang tot deze gegevens.</p>

  const werkjaar = gegevens.werkjaren.find((w) => w.jaar === jaar)

  if (!werkjaar) {
    return (
      <>
        <p>Voor {jaar} zijn nog geen jaarinstellingen vastgelegd.</p>
        <AndereJaren jaren={gegevens.werkjaren.map((w) => w.jaar)} />
      </>
    )
  }

  const w = berekenWerkbelasting(bouwInvoer(gegevens, medewerker.id, werkjaar))
  const vastgesteld = toelichting?.status === 'vastgesteld'
  const gewijzigd = isGewijzigd(toelichting, w)

  return (
    <>
      {/* Op papier staat bovenaan welk jaar en wie het is; op het scherm zeggen kop en tabblad dat al. */}
      <h2 className="sr-only print:not-sr-only print:mb-4 print:text-subkop print:font-bold">
        Werkurenverdeling {jaar} – {medewerker.naam}
      </h2>
      <Filterbalk>
        <Button variant="secundair" onClick={() => window.print()}>
          Afdrukken
        </Button>
        {magBeheren && (
          <>
            <Button variant="secundair" onClick={() => setDialoog('toelichting')}>
              Toelichting wijzigen
            </Button>
            {vastgesteld ? (
              <Button variant="secundair" onClick={() => setDialoog('heropenen')}>
                Terug naar concept
              </Button>
            ) : (
              <Button onClick={() => setDialoog('vaststellen')}>Vaststellen</Button>
            )}
          </>
        )}
      </Filterbalk>

      <Memo
        w={w}
        naam={medewerker.naam}
        gegevens={gegevens}
        medewerkerId={medewerker.id}
        status={
          <StatusRegel toelichting={toelichting} vaststeller={vaststeller} gewijzigd={gewijzigd} />
        }
        toelichting={toelichting?.toelichting ?? ''}
      />

      {dialoog === 'toelichting' && (
        <ToelichtingFormulier medewerkerId={medewerker.id} jaar={jaar} huidig={toelichting?.toelichting ?? ''} onSluiten={sluit} onGelukt={herlaad} />
      )}
      {dialoog === 'vaststellen' && (
        <FormulierDialoog
          titel="Werkurenverdeling vaststellen"
          opslaanLabel="Vaststellen"
          onOpslaan={() =>
            voerUit(client, 'werkbelasting_vaststellen', { p_medewerker_id: medewerker.id, p_jaar: jaar, p_totalen: totalenVan(w) })
          }
          onSluiten={sluit}
          onGelukt={herlaad}
        >
          <p>
            De verdeling van {medewerker.naam} voor {jaar} wordt vastgesteld met de uren van nu. Verandert er later iets, dan
            toont deze pagina dat de gegevens na het vaststellen zijn gewijzigd.
          </p>
          {w.signalen.length > 0 && (
            <Melding soort="info">
              Er {w.signalen.length === 1 ? 'is 1 signaal' : `zijn ${w.signalen.length} signalen`}, bijvoorbeeld:{' '}
              {signaalTekst(w.signalen[0] ?? { soort: 'geen-contract' })}
            </Melding>
          )}
        </FormulierDialoog>
      )}
      {dialoog === 'heropenen' && (
        <FormulierDialoog
          titel="Terug naar concept"
          opslaanLabel="Terug naar concept"
          onOpslaan={() => voerUit(client, 'werkbelasting_heropenen', { p_medewerker_id: medewerker.id, p_jaar: jaar })}
          onSluiten={sluit}
          onGelukt={herlaad}
        >
          <p>De vaststelling vervalt. De toelichting blijft staan.</p>
        </FormulierDialoog>
      )}
    </>
  )
}

/** Weergavenaam bij een user-id (alleen zichtbaar met gebruikers.bekijken of voor jezelf). */
function useNaam(userId: string | null): string | null {
  const { client } = useAuth()
  const [naam, setNaam] = useState<{ id: string; naam: string } | null>(null)
  useEffect(() => {
    if (!userId) return
    let actueel = true
    void client
      .from('profiles')
      .select('weergavenaam')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (actueel && data) setNaam({ id: userId, naam: data.weergavenaam as string })
      })
    return () => {
      actueel = false
    }
  }, [client, userId])
  return naam?.id === userId ? naam.naam : null
}

function StatusRegel({
  toelichting,
  vaststeller,
  gewijzigd,
}: {
  toelichting: Toelichting | null
  vaststeller: string | null
  gewijzigd: boolean
}) {
  if (toelichting?.status !== 'vastgesteld' || !toelichting.vastgesteld_op) {
    return (
      <p>
        <strong>Status:</strong> concept
      </p>
    )
  }
  return (
    <>
      <p>
        <strong>Status:</strong> vastgesteld op {formatDatum(toelichting.vastgesteld_op.slice(0, 10))}
        {vaststeller && ` door ${vaststeller}`}
      </p>
      {gewijzigd && (
        <div className="mt-3">
          <Melding soort="fout">
            De gegevens zijn na het vaststellen gewijzigd. De uren hieronder wijken af van de vastgestelde verdeling
            {toelichting.totalen && ` (vastgesteld: ${formatUren(toelichting.totalen.schooluren)} uur scholen, ${formatUren(toelichting.totalen.uitvoeringsuren ?? 0)} uur programma-uitvoering, ${formatUren(toelichting.totalen.projecturen)} uur projecten, ${formatUren(toelichting.totalen.takenuren ?? 0)} uur overige taken)`}
            .
          </Melding>
        </div>
      )}
    </>
  )
}

function Memo({
  w,
  naam,
  gegevens,
  medewerkerId,
  status,
  toelichting,
}: {
  w: Werkbelasting
  naam: string
  gegevens: Rapportagegegevens
  medewerkerId: string
  status: ReactNode
  toelichting: string
}) {
  const { inleiding, conclusie } = memoTeksten(naam, w)
  const week = (uren: number) => formatPerWeek(perWeek(uren, w.werkweken))
  const deel = (uren: number) => formatPercentage(w.contracturen > 0 ? (uren / w.contracturen) * 100 : 0)
  const procent = (p: number) => `${getalAlsTekst(Math.round(p * 10) / 10)}%`

  // Berekening van de contracturen: "32 uur × 47 weken" bij één contract het hele jaar.
  const periodes = contractPeriodes(gegevens.contracten.filter((c) => c.medewerker_id === medewerkerId)).filter(
    (c) => aandeelInJaar(c, w.jaar) > 0,
  )
  const eenContract = periodes.length === 1 && periodes[0] && aandeelInJaar(periodes[0], w.jaar) === 1 ? periodes[0] : null
  const mijmerPercentage = w.contracturen > 0 ? (w.mijmertijd / w.contracturen) * 100 : 0
  const contractBerekening = eenContract
    ? `${getalAlsTekst(eenContract.uren_per_week)} uur × ${getalAlsTekst(w.werkweken)} weken`
    : periodes.length === 0
      ? 'Geen contract'
      : 'Naar rato van de contractperiodes'

  return (
    <article className="max-w-4xl space-y-8 rounded-card bg-neutral-0 p-6 shadow-card md:p-8 print:max-w-none print:p-0 print:shadow-none">
      <div className="space-y-1 text-ui-sm">{status}</div>

      <MemoSectie titel="Inleiding">
        <p className="max-w-prose">{inleiding}</p>
      </MemoSectie>

      <MemoSectie titel="Uitgangspunten">
        <MemoTabel
          bijschrift="Uitgangspunten"
          koppen={['Onderdeel', 'Berekening', 'Uren per jaar']}
          getallen={[2]}
          rijen={[
            ['Contracturen', contractBerekening, formatUren(w.contracturen)],
            [
              `Beschikbare werktijd (${procent(100 - mijmerPercentage)})`,
              `${formatUren(w.contracturen)} × ${procent(100 - mijmerPercentage)}`,
              formatUren(w.beschikbaar),
            ],
            [`Mijmertijd (${procent(mijmerPercentage)})`, `${formatUren(w.contracturen)} × ${procent(mijmerPercentage)}`, formatUren(w.mijmertijd)],
          ]}
        />
        {periodes.length > 1 && (
          <ul className="mt-3 list-disc pl-6 text-ui-sm">
            {periodes.map((c) => (
              <li key={c.id}>
                {formatPeriode(c.startdatum, c.einddatum)}: {getalAlsTekst(c.uren_per_week)} uur per week
              </li>
            ))}
          </ul>
        )}
      </MemoSectie>

      <MemoSectie titel="Verdeling van de werkuren">
        <MemoTabel
          bijschrift="Verdeling van de werkuren"
          koppen={['Onderdeel', 'Uren per jaar', 'Gemiddeld per week', 'Percentage']}
          getallen={[1, 2, 3]}
          rijen={[
            // Uren per programma (scholen en uitvoering); zonder programma's één regel met nul.
            ...(w.programmas.length > 0
              ? w.programmas.map((p) => [`Programma-uren ${p.programma.naam}`, formatUren(p.uren), week(p.uren), deel(p.uren)])
              : [['Programma-uren scholen', formatUren(0), week(0), deel(0)]]),
            ['Projectgroepen', formatUren(w.projecturen), week(w.projecturen), formatPercentage(w.percentage.projecten)],
            ['Overige taken', formatUren(w.takenuren), week(w.takenuren), formatPercentage(w.percentage.taken)],
            [
              w.overig < 0 ? 'Tekort (overbelast)' : 'Nog niet ingevuld',
              formatUren(w.overig),
              week(w.overig),
              formatPercentage(w.percentage.overig),
            ],
            ['Mijmertijd', formatUren(w.mijmertijd), week(w.mijmertijd), formatPercentage(w.percentage.mijmertijd)],
          ]}
          totaal={['Totaal', formatUren(w.contracturen), week(w.contracturen), deel(w.contracturen)]}
        />
        <div className="mt-5">
          <Verdelingsbalk w={w} />
        </div>
      </MemoSectie>

      <MemoSectie titel="Programma-uren scholen">
        {w.scholen.length === 0 ? (
          <p>Geen scholen in {w.jaar}.</p>
        ) : (
          <MemoTabel
            bijschrift="Programma-uren per schoollocatie"
            koppen={['Schoollocatie', 'Programma', 'Periode', 'Jaaruren', 'Gemiddeld per week', 'Percentage']}
            getallen={[3, 4, 5]}
            rijen={[...w.scholen]
              .sort((a, b) => programmaVolgorde(a, b) || a.naam.localeCompare(b.naam, 'nl'))
              .map((s) => [
                s.naam,
                s.programma.naam,
                s.aandeel < 1 ? formatPeriode(s.periode.startdatum, s.periode.einddatum) : 'Hele jaar',
                formatUren(s.jaaruren),
                week(s.jaaruren),
                deel(s.jaaruren),
              ])}
            totaal={['Totaal', '', '', formatUren(w.schooluren), week(w.schooluren), deel(w.schooluren)]}
          />
        )}
      </MemoSectie>

      {w.uitvoering.length > 0 && (
        <MemoSectie titel="Programma-uitvoering">
          <MemoTabel
            bijschrift="Programma-uitvoering"
            koppen={['Programma', 'Periode', 'Uren per jaar', 'Gemiddeld per week', 'Percentage']}
            getallen={[2, 3, 4]}
            rijen={[...w.uitvoering]
              .sort((a, b) => programmaVolgorde(a, b) || a.periode.startdatum.localeCompare(b.periode.startdatum))
              .map((u) => [
                u.naam,
                u.aandeel < 1 ? formatPeriode(u.periode.startdatum, u.periode.einddatum) : 'Hele jaar',
                formatUren(u.jaaruren),
                week(u.jaaruren),
                deel(u.jaaruren),
              ])}
            totaal={['Totaal', '', formatUren(w.uitvoeringsuren), week(w.uitvoeringsuren), deel(w.uitvoeringsuren)]}
          />
        </MemoSectie>
      )}

      <MemoSectie titel="Projectgroepen">
        {w.projecten.length === 0 ? (
          <p>Geen projectgroepen in {w.jaar}.</p>
        ) : (
          <MemoTabel
            bijschrift="Projectgroepen"
            koppen={['Projectgroep', 'Periode', 'Uren per jaar', 'Gemiddeld per week']}
            getallen={[2, 3]}
            rijen={w.projecten.map((p) => [
              p.naam,
              p.aandeel < 1 ? formatPeriode(p.periode.startdatum, p.periode.einddatum) : 'Hele jaar',
              formatUren(p.jaaruren),
              week(p.jaaruren),
            ])}
            totaal={['Totaal', '', formatUren(w.projecturen), week(w.projecturen)]}
          />
        )}
      </MemoSectie>

      <MemoSectie titel="Overige taken">
        {w.taken.length === 0 ? (
          <p>Geen overige taken in {w.jaar}.</p>
        ) : (
          <MemoTabel
            bijschrift="Overige taken"
            koppen={['Taak', 'Periode', 'Uren per jaar', 'Gemiddeld per week']}
            getallen={[2, 3]}
            rijen={w.taken.map((t) => [
              t.naam,
              t.aandeel < 1 ? formatPeriode(t.periode.startdatum, t.periode.einddatum) : 'Hele jaar',
              formatUren(t.jaaruren),
              week(t.jaaruren),
            ])}
            totaal={['Totaal', '', formatUren(w.takenuren), week(w.takenuren)]}
          />
        )}
      </MemoSectie>

      {w.extraUren.length > 0 && (
        <MemoSectie titel="Extra uren buiten het contract">
          <p className="mb-3 max-w-prose">Deze uren vallen buiten de contracturen en tellen niet mee in de verdeling hierboven.</p>
          <MemoTabel
            bijschrift="Extra uren buiten het contract"
            koppen={['Omschrijving', 'Financier', 'Uren']}
            getallen={[2]}
            rijen={w.extraUren.map((e) => [e.omschrijving, e.financier, formatUren(e.uren)])}
            totaal={['Totaal', '', formatUren(w.extraTotaal)]}
          />
        </MemoSectie>
      )}

      {w.signalen.length > 0 && (
        <MemoSectie titel="Aandachtspunten">
          <ul className="list-disc space-y-1 pl-6">
            {w.signalen.map((s) => (
              <li key={JSON.stringify(s)}>{signaalTekst(s)}</li>
            ))}
          </ul>
        </MemoSectie>
      )}

      {toelichting && (
        <MemoSectie titel="Toelichting">
          <p className="max-w-prose whitespace-pre-line">{toelichting}</p>
        </MemoSectie>
      )}

      {conclusie && (
        <MemoSectie titel="Conclusie">
          <p className="max-w-prose">{conclusie}</p>
        </MemoSectie>
      )}
    </article>
  )
}

function MemoSectie({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="mb-3 text-subkop font-bold">{titel}</h2>
      {children}
    </section>
  )
}

/** Eenvoudige tabel die ook op papier en op een klein scherm een tabel blijft. */
function MemoTabel({
  bijschrift,
  koppen,
  rijen,
  totaal,
  getallen = [],
}: {
  bijschrift: string
  koppen: string[]
  rijen: string[][]
  totaal?: string[]
  getallen?: number[]
}) {
  const uitlijning = (i: number) => (getallen.includes(i) ? 'text-right tabular-nums' : '')
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-left text-ui-sm print:min-w-0">
        <caption className="sr-only">{bijschrift}</caption>
        <thead>
          <tr className="border-b-2 border-neutral-300">
            {koppen.map((k, i) => (
              <th key={k} scope="col" className={`py-2 pr-4 font-semibold last:pr-0 ${uitlijning(i)}`}>
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rijen.map((rij, r) => (
            <tr key={r} className="border-b border-neutral-200">
              {rij.map((cel, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="py-2 pr-4 font-normal">
                    {cel}
                  </th>
                ) : (
                  <td key={i} className={`py-2 pr-4 last:pr-0 ${uitlijning(i)}`}>
                    {cel}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
        {totaal && (
          <tfoot>
            <tr className="border-t-2 border-neutral-300 font-semibold">
              {totaal.map((cel, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="py-2 pr-4">
                    {cel}
                  </th>
                ) : (
                  <td key={i} className={`py-2 pr-4 last:pr-0 ${uitlijning(i)}`}>
                    {cel}
                  </td>
                ),
              )}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

function ToelichtingFormulier({
  medewerkerId,
  jaar,
  huidig,
  onSluiten,
  onGelukt,
}: {
  medewerkerId: string
  jaar: number
  huidig: string
  onSluiten: () => void
  onGelukt: () => void
}) {
  const { client } = useAuth()
  const [tekst, setTekst] = useState(huidig)
  return (
    <FormulierDialoog
      titel="Toelichting"
      onOpslaan={() => voerUit(client, 'toelichting_opslaan', { p_medewerker_id: medewerkerId, p_jaar: jaar, p_toelichting: tekst })}
      onSluiten={onSluiten}
      onGelukt={onGelukt}
    >
      <TextArea
        label="Toelichting"
        hint="Bijv. overdrachten in de loop van het jaar of afspraken over meeruren. Komt in de memo."
        rows={8}
        maxLength={4000}
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
      />
    </FormulierDialoog>
  )
}
