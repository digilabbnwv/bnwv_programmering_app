# BNWV Intern

Interne webapplicatie van Bibliotheek Noordwest Veluwe. Medewerkers loggen in met een persoonlijk account en tweestapsverificatie (2FA). Elke medewerker heeft één rol, en de rol bepaalt wat iemand mag.

Dit is het fundament: inloggen, 2FA, rollen en rechten, gebruikersbeheer, auditlog, layout en deployment. De inhoudelijke onderdelen komen later.

Beveiligingskeuzes en resterende risico's staan in [SECURITY.md](SECURITY.md).

## Inhoud

- [Techniek](#techniek)
- [Mappen](#mappen)
- [Lokaal ontwikkelen](#lokaal-ontwikkelen)
- [Environment variables](#environment-variables)
- [Supabase eenmalig inrichten](#supabase-eenmalig-inrichten)
- [GitHub eenmalig inrichten](#github-eenmalig-inrichten)
- [Deploy](#deploy)
- [De eerste beheerder aanmaken](#de-eerste-beheerder-aanmaken)
- [Rollen en rechten uitbreiden](#rollen-en-rechten-uitbreiden)
- [Tests](#tests)

## Techniek

| Onderdeel | Keuze |
|---|---|
| Frontend | Vite, React 19, TypeScript. React escapet alle tekst standaard; dat beperkt XSS, het grootste risico omdat de sessie in de browser staat. |
| Styling | Tailwind CSS v4 via de build, met de tokens uit het BNWV Design System ([src/styles/index.css](src/styles/index.css)). Andere kleuren en lettertypes bestaan niet als utility. |
| Routing | Hash-routing (`#/gebruikers`), want GitHub Pages kan geen server-side rewrites doen. |
| Backend | Supabase: Postgres met Row Level Security, Auth met TOTP-2FA, Edge Functions. |
| Hosting | GitHub Pages, deploy via GitHub Actions. |

## Mappen

```
src/
  auth/        inlogflow, sessie, 2FA, inactiviteit, rechten van de gebruiker
  beheer/      gebruikersbeheer en auditlog (API-laag en dialogen)
  components/  knoppen, velden, meldingen, dialoog
  layout/      header, navigatie per recht, paginakader
  lib/         configuratie en de Supabase-client (alleen de publishable key)
  pages/       één bestand per pagina
supabase/
  migrations/  alle databasewijzigingen als SQL
  functions/   Edge Functions: wachtwoord-wijzigen, admin-users, _shared
  tests/       pgTAP-tests voor rechten en RLS
tests/integratie/  tests tegen een lokale Supabase met echte Auth (CI)
scripts/       Node-check en de secret-check op de build
docs/          BNWV Design System
```

## Lokaal ontwikkelen

### Benodigd

- **Node 24.13 of nieuwer, binnen 24.x** (zie `.node-version`). Op de BNWV-laptops staat een losse Node in `node_bin/`. Start npm daarom via de wrapper, dan gebruiken alle scripts die Node:

  ```bash
  .\npm ci
  ```

  Een andere geïnstalleerde Node geeft een duidelijke fout (`scripts/check-node.mjs`). In CI en op andere machines werkt gewoon `npm`.
- **Docker** is alleen nodig voor de databasetests en de integratietests. Zonder Docker draaien die alleen in GitHub Actions.
- **Supabase CLI** voor migraties en Edge Functions: `npx supabase <commando>`.

### Starten

1. Kopieer `.env.example` naar `.env.local` en vul de waarden in (zie [Environment variables](#environment-variables)).
2. Start de dev-server:

   ```bash
   .\npm run dev
   ```

   De app draait op http://localhost:5173. In de dev-server staat de Content Security Policy uit, want Vite heeft dan inline scripts nodig. Test de CSP met een build:

   ```bash
   .\npm run build
   ```

   en daarna:

   ```bash
   .\npm run preview
   ```

### Met een lokale Supabase (Docker nodig)

```bash
npx supabase start
```

Gebruik daarna de URL en de anon/publishable key uit `npx supabase status` in `.env.local`. De lokale instellingen staan in [supabase/config.toml](supabase/config.toml), inclusief de token-hook. Maak de eerste beheerder aan zoals [hieronder](#de-eerste-beheerder-aanmaken), maar dan in Studio op http://127.0.0.1:54323.

## Environment variables

### Frontend (`.env.local`, en in GitHub als *Variables*)

Alles met `VITE_` komt in de JavaScript-bundel en is dus openbaar. Zet hier nooit een secret: de build-check (`npm run check:secrets`) faalt dan.

| Variabele | Voorbeeld | Betekenis |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://abcd.supabase.co` | Project-URL (Project Settings → API). Moet https zijn, behalve lokaal. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | Publishable key of de oude anon key. Nooit de secret/service role key. |
| `VITE_IDLE_TIMEOUT_MINUTES` | `15` | Minuten zonder activiteit tot automatisch uitloggen (5 tot en met 60). Na `timeout − 2` minuten verschijnt een waarschuwing. |

### Edge Functions (Supabase secrets)

| Secret | Waarde | Betekenis |
|---|---|---|
| `ALLOWED_ORIGINS` | `https://digilabbnwv.github.io` | Origins die de functies mogen aanroepen (CORS), komma-gescheiden, zonder pad. Zonder deze secret alleen de lokale dev- en preview-server. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | automatisch | Zet Supabase zelf. De service role key staat alleen hier: nooit in de frontend, de repository of op een laptop. |

## Supabase eenmalig inrichten

### 1. Project, migraties en functies

Maak een project in het [Supabase-dashboard](https://supabase.com/dashboard) (regio EU). Daarna, met een persoonlijk access token van een beheerder van het Supabase-project:

```bash
npx supabase login
```

```bash
npx supabase link --project-ref <project-ref>
```

```bash
npx supabase db push
```

```bash
npx supabase functions deploy wachtwoord-wijzigen admin-users
```

```bash
npx supabase secrets set ALLOWED_ORIGINS=https://digilabbnwv.github.io
```

Vraagt `functions deploy` om Docker, voeg dan `--use-api` toe: dan bundelt Supabase de functies zelf.

Op het BNWV-netwerk lukken `link` en `db push` niet, omdat de Postgres-poorten dicht zijn. Gebruik dan de workflow *Supabase uitrollen* (zie [Deploy](#deploy)); die doet `db push` en `functions deploy` vanuit GitHub. `secrets set` werkt wel vanaf de werkplek, want dat gaat via HTTPS.

`npx supabase config push` gebruiken we niet: `config.toml` bevat lokale waarden (zoals de site-URL). Zet de instellingen hieronder daarom met de hand.

### 2. Instellingen in het dashboard

Deze instellingen staan voor de lokale Supabase in `config.toml`. Op het echte project zet je ze één keer met de hand.

| Waar (dashboard) | Instelling | Waarom |
|---|---|---|
| Authentication → Sign In / Providers | **Allow new users to sign up: uit** | Alleen een beheerder maakt accounts aan. |
| Authentication → Sign In / Providers → Email | **Email: aan**, **Confirm email: uit** | Zonder de e-mailprovider kan niemand met een wachtwoord inloggen. De app verstuurt geen e-mail. |
| Authentication → Sign In / Providers | Anonymous sign-ins, Phone en alle externe providers: **uit** | Alleen e-mail en wachtwoord. |
| Authentication → Sign In / Providers → Email | **Minimum password length: 12**, **Password requirements: lowercase, uppercase and digits** | Gelijk aan de controle in de app en in de Edge Function. |
| Authentication → Sign In / Providers → Email | **Prevent use of leaked passwords: aan** *(alleen Pro)* | Weigert wachtwoorden uit bekende datalekken. |
| Authentication → Multi-Factor | **TOTP (App Authenticator): aan**, Phone: uit, max. 3 factoren | 2FA met een authenticator-app. |
| Authentication → Hooks | **Customize Access Token (JWT) Claims: aan**, Postgres-functie `public.custom_access_token_hook` | Zet rol en status in het token en weigert gedeactiveerde accounts. Zonder deze hook kan niemand iets. |
| Authentication → Sessions | **Detect and revoke potentially compromised refresh tokens: aan**, reuse interval 10 s | Een gestolen refresh token werkt maar één keer. |
| Authentication → Sessions | **Inactivity timeout: 20 minuten**, **Time-box user sessions: 12 uur** *(alleen Pro)* | Uitloggen ook aan de serverkant, niet alleen in de browser. |
| Authentication → Rate Limits | Sign-ins: **30** per 5 minuten, Token verifications (2FA-codes): **30** per 5 minuten, Token refreshes: **150** per 5 minuten | Remt het raden van wachtwoorden en codes. |
| Project Settings → JWT Keys | **Access token expiry: 900 seconden** | Een token van iemand die is uitgelogd of gedeactiveerd, verloopt binnen 15 minuten. |
| Authentication → URL Configuration | **Site URL**: `https://digilabbnwv.github.io/bnwv_programmering_app/`; verder geen redirect-URL's | Er zijn geen e-maillinks; dit voorkomt doorsturen naar vreemde sites. |
| Project Settings → Data API | **Exposed schemas: alleen `public`** (de standaard) | Het schema `private` met de hulpfuncties is niet via de API bereikbaar. |

Na het wijzigen van de hook of de sessie-instellingen moeten gebruikers opnieuw inloggen.

## GitHub eenmalig inrichten

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Settings → Secrets and variables → Actions → Variables** (geen secrets: deze waarden zijn openbaar):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - optioneel `VITE_IDLE_TIMEOUT_MINUTES`
3. **Settings → Environments → github-pages → Deployment branches:** alleen `main`.
4. **Settings → Environments → New environment `supabase`**, voor de workflow *Supabase uitrollen*:
   - **Required reviewers:** jijzelf, en eventueel een tweede beheerder.
   - **Deployment branches and tags:** *Selected branches*, alleen `main`.
   - **Environment secrets:**
     - `SUPABASE_ACCESS_TOKEN`: een persoonlijk access token, aan te maken via [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens). Geef het een duidelijke naam, bijv. "GitHub Actions BNWV Intern", en een vervaldatum.
     - `SUPABASE_DB_PASSWORD`: het databasewachtwoord van het project (Project Settings → Database).
5. Aanbevolen: **Settings → Branches →** een regel voor `main` die een pull request en een groene CI vraagt.

De repository is publiek: de code is openbaar, de gegevens niet. Daarom staat er geen enkel secret in de repository; gitleaks controleert dat bij elke push.

## Deploy

### Frontend: automatisch

Elke push naar `main` start [deploy.yml](.github/workflows/deploy.yml):

1. alle checks uit [ci.yml](.github/workflows/ci.yml): lint, typecheck, unit-tests, build, secret-check, migraties, pgTAP-tests, integratietests en gitleaks;
2. bouwen met de variabelen uit GitHub, plus nog een keer de secret-check;
3. publiceren op GitHub Pages.

Faalt één stap, dan blijft de vorige versie online. Handmatig opnieuw publiceren kan via **Actions → Deploy → Run workflow**.

### Database en Edge Functions: handmatig, via GitHub Actions

Migraties en functies rol je bewust met de hand uit, zodat een databasewijziging nooit ongemerkt live gaat. Dat gaat via de workflow [Supabase uitrollen](.github/workflows/supabase.yml), want het BNWV-netwerk blokkeert de Postgres-poorten (5432 en 6543). Daardoor werkt `supabase db push` niet vanaf een werkplek.

1. Merge de wijziging naar `main` als CI groen is. De frontend volgt vanzelf.
2. Start **Actions → Supabase uitrollen → Run workflow** op `main` en kies wat je uitrolt: *database en functies*, *alleen database* of *alleen functies*.
3. De workflow draait eerst alle checks en wacht dan op goedkeuring. Keur goed via **Review deployments**.
4. In de log zie je eerst welke migraties erbij komen (dry run); daarna worden ze uitgerold, en daarna de functies.

Schrijf migraties zo dat de frontend die net live is gegaan ermee blijft werken, want die staat er even eerder dan de database. Voeg bijvoorbeeld een kolom eerst toe, en gebruik hem pas in een volgende versie van de frontend.

Ben je op een netwerk dat Postgres wel doorlaat, dan kan het ook lokaal: `npx supabase db push` en `npx supabase functions deploy --use-api`.

## De eerste beheerder aanmaken

De eerste beheerder maak je in het dashboard. Zo staat de service role key nooit op een laptop.

1. **Authentication → Users → Add user → Create new user.** Vul het e-mailadres en een tijdelijk wachtwoord in (minstens 12 tekens, met een hoofdletter, een kleine letter en een cijfer) en zet **Auto Confirm User** aan.
2. **SQL Editor:** voer dit uit, met het juiste e-mailadres en de juiste naam:

   ```sql
   insert into public.profiles (user_id, weergavenaam, must_change_password)
   select id, 'Voornaam Achternaam', true from auth.users where email = 'naam@bibliotheeknwveluwe.nl';

   insert into public.user_roles (user_id, role_id)
   select id, 'beheerder' from auth.users where email = 'naam@bibliotheeknwveluwe.nl';
   ```

3. Log in op de app. Je stelt eerst 2FA in en kiest daarna een eigen wachtwoord.

Alle volgende accounts maakt een beheerder aan in de app, onder **Gebruikers**.

**Geen beheerder meer die kan inloggen** (bijvoorbeeld telefoon kwijt): reset de 2FA van een beheerder in de SQL Editor met `delete from auth.mfa_factors where user_id = '<id>';`. Die beheerder koppelt dan bij het inloggen opnieuw een app.

## Rollen en rechten uitbreiden

Rollen en rechten staan in de database (`roles`, `permissions`, `role_permissions`).

- **Nieuw recht:** schrijf een migratie die het recht toevoegt aan `permissions` en koppelt aan rollen in `role_permissions`. Gebruik in nieuwe RLS-policies `(select private.authorize('naam.van.recht'))`.
- **Nieuwe pagina:** voeg een route toe in [src/router.tsx](src/router.tsx) met `VereistRecht`, en een menu-item in [src/layout/navigatie.ts](src/layout/navigatie.ts). Het verbergen in de interface is alleen gemak voor de gebruiker; de policy in de database beslist.
- **Nieuwe tabel:** zet RLS aan en geef `authenticated` alleen `select`. De test `010_schema` faalt als een tabel zonder RLS staat, of als `anon` of `authenticated` meer mag.

## Tests

| Commando | Wat | Waar |
|---|---|---|
| `.\npm run lint` | ESLint, inclusief een verbod op XSS-gevoelige code en de strenge toegankelijkheidsregels van `jsx-a11y` | lokaal en CI |
| `.\npm run typecheck` | TypeScript | lokaal en CI |
| `.\npm test` | unit-tests (Vitest) | lokaal en CI |
| `.\npm run check:secrets` | geen secrets in `dist/` | lokaal en CI |
| `npx supabase test db` | pgTAP: rechten per rol, zonder 2FA, gedeactiveerd, beheerdersregels, auditlog | Docker / CI |
| `npm run test:integratie` | echte Supabase Auth: inloggen, hook, 2FA, wachtwoord wijzigen, gebruikersbeheer | Docker / CI |

De integratietests hebben `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` en `DB_URL` nodig van een **lokale** Supabase. In CI komen die uit `supabase status`. Draai ze nooit tegen het echte project.
