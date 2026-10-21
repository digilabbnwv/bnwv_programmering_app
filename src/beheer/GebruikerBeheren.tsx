import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'
import { Dialoog } from '../components/Dialoog'
import { Melding } from '../components/Melding'
import { SelectField } from '../components/SelectField'
import { beheer, type BeheerActie, type Gebruiker, type Rol } from './api'
import { TijdelijkWachtwoord } from './TijdelijkWachtwoord'

type Bevestiging = 'deactiveren' | 'wachtwoord' | '2fa' | null

/**
 * Rol wijzigen, (de)activeren en wachtwoord of 2FA resetten. Wat niet mag
 * voor je eigen account staat uit; de database weigert het ook.
 */
export function GebruikerBeheren({
  gebruiker,
  rollen,
  isZelf,
  onSluiten,
  onGewijzigd,
}: {
  gebruiker: Gebruiker
  rollen: Rol[]
  isZelf: boolean
  onSluiten: () => void
  onGewijzigd: () => void
}) {
  const { client } = useAuth()
  const [rol, setRol] = useState(gebruiker.role_id ?? '')
  const [bevestig, setBevestig] = useState<Bevestiging>(null)
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [gelukt, setGelukt] = useState<string | null>(null)
  const [wachtwoord, setWachtwoord] = useState<string | null>(null)

  // Na een bevestiging (ja of annuleren) de focus terug naar de knop die hem
  // opende, zodat toetsenbordgebruikers hun plek niet kwijt zijn.
  const knoppen = useRef<Partial<Record<Exclude<Bevestiging, null>, HTMLButtonElement | null>>>({})
  const vorige = useRef<Bevestiging>(null)
  useEffect(() => {
    const was = vorige.current
    vorige.current = bevestig
    if (was && !bevestig) {
      const knop = knoppen.current[was]
      if (knop?.isConnected && !knop.disabled) knop.focus()
    }
  }, [bevestig, bezig])

  const naam = gebruiker.weergavenaam
  const eigenBeheerder = isZelf && gebruiker.role_id === 'beheerder'

  async function voerUit(actie: BeheerActie, melding: string) {
    setBezig(true)
    setFout(null)
    setGelukt(null)
    const res = await beheer<{ tijdelijkWachtwoord?: string }>(client, actie)
    setBezig(false)
    setBevestig(null)
    if (!res.ok) {
      setFout(res.melding)
      return
    }
    if (res.data?.tijdelijkWachtwoord) setWachtwoord(res.data.tijdelijkWachtwoord)
    else setGelukt(melding)
    onGewijzigd()
  }

  // Eén dialoog die van inhoud wisselt: zo onthoudt hij welke knop hem opende.
  return (
    <Dialoog titel={wachtwoord ? 'Wachtwoord gereset' : `${naam} beheren`} onSluiten={onSluiten}>
      {wachtwoord ? (
        <div className="space-y-6">
          <TijdelijkWachtwoord wachtwoord={wachtwoord} naam={naam} />
          <Button onClick={onSluiten}>Klaar</Button>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-neutral-700">{gebruiker.email}</p>
          {fout && <Melding soort="fout">{fout}</Melding>}
          {gelukt && <Melding soort="info">{gelukt}</Melding>}

          <section aria-label="Rol" className="space-y-3">
            <SelectField
              label="Rol"
              value={rol}
              disabled={eigenBeheerder || bezig}
              hint={eigenBeheerder ? 'Je kunt jezelf de beheerdersrol niet afnemen.' : 'De gebruiker wordt uitgelogd en logt opnieuw in met de nieuwe rol.'}
              opties={rollen.map((r) => ({ waarde: r.id, label: r.naam }))}
              onChange={(e) => setRol(e.target.value)}
            />
            <Button
              variant="secundair"
              disabled={eigenBeheerder || bezig || rol === gebruiker.role_id}
              onClick={() => void voerUit({ actie: 'rol_wijzigen', userId: gebruiker.user_id, rol }, 'De rol is gewijzigd.')}
            >
              Rol opslaan
            </Button>
          </section>

          <section aria-labelledby="beheer-account" className="space-y-3 border-t border-neutral-200 pt-5">
            <h3 id="beheer-account" className="font-bold">
              Account
            </h3>
            {gebruiker.is_active ? (
              bevestig === 'deactiveren' ? (
                <Bevestig
                  tekst={`${naam} kan dan niet meer inloggen en wordt direct uitgelogd.`}
                  knop="Ja, deactiveren"
                  bezig={bezig}
                  onJa={() =>
                    void voerUit({ actie: 'actief_zetten', userId: gebruiker.user_id, actief: false }, 'Het account is gedeactiveerd.')
                  }
                  onNee={() => setBevestig(null)}
                />
              ) : (
                <>
                  {isZelf && <p className="text-ui-sm text-neutral-700">Je kunt je eigen account niet deactiveren.</p>}
                  <Button
                    ref={(el) => {
                      knoppen.current.deactiveren = el
                    }}
                    variant="secundair"
                    disabled={isZelf || bezig}
                    onClick={() => setBevestig('deactiveren')}
                  >
                    Account deactiveren
                  </Button>
                </>
              )
            ) : (
              <Button
                variant="secundair"
                disabled={bezig}
                onClick={() =>
                  void voerUit({ actie: 'actief_zetten', userId: gebruiker.user_id, actief: true }, 'Het account is weer actief.')
                }
              >
                Account activeren
              </Button>
            )}
          </section>

          <section aria-labelledby="beheer-reset" className="space-y-3 border-t border-neutral-200 pt-5">
            <h3 id="beheer-reset" className="font-bold">
              Wachtwoord en tweestapsverificatie
            </h3>
            {isZelf && (
              <p className="text-ui-sm text-neutral-700">
                Je eigen wachtwoord of tweestapsverificatie resetten kan alleen een andere beheerder.
              </p>
            )}
            {bevestig === 'wachtwoord' ? (
              <Bevestig
                tekst={`${naam} krijgt een nieuw tijdelijk wachtwoord en wordt uitgelogd.`}
                knop="Ja, wachtwoord resetten"
                bezig={bezig}
                onJa={() => void voerUit({ actie: 'wachtwoord_resetten', userId: gebruiker.user_id }, '')}
                onNee={() => setBevestig(null)}
              />
            ) : bevestig === '2fa' ? (
              <Bevestig
                tekst={`${naam} wordt uitgelogd en koppelt bij de volgende keer inloggen opnieuw een authenticator-app.`}
                knop="Ja, 2FA resetten"
                bezig={bezig}
                onJa={() =>
                  void voerUit({ actie: '2fa_resetten', userId: gebruiker.user_id }, 'De tweestapsverificatie is gereset.')
                }
                onNee={() => setBevestig(null)}
              />
            ) : (
              <div className="flex flex-wrap gap-3">
                <Button
                  ref={(el) => {
                    knoppen.current.wachtwoord = el
                  }}
                  variant="secundair"
                  disabled={isZelf || bezig}
                  onClick={() => setBevestig('wachtwoord')}
                >
                  Wachtwoord resetten
                </Button>
                <Button
                  ref={(el) => {
                    knoppen.current['2fa'] = el
                  }}
                  variant="secundair"
                  disabled={isZelf || bezig || !gebruiker.heeft_2fa}
                  onClick={() => setBevestig('2fa')}
                >
                  2FA resetten
                </Button>
              </div>
            )}
          </section>
        </div>
      )}
    </Dialoog>
  )
}

function Bevestig({
  tekst,
  knop,
  bezig,
  onJa,
  onNee,
}: {
  tekst: string
  knop: string
  bezig: boolean
  onJa: () => void
  onNee: () => void
}) {
  // Focus op de vraag, zodat een schermlezer hem voorleest.
  const vraag = useRef<HTMLDivElement>(null)
  useEffect(() => vraag.current?.focus(), [])

  return (
    <div ref={vraag} tabIndex={-1} className="space-y-3 rounded-md bg-neutral-50 p-4">
      <p>{tekst} Weet je het zeker?</p>
      <div className="flex flex-wrap gap-3">
        <Button disabled={bezig} onClick={onJa}>
          {bezig ? 'Bezig…' : knop}
        </Button>
        <Button variant="secundair" disabled={bezig} onClick={onNee}>
          Annuleren
        </Button>
      </div>
    </div>
  )
}
