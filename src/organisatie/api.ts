import type { SupabaseClient } from '@supabase/supabase-js'
import { voerUit, type Meldingen, type Resultaat } from '../werkbelasting/api'

/**
 * Afdelingen, functies en takken (migratie organisatie). Iedereen leest ze;
 * wijzigen kan met projectplan.beheren. Zie docs/projectplanner.md.
 */

export interface Afdeling {
  id: string
  naam: string
  afkorting: string
  volgorde: number
}

export interface Functie {
  id: string
  naam: string
  afkorting: string
  /** De afdeling waar de functie normaal valt. */
  afdeling_id: string
  /** Extern of vrijwilliger: geen contract, dus geen bekende capaciteit. */
  extern: boolean
  actief: boolean
}

export interface Tak {
  id: string
  afdeling_id: string
  naam: string
  actief: boolean
}

export type OrganisatieTabel = 'afdelingen' | 'functies' | 'takken'

export function verwijderOrganisatie(
  client: SupabaseClient,
  tabel: OrganisatieTabel,
  id: string,
  meldingen?: Meldingen,
): Promise<Resultaat<null>> {
  return voerUit(client, 'organisatie_verwijderen', { p_tabel: tabel, p_id: id }, meldingen)
}

/** "Leesmediacoach (LMC)" of "Specialist". */
export function functieNaam(functie: Pick<Functie, 'naam' | 'afkorting'>): string {
  return functie.afkorting ? `${functie.naam} (${functie.afkorting})` : functie.naam
}

/**
 * Keuzes voor een functie: de actieve functies, plus de huidige als die
 * inactief is. Gesorteerd op afdeling en dan op naam, met de afdeling erbij.
 */
export function functieOpties(
  functies: readonly Functie[],
  afdelingen: readonly Afdeling[],
  huidigeId: string | null = null,
): { waarde: string; label: string }[] {
  const afdeling = new Map(afdelingen.map((a) => [a.id, a]))
  return functies
    .filter((f) => f.actief || f.id === huidigeId)
    .sort(
      (a, b) =>
        (afdeling.get(a.afdeling_id)?.volgorde ?? 0) - (afdeling.get(b.afdeling_id)?.volgorde ?? 0) ||
        a.naam.localeCompare(b.naam, 'nl'),
    )
    .map((f) => {
      const a = afdeling.get(f.afdeling_id)
      const inactief = f.actief ? '' : ' – inactief'
      return { waarde: f.id, label: `${functieNaam(f)}${a ? ` · ${a.naam}` : ''}${inactief}` }
    })
}

/**
 * De afdeling na het kiezen van een andere functie: de afdeling van de nieuwe
 * functie, tenzij er al bewust een andere afdeling was gekozen dan die van de
 * oude functie.
 */
export function afdelingNaFunctiekeuze(
  huidigeAfdelingId: string,
  oudeFunctie: Pick<Functie, 'afdeling_id'> | undefined,
  nieuweFunctie: Pick<Functie, 'afdeling_id'> | undefined,
): string {
  const volgdeFunctie = huidigeAfdelingId === '' || huidigeAfdelingId === oudeFunctie?.afdeling_id
  return volgdeFunctie && nieuweFunctie ? nieuweFunctie.afdeling_id : huidigeAfdelingId
}

/** "Leesmediacoach · Programmering", of null als de medewerker nog niet is ingedeeld. */
export function indeling(
  medewerker: { functie_id: string | null; afdeling_id: string | null },
  functies: readonly Functie[],
  afdelingen: readonly Afdeling[],
): string | null {
  const functie = functies.find((f) => f.id === medewerker.functie_id)
  const afdeling = afdelingen.find((a) => a.id === medewerker.afdeling_id)
  const delen = [functie?.naam, afdeling?.naam].filter((d): d is string => Boolean(d))
  return delen.length > 0 ? delen.join(' · ') : null
}
