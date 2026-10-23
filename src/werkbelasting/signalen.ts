import { formatUren, type Signaal } from './berekening'
import type { Teamsignaal } from './rapportage'

/** Vaste tekst bij een signaal van één medewerker. */
export function signaalTekst(s: Signaal): string {
  switch (s.soort) {
    case 'geen-contract':
      return 'Geen contract in dit jaar.'
    case 'overbelast':
      return `Overbelast: ${formatUren(s.tekortUren)} uur meer ingepland dan beschikbaar.`
    case 'school-zonder-gegevens':
      return `${s.naam}: geen leerlingaantal voor dit jaar, telt als 0 uur.`
    case 'school-buiten-staffel':
      return `${s.naam}: het leerlingaantal valt buiten de staffel, alleen de correctie telt.`
  }
}

export function teamsignaalTekst(s: Teamsignaal): string {
  switch (s.soort) {
    case 'school-zonder-medewerker':
      return s.aandeelZonder > 0.999
        ? `${s.naam} heeft dit jaar geen medewerker.`
        : `${s.naam} heeft ${Math.round(s.aandeelZonder * 100)}% van het jaar geen medewerker.`
    case 'projectgroep-zonder-deelnemers':
      return `Projectgroep ${s.naam} heeft dit jaar geen deelnemers.`
    case 'taak-zonder-uitvoerders':
      return `Taak ${s.naam} heeft dit jaar geen uitvoerder.`
  }
}
