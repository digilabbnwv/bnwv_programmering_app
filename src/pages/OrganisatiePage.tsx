import { useCallback, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'
import { Selectievakje } from '../components/Selectievakje'
import { SelectField } from '../components/SelectField'
import { Tabel } from '../components/Tabel'
import { TextField } from '../components/TextField'
import { Laadstatus } from '../components/Melding'
import { Sectie } from '../components/Sectie'
import { Pagina } from '../layout/Pagina'
import { verwijderOrganisatie, type Afdeling, type Functie, type Tak } from '../organisatie/api'
import { lees, voerUit, type Medewerker } from '../werkbelasting/api'
import { FormulierDialoog, ongeldig, VerwijderDialoog } from '../werkbelasting/onderdelen'
import { opNaam } from '../werkbelasting/opmaak'
import { alles, useGegevens } from '../werkbelasting/useGegevens'

type Dialoog =
  | { soort: 'afdeling'; afdeling: Afdeling }
  | { soort: 'functie'; functie: Functie | null; afdelingId: string }
  | { soort: 'functie-verwijderen'; functie: Functie }
  | { soort: 'tak'; tak: Tak | null; afdelingId: string }
  | { soort: 'tak-verwijderen'; tak: Tak }

/** Afdelingen met hun functies en takken (projectplan.beheren). */
export function OrganisatiePage() {
  const { client } = useAuth()
  const laden = useCallback(
    async () =>
      alles<[Afdeling[], Functie[], Tak[], Medewerker[]]>(
        await Promise.all([
          lees<Afdeling>(client, 'afdelingen', 'volgorde'),
          lees<Functie>(client, 'functies', 'naam'),
          lees<Tak>(client, 'takken', 'naam'),
          lees<Medewerker>(client, 'medewerkers', 'naam'),
        ]),
      ),
    [client],
  )
  const { data, fout, herlaad } = useGegevens(laden)
  const [dialoog, setDialoog] = useState<Dialoog | null>(null)
  const sluit = () => setDialoog(null)

  if (!data) {
    return (
      <Pagina titel="Organisatie">
        <Laadstatus fout={fout} />
      </Pagina>
    )
  }

  const [afdelingen, functies, takken, medewerkers] = data
  const aantalMedewerkers = (functieId: string) => medewerkers.filter((m) => m.actief && m.functie_id === functieId).length
  const status = (actief: boolean) => (actief ? 'Actief' : 'Inactief')

  return (
    <Pagina
      titel="Organisatie"
      intro="Afdelingen met hun functies en takken. De projectplanner plant de inzet per functie en deelt projecten in per tak. Wat in gebruik is, kun je niet verwijderen; zet het dan op inactief."
    >
      {afdelingen.map((afdeling) => (
        <Sectie
          key={afdeling.id}
          titel={afdeling.afkorting ? `${afdeling.naam} (${afdeling.afkorting})` : afdeling.naam}
          acties={
            <Button variant="secundair" onClick={() => setDialoog({ soort: 'afdeling', afdeling })}>
              Wijzigen<span className="sr-only"> {afdeling.naam}</span>
            </Button>
          }
        >
          <Deel
            titel="Functies"
            actie={
              <Button variant="link" onClick={() => setDialoog({ soort: 'functie', functie: null, afdelingId: afdeling.id })}>
                Functie toevoegen<span className="sr-only"> bij {afdeling.naam}</span>
              </Button>
            }
          >
            <Tabel
              bijschrift={`Functies ${afdeling.naam}`}
              rijen={functies.filter((f) => f.afdeling_id === afdeling.id).sort(opNaam)}
              sleutel={(f) => f.id}
              leeg="Nog geen functies."
              kolommen={[
                { kop: 'Functie', inhoud: (f) => <span className="font-semibold">{f.naam}</span> },
                { kop: 'Afkorting', inhoud: (f) => f.afkorting },
                { kop: 'Soort', inhoud: (f) => (f.extern ? 'Extern of vrijwilliger' : 'Eigen personeel') },
                { kop: 'Medewerkers', inhoud: (f) => aantalMedewerkers(f.id), getal: true },
                { kop: 'Status', inhoud: (f) => status(f.actief) },
              ]}
              acties={(f) => (
                <>
                  <Button variant="link" onClick={() => setDialoog({ soort: 'functie', functie: f, afdelingId: f.afdeling_id })}>
                    Wijzigen<span className="sr-only"> {f.naam}</span>
                  </Button>
                  <Button variant="link" onClick={() => setDialoog({ soort: 'functie-verwijderen', functie: f })}>
                    Verwijderen<span className="sr-only"> {f.naam}</span>
                  </Button>
                </>
              )}
            />
          </Deel>

          <Deel
            titel="Takken"
            actie={
              <Button variant="link" onClick={() => setDialoog({ soort: 'tak', tak: null, afdelingId: afdeling.id })}>
                Tak toevoegen<span className="sr-only"> bij {afdeling.naam}</span>
              </Button>
            }
          >
            <Tabel
              bijschrift={`Takken ${afdeling.naam}`}
              rijen={takken.filter((t) => t.afdeling_id === afdeling.id).sort(opNaam)}
              sleutel={(t) => t.id}
              leeg="Nog geen takken."
              kolommen={[
                { kop: 'Tak', inhoud: (t) => <span className="font-semibold">{t.naam}</span> },
                { kop: 'Status', inhoud: (t) => status(t.actief) },
              ]}
              acties={(t) => (
                <>
                  <Button variant="link" onClick={() => setDialoog({ soort: 'tak', tak: t, afdelingId: t.afdeling_id })}>
                    Wijzigen<span className="sr-only"> {t.naam}</span>
                  </Button>
                  <Button variant="link" onClick={() => setDialoog({ soort: 'tak-verwijderen', tak: t })}>
                    Verwijderen<span className="sr-only"> {t.naam}</span>
                  </Button>
                </>
              )}
            />
          </Deel>
        </Sectie>
      ))}

      {dialoog?.soort === 'afdeling' && <AfdelingFormulier afdeling={dialoog.afdeling} onSluiten={sluit} onGelukt={herlaad} />}
      {dialoog?.soort === 'functie' && (
        <FunctieFormulier
          functie={dialoog.functie}
          afdelingId={dialoog.afdelingId}
          afdelingen={afdelingen}
          onSluiten={sluit}
          onGelukt={herlaad}
        />
      )}
      {dialoog?.soort === 'tak' && (
        <TakFormulier tak={dialoog.tak} afdelingId={dialoog.afdelingId} afdelingen={afdelingen} onSluiten={sluit} onGelukt={herlaad} />
      )}
      {dialoog?.soort === 'functie-verwijderen' && (
        <VerwijderDialoog
          wat={`Functie ${dialoog.functie.naam}`}
          onVerwijderen={() =>
            verwijderOrganisatie(client, 'functies', dialoog.functie.id, {
              '23503': 'Deze functie is nog in gebruik. Zet hem op inactief.',
            })
          }
          onSluiten={sluit}
          onGelukt={herlaad}
        />
      )}
      {dialoog?.soort === 'tak-verwijderen' && (
        <VerwijderDialoog
          wat={`Tak ${dialoog.tak.naam}`}
          onVerwijderen={() =>
            verwijderOrganisatie(client, 'takken', dialoog.tak.id, {
              '23503': 'Deze tak is nog in gebruik. Zet hem op inactief.',
            })
          }
          onSluiten={sluit}
          onGelukt={herlaad}
        />
      )}
    </Pagina>
  )
}

/** Een kop met een actie, binnen de sectie van een afdeling. */
function Deel({ titel, actie, children }: { titel: string; actie: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-6 first:mt-0">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-bold">{titel}</h3>
        {actie}
      </div>
      {children}
    </div>
  )
}

const afdelingOpties = (afdelingen: Afdeling[]) => afdelingen.map((a) => ({ waarde: a.id, label: a.naam }))

function AfdelingFormulier({
  afdeling,
  onSluiten,
  onGelukt,
}: {
  afdeling: Afdeling
  onSluiten: () => void
  onGelukt: () => void
}) {
  const { client } = useAuth()
  const [naam, setNaam] = useState(afdeling.naam)
  const [afkorting, setAfkorting] = useState(afdeling.afkorting)

  async function opslaan() {
    if (!naam.trim()) return ongeldig('Vul een naam in.')
    return voerUit(
      client,
      'afdeling_opslaan',
      { p_id: afdeling.id, p_naam: naam, p_afkorting: afkorting },
      { '23505': 'Er is al een afdeling met deze naam.' },
    )
  }

  return (
    <FormulierDialoog titel="Afdeling wijzigen" onOpslaan={opslaan} onSluiten={onSluiten} onGelukt={onGelukt}>
      <TextField label="Naam" autoComplete="off" maxLength={80} value={naam} onChange={(e) => setNaam(e.target.value)} />
      <TextField
        label="Afkorting"
        hint="Kort, voor overzichten. Bijvoorbeeld LDV."
        autoComplete="off"
        maxLength={10}
        value={afkorting}
        onChange={(e) => setAfkorting(e.target.value)}
      />
    </FormulierDialoog>
  )
}

function FunctieFormulier({
  functie,
  afdelingId,
  afdelingen,
  onSluiten,
  onGelukt,
}: {
  functie: Functie | null
  afdelingId: string
  afdelingen: Afdeling[]
  onSluiten: () => void
  onGelukt: () => void
}) {
  const { client } = useAuth()
  const [v, setV] = useState({
    naam: functie?.naam ?? '',
    afkorting: functie?.afkorting ?? '',
    afdeling_id: functie?.afdeling_id ?? afdelingId,
    extern: functie?.extern ?? false,
    actief: functie?.actief ?? true,
  })
  const zet = <K extends keyof typeof v>(veld: K, waarde: (typeof v)[K]) => setV((oud) => ({ ...oud, [veld]: waarde }))

  async function opslaan() {
    if (!v.naam.trim()) return ongeldig('Vul een naam in.')
    return voerUit(
      client,
      'functie_opslaan',
      {
        p_id: functie?.id ?? null,
        p_naam: v.naam,
        p_afkorting: v.afkorting,
        p_afdeling_id: v.afdeling_id,
        p_extern: v.extern,
        p_actief: v.actief,
      },
      { '23505': 'Er is al een functie met deze naam of afkorting.' },
    )
  }

  return (
    <FormulierDialoog titel={functie ? 'Functie wijzigen' : 'Functie toevoegen'} onOpslaan={opslaan} onSluiten={onSluiten} onGelukt={onGelukt}>
      <TextField label="Naam" autoComplete="off" maxLength={100} value={v.naam} onChange={(e) => zet('naam', e.target.value)} />
      <TextField
        label="Afkorting (optioneel)"
        hint="Zoals in de projectplanner, bijvoorbeeld LMC."
        autoComplete="off"
        maxLength={10}
        value={v.afkorting}
        onChange={(e) => zet('afkorting', e.target.value)}
      />
      <SelectField
        label="Afdeling"
        hint="De afdeling waar deze functie normaal valt. Bij een medewerker kun je afwijken."
        value={v.afdeling_id}
        opties={afdelingOpties(afdelingen)}
        onChange={(e) => zet('afdeling_id', e.target.value)}
      />
      <Selectievakje
        label="Extern of vrijwilliger (geen contract in de app)"
        checked={v.extern}
        onChange={(e) => zet('extern', e.target.checked)}
      />
      <Selectievakje label="Actief" checked={v.actief} onChange={(e) => zet('actief', e.target.checked)} />
    </FormulierDialoog>
  )
}

function TakFormulier({
  tak,
  afdelingId,
  afdelingen,
  onSluiten,
  onGelukt,
}: {
  tak: Tak | null
  afdelingId: string
  afdelingen: Afdeling[]
  onSluiten: () => void
  onGelukt: () => void
}) {
  const { client } = useAuth()
  const [naam, setNaam] = useState(tak?.naam ?? '')
  const [afdeling, setAfdeling] = useState(tak?.afdeling_id ?? afdelingId)
  const [actief, setActief] = useState(tak?.actief ?? true)

  async function opslaan() {
    if (!naam.trim()) return ongeldig('Vul een naam in.')
    return voerUit(
      client,
      'tak_opslaan',
      { p_id: tak?.id ?? null, p_afdeling_id: afdeling, p_naam: naam, p_actief: actief },
      { '23505': 'Deze afdeling heeft al een tak met deze naam.' },
    )
  }

  return (
    <FormulierDialoog titel={tak ? 'Tak wijzigen' : 'Tak toevoegen'} onOpslaan={opslaan} onSluiten={onSluiten} onGelukt={onGelukt}>
      <TextField label="Naam" autoComplete="off" maxLength={80} value={naam} onChange={(e) => setNaam(e.target.value)} />
      <SelectField label="Afdeling" value={afdeling} opties={afdelingOpties(afdelingen)} onChange={(e) => setAfdeling(e.target.value)} />
      <Selectievakje label="Actief" checked={actief} onChange={(e) => setActief(e.target.checked)} />
    </FormulierDialoog>
  )
}
