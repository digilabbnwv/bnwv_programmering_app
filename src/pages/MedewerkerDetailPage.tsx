import { useCallback, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useRechten } from '../auth/RechtenProvider'
import { Button } from '../components/Button'
import { SelectField } from '../components/SelectField'
import { Tabel } from '../components/Tabel'
import { TextField } from '../components/TextField'
import { Gegevens, Sectie } from '../components/Sectie'
import { Laadstatus } from '../components/Melding'
import { Tekstlink } from '../components/Tekstlink'
import { Pagina } from '../layout/Pagina'
import { PAGINAS } from '../layout/paginas'
import { Tabbladen, useTabblad } from '../layout/Tabbladen'
import { indeling, type Afdeling, type Functie } from '../organisatie/api'
import {
  lees,
  verwijder,
  voerUit,
  type Contract,
  type Deelnemer,
  type ExtraUren,
  type Medewerker,
  type Programma,
  type ProgrammaUitvoerder,
  type Projectgroep,
  type Taak,
  type TaakUitvoerder,
  type School,
  type Toewijzing,
  type Werkjaar,
} from '../werkbelasting/api'
import { contractPeriodes, formatUren } from '../werkbelasting/berekening'
import { MedewerkerFormulier } from '../werkbelasting/MedewerkerFormulier'
import { FormulierDialoog, ongeldig, VerwijderDialoog } from '../werkbelasting/onderdelen'
import { formatDatum, formatPeriode, getalAlsTekst, leesGetal, loopt, opNaam } from '../werkbelasting/opmaak'
import { alles, useGegevens } from '../werkbelasting/useGegevens'
import { Werkurenverdeling } from './WerkbelastingPage'

type Dialoog =
  | { soort: 'wijzigen' }
  | { soort: 'verwijderen' }
  | { soort: 'contract'; contract: Contract | null }
  | { soort: 'contract-verwijderen'; contract: Contract }
  | { soort: 'extra'; extra: ExtraUren | null }
  | { soort: 'extra-verwijderen'; extra: ExtraUren }

/**
 * Eén medewerker in vier tabbladen: gegevens en contract, werk (scholen,
 * programma-uitvoering, projectgroepen, overige taken), extra uren en de
 * werkurenverdeling. Met werkbelasting.bekijken alleen-lezen (MT); wijzigen
 * met werkbelasting.beheren.
 */
export function MedewerkerDetailPage() {
  const { id = '' } = useParams()
  const tabbladen = PAGINAS.medewerker.tabbladen
  const tab = useTabblad(tabbladen)
  const { heeftRecht } = useRechten()
  const magBeheren = heeftRecht('werkbelasting.beheren')
  const { client } = useAuth()
  const navigate = useNavigate()
  const laden = useCallback(
    async () =>
      alles<
        [
          Medewerker[],
          Contract[],
          ExtraUren[],
          Toewijzing[],
          Deelnemer[],
          School[],
          Projectgroep[],
          Werkjaar[],
          TaakUitvoerder[],
          Taak[],
          ProgrammaUitvoerder[],
          Programma[],
          Afdeling[],
          Functie[],
        ]
      >(
        await Promise.all([
          lees<Medewerker>(client, 'medewerkers', 'naam'),
          lees<Contract>(client, 'contracten', 'ingangsdatum', { kolom: 'medewerker_id', waarde: id }),
          lees<ExtraUren>(client, 'extra_uren', 'jaar', { kolom: 'medewerker_id', waarde: id }),
          lees<Toewijzing>(client, 'school_toewijzingen', 'startdatum', { kolom: 'medewerker_id', waarde: id }),
          lees<Deelnemer>(client, 'projectgroep_deelnemers', 'startdatum', { kolom: 'medewerker_id', waarde: id }),
          lees<School>(client, 'scholen', 'naam'),
          lees<Projectgroep>(client, 'projectgroepen', 'naam'),
          lees<Werkjaar>(client, 'werkjaren', 'jaar'),
          lees<TaakUitvoerder>(client, 'taak_uitvoerders', 'startdatum', { kolom: 'medewerker_id', waarde: id }),
          lees<Taak>(client, 'taken', 'naam'),
          lees<ProgrammaUitvoerder>(client, 'programma_uitvoerders', 'startdatum', { kolom: 'medewerker_id', waarde: id }),
          lees<Programma>(client, 'programmas', 'naam'),
          lees<Afdeling>(client, 'afdelingen', 'volgorde'),
          lees<Functie>(client, 'functies', 'naam'),
        ]),
      ),
    [client, id],
  )
  const { data, fout, herlaad } = useGegevens(laden)
  const [dialoog, setDialoog] = useState<Dialoog | null>(null)
  const sluit = () => setDialoog(null)

  if (tab === null) return <Navigate to=".." relative="path" replace />
  if (!data) {
    return (
      <Pagina titel="Medewerker">
        <Laadstatus fout={fout} />
      </Pagina>
    )
  }

  const [
    medewerkers,
    contracten,
    extraUren,
    toewijzingen,
    deelnames,
    scholen,
    projectgroepen,
    werkjaren,
    uitvoeringen,
    taken,
    programmaUitvoeringen,
    programmas,
    afdelingen,
    functies,
  ] = data
  const medewerker = medewerkers.find((m) => m.id === id)
  if (!medewerker) {
    return (
      <Pagina titel="Medewerker niet gevonden">
        <Tekstlink to="/medewerkers">
          Terug naar medewerkers
        </Tekstlink>
      </Pagina>
    )
  }

  const periodes = contractPeriodes(contracten).reverse()
  const schoolNaam = (schoolId: string | null) => scholen.find((s) => s.id === schoolId)?.naam ?? ''
  const nieuwsteEerst = <T extends { startdatum: string }>(rijen: T[]) =>
    [...rijen].sort((a, b) => b.startdatum.localeCompare(a.startdatum))
  // Scholen, programma's, projectgroepen en taken zijn alleen te openen met werkbelasting.beheren.
  const naar = (pad: string, tekst: string) =>
    magBeheren ? (
      <Tekstlink to={pad} licht>
        {tekst}
      </Tekstlink>
    ) : (
      tekst
    )

  return (
    <Pagina titel={medewerker.naam} intro={indeling(medewerker, functies, afdelingen) ?? 'Nog niet ingedeeld in een functie en afdeling.'}>
      <Tabbladen tabbladen={tabbladen} actief={tab} />

      {tab === '' && (
        <>
          <Sectie
            titel="Gegevens"
            acties={
              magBeheren && (
                <>
                  <Button variant="secundair" onClick={() => setDialoog({ soort: 'wijzigen' })}>
                    Wijzigen
                  </Button>
                  <Button variant="secundair" onClick={() => setDialoog({ soort: 'verwijderen' })}>
                    Verwijderen
                  </Button>
                </>
              )
            }
          >
            <Gegevens
              regels={[
                ['Status', medewerker.actief ? 'Actief' : 'Inactief'],
                ['E-mailadres', medewerker.email],
                ['Inlogaccount', medewerker.user_id ? 'Gekoppeld' : 'Geen'],
                ['Opmerking', medewerker.opmerking ? <span className="whitespace-pre-line">{medewerker.opmerking}</span> : ''],
              ]}
            />
          </Sectie>

          <Sectie
            titel="Contract"
            acties={
              magBeheren && (
                <Button variant="secundair" onClick={() => setDialoog({ soort: 'contract', contract: null })}>
                  Contractwijziging toevoegen
                </Button>
              )
            }
          >
            <p className="mb-4 max-w-prose text-neutral-700">
              Een contract geldt vanaf de ingangsdatum tot de volgende wijziging. Leeg bij werkweken of mijmertijd betekent: de
              waarde van het jaar.
            </p>
            <Tabel
              bijschrift="Contracthistorie"
              rijen={periodes}
              sleutel={(c) => c.id}
              leeg="Nog geen contract. Zonder contract kan de werkbelasting niet berekend worden."
              kolommen={[
                { kop: 'Periode', inhoud: (c) => formatPeriode(c.startdatum, c.einddatum) },
                { kop: 'Uren per week', inhoud: (c) => getalAlsTekst(c.uren_per_week), getal: true },
                { kop: 'Werkweken', inhoud: (c) => (c.werkweken === null ? 'Van het jaar' : getalAlsTekst(c.werkweken)), getal: true },
                {
                  kop: 'Mijmertijd',
                  inhoud: (c) => (c.mijmer_percentage === null ? 'Van het jaar' : `${getalAlsTekst(c.mijmer_percentage)}%`),
                  getal: true,
                },
              ]}
              acties={magBeheren ? (c) => (
                <>
                  <Button variant="link" onClick={() => setDialoog({ soort: 'contract', contract: c })}>
                    Wijzigen<span className="sr-only"> contract vanaf {formatDatum(c.ingangsdatum)}</span>
                  </Button>
                  <Button variant="link" onClick={() => setDialoog({ soort: 'contract-verwijderen', contract: c })}>
                    Verwijderen<span className="sr-only"> contract vanaf {formatDatum(c.ingangsdatum)}</span>
                  </Button>
                </>
              ) : undefined}
            />
          </Sectie>
        </>
      )}

      {tab === 'werk' && (
        <>
          <Sectie titel="Scholen">
            <Tabel
              bijschrift="Scholen van deze medewerker"
              rijen={nieuwsteEerst(toewijzingen)}
              sleutel={(t) => t.id}
              leeg="Geen scholen. Wijs scholen toe vanaf de pagina van de school."
              kolommen={[
                {
                  kop: 'School',
                  inhoud: (t) => naar(`/scholen/${t.school_id}`, schoolNaam(t.school_id)),
                },
                { kop: 'Periode', inhoud: (t) => formatPeriode(t.startdatum, t.einddatum) },
                { kop: 'Nu', inhoud: (t) => (loopt(t) ? 'Ja' : 'Nee') },
              ]}
            />
          </Sectie>

          <Sectie titel="Programma-uitvoering">
            <Tabel
              bijschrift="Programma's waarvan deze medewerker vaste uitvoerder is"
              rijen={nieuwsteEerst(programmaUitvoeringen)}
              sleutel={(u) => u.id}
              leeg="Geen programma-uitvoering. Voeg uitvoerders toe vanaf de pagina van het programma."
              kolommen={[
                {
                  kop: 'Programma',
                  inhoud: (u) => naar(`/programmas/${u.programma_id}`, programmas.find((p) => p.id === u.programma_id)?.naam ?? 'Onbekend'),
                },
                { kop: 'Uren per jaar', inhoud: (u) => formatUren(u.uren_per_jaar), getal: true },
                { kop: 'Periode', inhoud: (u) => formatPeriode(u.startdatum, u.einddatum) },
              ]}
            />
          </Sectie>

          <Sectie titel="Projectgroepen">
            <Tabel
              bijschrift="Projectgroepen van deze medewerker"
              rijen={nieuwsteEerst(deelnames)}
              sleutel={(d) => d.id}
              leeg="Geen projectgroepen. Voeg deelnemers toe vanaf de pagina van de projectgroep."
              kolommen={[
                {
                  kop: 'Projectgroep',
                  inhoud: (d) =>
                    naar(`/projectgroepen/${d.projectgroep_id}`, projectgroepen.find((p) => p.id === d.projectgroep_id)?.naam ?? 'Onbekend'),
                },
                { kop: 'Uren per jaar', inhoud: (d) => formatUren(d.uren_per_jaar), getal: true },
                { kop: 'Periode', inhoud: (d) => formatPeriode(d.startdatum, d.einddatum) },
              ]}
            />
          </Sectie>

          <Sectie titel="Overige taken">
            <Tabel
              bijschrift="Overige taken van deze medewerker"
              rijen={nieuwsteEerst(uitvoeringen)}
              sleutel={(u) => u.id}
              leeg="Geen overige taken. Voeg uitvoerders toe vanaf de pagina van de taak."
              kolommen={[
                {
                  kop: 'Taak',
                  inhoud: (u) => naar(`/taken/${u.taak_id}`, taken.find((t) => t.id === u.taak_id)?.naam ?? 'Onbekend'),
                },
                { kop: 'Uren per jaar', inhoud: (u) => formatUren(u.uren_per_jaar), getal: true },
                { kop: 'Periode', inhoud: (u) => formatPeriode(u.startdatum, u.einddatum) },
              ]}
            />
          </Sectie>
        </>
      )}

      {tab === 'extra-uren' && (
        <Sectie
          titel="Extra uren buiten het contract"
          acties={
            magBeheren && (
              <Button variant="secundair" onClick={() => setDialoog({ soort: 'extra', extra: null })} disabled={werkjaren.length === 0}>
                Extra uren toevoegen
              </Button>
            )
          }
        >
          <p className="mb-4 max-w-prose text-neutral-700">
            Bijvoorbeeld uren uit NPO-gelden die apart gefactureerd worden. Ze tellen niet mee in de verdeling van de contracturen.
          </p>
          <Tabel
            bijschrift="Extra uren"
            rijen={[...extraUren].sort((a, b) => b.jaar - a.jaar)}
            sleutel={(e) => e.id}
            leeg="Geen extra uren."
            kolommen={[
              { kop: 'Omschrijving', inhoud: (e) => e.omschrijving },
              { kop: 'Jaar', inhoud: (e) => e.jaar },
              { kop: 'Uren', inhoud: (e) => formatUren(e.uren), getal: true },
              { kop: 'Financier', inhoud: (e) => e.financier },
              { kop: 'School', inhoud: (e) => schoolNaam(e.school_id) },
            ]}
            acties={magBeheren ? (e) => (
              <>
                <Button variant="link" onClick={() => setDialoog({ soort: 'extra', extra: e })}>
                  Wijzigen<span className="sr-only"> {e.omschrijving}</span>
                </Button>
                <Button variant="link" onClick={() => setDialoog({ soort: 'extra-verwijderen', extra: e })}>
                  Verwijderen<span className="sr-only"> {e.omschrijving}</span>
                </Button>
              </>
            ) : undefined}
          />
        </Sectie>
      )}

      {tab === 'werkurenverdeling' && <Werkurenverdeling medewerkerId={medewerker.id} />}

      {dialoog?.soort === 'wijzigen' && (
        <MedewerkerFormulier
          medewerker={medewerker}
          gekoppeld={medewerkers.flatMap((m) => (m.user_id && m.id !== medewerker.id ? [m.user_id] : []))}
          afdelingen={afdelingen}
          functies={functies}
          onSluiten={sluit}
          onGelukt={herlaad}
        />
      )}
      {dialoog?.soort === 'verwijderen' && (
        <VerwijderDialoog
          wat="Medewerker"
          toelichting="Een medewerker met scholen of projectgroepen in de historie kan niet worden verwijderd. Zet de medewerker dan op inactief."
          onVerwijderen={() =>
            verwijder(client, 'medewerkers', medewerker.id, {
              '23503': 'Deze medewerker heeft scholen of projectgroepen in de historie. Zet de medewerker op inactief in plaats van verwijderen.',
            })
          }
          onSluiten={sluit}
          onGelukt={() => void navigate('/medewerkers')}
        />
      )}
      {dialoog?.soort === 'contract' && (
        <ContractFormulier medewerkerId={medewerker.id} contract={dialoog.contract} onSluiten={sluit} onGelukt={herlaad} />
      )}
      {dialoog?.soort === 'contract-verwijderen' && (
        <VerwijderDialoog
          wat="Contractwijziging"
          onVerwijderen={() => verwijder(client, 'contracten', dialoog.contract.id)}
          onSluiten={sluit}
          onGelukt={herlaad}
        />
      )}
      {dialoog?.soort === 'extra' && (
        <ExtraUrenFormulier
          medewerkerId={medewerker.id}
          extra={dialoog.extra}
          werkjaren={werkjaren}
          scholen={scholen.filter((s) => s.actief || s.id === dialoog.extra?.school_id).sort(opNaam)}
          onSluiten={sluit}
          onGelukt={herlaad}
        />
      )}
      {dialoog?.soort === 'extra-verwijderen' && (
        <VerwijderDialoog
          wat="Extra uren"
          onVerwijderen={() => verwijder(client, 'extra_uren', dialoog.extra.id)}
          onSluiten={sluit}
          onGelukt={herlaad}
        />
      )}
    </Pagina>
  )
}

function ContractFormulier({
  medewerkerId,
  contract,
  onSluiten,
  onGelukt,
}: {
  medewerkerId: string
  contract: Contract | null
  onSluiten: () => void
  onGelukt: () => void
}) {
  const { client } = useAuth()
  const [ingang, setIngang] = useState(contract?.ingangsdatum ?? `${new Date().getFullYear()}-01-01`)
  const [uren, setUren] = useState(getalAlsTekst(contract?.uren_per_week))
  const [weken, setWeken] = useState(getalAlsTekst(contract?.werkweken))
  const [mijmer, setMijmer] = useState(getalAlsTekst(contract?.mijmer_percentage))

  function opslaan() {
    const u = leesGetal(uren)
    const w = weken.trim() === '' ? null : leesGetal(weken)
    const m = mijmer.trim() === '' ? null : leesGetal(mijmer)
    if (!ingang) return ongeldig('Kies een ingangsdatum.')
    if (u === null || u < 0 || u > 40) return ongeldig('Vul de uren per week in (0 tot en met 40).')
    if (weken.trim() !== '' && (w === null || w <= 0 || w > 53)) return ongeldig('Werkweken moet tussen 1 en 53 liggen, of leeg zijn.')
    if (mijmer.trim() !== '' && (m === null || m < 0 || m > 100)) return ongeldig('Mijmertijd moet tussen 0 en 100 liggen, of leeg zijn.')
    return voerUit(
      client,
      'contract_opslaan',
      {
        p_id: contract?.id ?? null,
        p_medewerker_id: medewerkerId,
        p_ingangsdatum: ingang,
        p_uren_per_week: u,
        p_werkweken: w,
        p_mijmer_percentage: m,
      },
      { '23505': 'Er is al een contractwijziging op deze datum.' },
    )
  }

  return (
    <FormulierDialoog
      titel={contract ? 'Contract wijzigen' : 'Contractwijziging toevoegen'}
      onOpslaan={opslaan}
      onSluiten={onSluiten}
      onGelukt={onGelukt}
    >
      <TextField label="Ingangsdatum" type="date" value={ingang} onChange={(e) => setIngang(e.target.value)} />
      <TextField label="Uren per week" inputMode="decimal" value={uren} onChange={(e) => setUren(e.target.value)} />
      <TextField
        label="Werkweken per jaar"
        hint="Alleen invullen als het afwijkt van het jaar."
        inputMode="decimal"
        value={weken}
        onChange={(e) => setWeken(e.target.value)}
      />
      <TextField
        label="Mijmertijd (%)"
        hint="Alleen invullen als het afwijkt van het jaar."
        inputMode="decimal"
        value={mijmer}
        onChange={(e) => setMijmer(e.target.value)}
      />
    </FormulierDialoog>
  )
}

function ExtraUrenFormulier({
  medewerkerId,
  extra,
  werkjaren,
  scholen,
  onSluiten,
  onGelukt,
}: {
  medewerkerId: string
  extra: ExtraUren | null
  werkjaren: Werkjaar[]
  scholen: School[]
  onSluiten: () => void
  onGelukt: () => void
}) {
  const { client } = useAuth()
  const ditJaar = new Date().getFullYear()
  const [jaar, setJaar] = useState(
    String(extra?.jaar ?? (werkjaren.some((w) => w.jaar === ditJaar) ? ditJaar : (werkjaren.at(-1)?.jaar ?? ditJaar))),
  )
  const [omschrijving, setOmschrijving] = useState(extra?.omschrijving ?? '')
  const [uren, setUren] = useState(getalAlsTekst(extra?.uren))
  const [financier, setFinancier] = useState(extra?.financier ?? '')
  const [school, setSchool] = useState(extra?.school_id ?? '')

  function opslaan() {
    const u = leesGetal(uren)
    if (!omschrijving.trim()) return ongeldig('Vul een omschrijving in.')
    if (u === null || u < 0) return ongeldig('Vul het aantal uren in.')
    return voerUit(client, 'extra_uren_opslaan', {
      p_id: extra?.id ?? null,
      p_medewerker_id: medewerkerId,
      p_jaar: Number(jaar),
      p_omschrijving: omschrijving,
      p_uren: u,
      p_financier: financier,
      p_school_id: school || null,
    })
  }

  return (
    <FormulierDialoog
      titel={extra ? 'Extra uren wijzigen' : 'Extra uren toevoegen'}
      onOpslaan={opslaan}
      onSluiten={onSluiten}
      onGelukt={onGelukt}
    >
      <TextField label="Omschrijving" maxLength={300} value={omschrijving} onChange={(e) => setOmschrijving(e.target.value)} />
      <SelectField
        label="Jaar"
        value={jaar}
        opties={werkjaren.map((w) => ({ waarde: String(w.jaar), label: String(w.jaar) }))}
        onChange={(e) => setJaar(e.target.value)}
      />
      <TextField label="Uren" inputMode="decimal" value={uren} onChange={(e) => setUren(e.target.value)} />
      <TextField label="Financier" hint="Bijv. NPO-gelden." maxLength={120} value={financier} onChange={(e) => setFinancier(e.target.value)} />
      <SelectField
        label="School"
        value={school}
        opties={[{ waarde: '', label: 'Geen school' }, ...scholen.map((s) => ({ waarde: s.id, label: s.naam }))]}
        onChange={(e) => setSchool(e.target.value)}
      />
    </FormulierDialoog>
  )
}
