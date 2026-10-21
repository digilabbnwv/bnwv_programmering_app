/** Een rij uit public.audit_log. */
export interface AuditRegel {
  id: number
  created_at: string
  actor_id: string | null
  action: string
  target_user_id: string | null
  details: Record<string, unknown>
}

const ACTIES: Record<string, string> = {
  'auth.ingelogd': 'Ingelogd',
  'auth.wachtwoord_gewijzigd': 'Eigen wachtwoord gekozen',
  'gebruiker.aangemaakt': 'Gebruiker aangemaakt',
  'gebruiker.rol_gewijzigd': 'Rol gewijzigd',
  'gebruiker.geactiveerd': 'Account geactiveerd',
  'gebruiker.gedeactiveerd': 'Account gedeactiveerd',
  'gebruiker.wachtwoord_gereset': 'Wachtwoord gereset',
  'gebruiker.2fa_gereset': 'Tweestapsverificatie gereset',
}

const METHODES: Record<string, string> = {
  password: 'met wachtwoord',
  totp: 'met code uit de app',
}

const tekst = (waarde: unknown) => (typeof waarde === 'string' ? waarde : '')

/** Leesbare omschrijving van een regel, bijv. "Rol gewijzigd: Medewerker → Teamleider". */
export function beschrijfActie(regel: Pick<AuditRegel, 'action' | 'details'>, rolNaam: (id: string) => string): string {
  const label = ACTIES[regel.action] ?? regel.action
  const d = regel.details
  switch (regel.action) {
    case 'auth.ingelogd': {
      const methode = METHODES[tekst(d.methode)]
      return methode ? `${label} ${methode}` : label
    }
    case 'gebruiker.aangemaakt':
      return tekst(d.rol) ? `${label} als ${rolNaam(tekst(d.rol))}` : label
    case 'gebruiker.rol_gewijzigd':
      return tekst(d.van) && tekst(d.naar)
        ? `${label}: ${rolNaam(tekst(d.van))} → ${rolNaam(tekst(d.naar))}`
        : label
    default:
      return label
  }
}
