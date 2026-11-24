// Haalt de leerlingaantallen en vestigingen op bij de open onderwijsdata van
// DUO en levert ze aan bij de Edge Function duo-verwerken. Draait in GitHub
// Actions (.github/workflows/duo-ophalen.yml): DUO verbreekt verbindingen
// vanuit Supabase, maar niet vanuit GitHub.
//
// Omgeving: SUPABASE_URL (https://<ref>.supabase.co) en DUO_SLEUTEL.
// Geen afhankelijkheden: alleen fetch van Node.

const DUO = 'https://onderwijsdata.duo.nl/api/3/action/datastore_search'
const LIMIET = 10000

// Resources op onderwijsdata.duo.nl. Wijzigt DUO een id, dan mislukt het
// ophalen; zoek het nieuwe id op met
// https://onderwijsdata.duo.nl/api/3/action/package_show?id=poleerlingen-v1
export const RESOURCES = {
  tellingen: '9278ae97-4014-49f4-91fc-8cc255c2595d', // poleerlingen-v1
  vestigingenBo: 'dcc9c9a5-6d01-410b-967f-810557588ba4', // adressen_bo
  vestigingenSo: '8f0f1639-712d-4adb-bb59-cabd43730dc8', // adressen_so
}

const VELDEN = 'VESTIGINGSCODE,VESTIGINGSNAAM,STRAATNAAM,HUISNUMMER-TOEVOEGING,POSTCODE,PLAATSNAAM,GEMEENTENAAM'

/** URL voor één verzoek aan de datastore van DUO. */
export function duoUrl(resource, filters, velden) {
  const params = new URLSearchParams({ resource_id: resource, limit: String(LIMIET), filters: JSON.stringify(filters) })
  if (velden) params.set('fields', velden)
  return `${DUO}?${params}`
}

/** Haalt de records uit een antwoord van DUO, of gooit een duidelijke fout. */
export function records(inhoud) {
  if (inhoud?.success !== true) throw new Error('DUO weigerde het verzoek')
  const { records: rijen, total } = inhoud.result ?? {}
  if (!Array.isArray(rijen)) throw new Error('DUO gaf geen records terug')
  if (typeof total === 'number' && total > rijen.length) {
    throw new Error('DUO gaf meer rijen dan in één keer op te halen zijn')
  }
  return rijen
}

/** Samenvatting van een ronde voor de log en de samenvatting in GitHub. */
export function samenvatting(ronde) {
  if (!ronde.gelukt) return `Mislukt: ${ronde.melding}`
  return `${ronde.tellingen} tellingen en ${ronde.vestigingen} vestigingen opgehaald; ${ronde.ingevuld} aantallen ingevuld of bijgewerkt.`
}

async function haalDuo(url) {
  let laatste
  for (let poging = 1; poging <= 3; poging++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'bnwv-intern (open onderwijsdata)', Accept: 'application/json' },
        signal: AbortSignal.timeout(60_000),
      })
      if (!res.ok) throw new Error(`DUO antwoordde met status ${res.status}`)
      return records(await res.json())
    } catch (e) {
      laatste = e
      if (poging < 3) await new Promise((r) => setTimeout(r, 5_000 * poging))
    }
  }
  throw laatste
}

async function main() {
  const basis = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
  const sleutel = process.env.DUO_SLEUTEL ?? ''
  if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(basis) || !sleutel) {
    throw new Error('Zet SUPABASE_URL (variable VITE_SUPABASE_URL) en DUO_SLEUTEL (secret in environment duo).')
  }

  const functie = async (body) => {
    const res = await fetch(`${basis}/functions/v1/duo-verwerken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-duo-sleutel': sleutel },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    })
    const inhoud = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`duo-verwerken antwoordde met ${res.status} (${inhoud.code ?? 'onbekend'})`)
    return inhoud
  }

  const vraag = await functie({ actie: 'te_vragen' })
  let tellingen = []
  let vestigingen = []
  try {
    if (vraag.instellingen.length > 0 && vraag.peiljaren.length > 0) {
      tellingen = await haalDuo(
        duoUrl(RESOURCES.tellingen, { INSTELLINGSCODE: vraag.instellingen, PEILJAAR: vraag.peiljaren }),
      )
    }
    const gelderland = { PROVINCIE: 'Gelderland' }
    vestigingen = [
      ...(await haalDuo(duoUrl(RESOURCES.vestigingenBo, gelderland, VELDEN))),
      ...(await haalDuo(duoUrl(RESOURCES.vestigingenSo, gelderland, VELDEN))),
    ]
  } catch (e) {
    const melding = e instanceof Error ? (e.cause instanceof Error ? `${e.message}: ${e.cause.message}` : e.message) : 'onbekend'
    await functie({ actie: 'mislukt', melding })
    throw new Error(`Ophalen bij DUO mislukt: ${melding}`)
  }

  const ronde = await functie({ actie: 'verwerken', tellingen, vestigingen })
  return ronde
}

// Alleen uitvoeren als script, niet bij importeren in de tests.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('duo-ophalen.mjs')) {
  const { appendFileSync } = await import('node:fs')
  const schrijf = (regel) => {
    console.log(regel)
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${regel}\n`)
  }
  try {
    const ronde = await main()
    schrijf(`### DUO ophalen\n${samenvatting(ronde)}`)
    if (!ronde.gelukt) process.exitCode = 1
  } catch (e) {
    const melding = e instanceof Error ? e.message : 'onbekende fout'
    console.log(`::error title=DUO ophalen::${melding.replace(/[\r\n%]/g, ' ')}`)
    schrijf(`### DUO ophalen\n${melding}`)
    process.exitCode = 1
  }
}
