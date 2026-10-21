# Beveiliging

Dit document beschrijft hoe BNWV Intern beveiligd is, en welke risico's bewust overblijven. Werk het bij als er iets verandert aan inloggen, rechten, hosting of afhankelijkheden.

## Een kwetsbaarheid melden

Meld een kwetsbaarheid niet in een openbaar issue. De repository is publiek. Gebruik **Security → Report a vulnerability** in GitHub, of meld het direct bij het Digilab van Bibliotheek Noordwest Veluwe.

## Wat er staat

### Inloggen en sessies

- **Wachtwoord plus 2FA:** inloggen met e-mail en wachtwoord, gevolgd door een TOTP-code uit een authenticator-app. Bij de eerste login stelt de gebruiker eerst 2FA in en kiest daarna een eigen wachtwoord.
- **Geen registratie of e-mail:** publieke registratie staat uit. Er zijn geen e-maillinks, magic links of resets per mail; een beheerder reset wachtwoord en 2FA.
- **Korte tokens:** access tokens zijn 15 minuten geldig. Refresh tokens worden bij elk gebruik vervangen, en een hergebruikt token wordt geweigerd.
- **Inactiviteit:** na 15 minuten zonder activiteit logt de app uit. Na 13 minuten verschijnt een waarschuwing. Eén timer geldt voor alle tabbladen, ook na het sluiten van de browser.

### Rechten

- **RLS overal:** Row Level Security staat aan op elke tabel. `anon` mag niets en `authenticated` mag alleen lezen. Wijzigen gaat alleen via databasefuncties die alleen de service role mag uitvoeren, dus alleen via de Edge Functions.
- **Eén controle voor alles:** elke policy gaat via `private.authorize()`. Die eist:
  - AAL2 (2FA gedaan);
  - een actief account;
  - een definitief wachtwoord;
  - dat de rol in het token nog de rol in de database is.

  Na een rolwijziging of deactivering verliest een nog geldig token dus direct zijn rechten.
- **Rol nooit uit gebruikersgegevens:** de rol komt uit `user_roles`, nooit uit `user_metadata`, want die kan de gebruiker zelf aanpassen. Een access token hook zet de rol in het token en weigert tokens voor gedeactiveerde accounts, ook bij het verversen.
- **Beheerdersregels in triggers:** een beheerder kan zichzelf de rol niet afnemen en er blijft altijd een actieve beheerder. Omdat dit in triggers zit, geldt het ook voor SQL rechtstreeks in het dashboard.
- **Gebruikersbeheer:** dat loopt via de Edge Function `admin-users`. Die eist AAL2, en de databasefuncties controleren het recht nog een keer. Een rolwijziging, deactivering of reset trekt de sessies van de gebruiker in.
- **Auditlog:** de auditlog legt inloggen, wachtwoordwijzigingen en alle beheeracties vast. Triggers blokkeren wijzigen, verwijderen en leegmaken, ook voor de service role. Alleen het recht `auditlog.lezen` kan hem lezen.

### Frontend

- **Alleen de publishable key:** de frontend bevat alleen de publishable (anon) key. `npm run check:secrets` faalt als er een service role key, een andere JWT dan `anon`, een private key of een token in de build zit. Gitleaks controleert de hele git-geschiedenis.
- **XSS:** ESLint verbiedt `dangerouslySetInnerHTML`, `innerHTML`, `insertAdjacentHTML`, `document.write` en `eval`. React escapet alle tekst.
- **Content Security Policy** via `<meta>`:
  - scripts, stijlen en lettertypes alleen van de eigen site;
  - verbindingen alleen met het eigen Supabase-project;
  - Trusted Types verplicht;
  - geen `object`, `base` of formulieren naar andere sites.
- **Clickjacking:** de app weigert te draaien in een frame van een andere site.
- **Invoer:** invoer wordt in de frontend gecontroleerd en opnieuw door constraints in de database en door de Edge Functions.
- **Geen servertekst:** foutmeldingen in de interface zijn vaste Nederlandse teksten. Fouttekst van de server tonen we niet.

### Tests

- **pgTAP:** rechten per rol, zonder 2FA, gedeactiveerd, met een tijdelijk wachtwoord, met een vervalst of verouderd token, en anoniem.
- **Integratietests:** tegen een lokale Supabase met echte Auth. Ze tonen aan:
  - dat registreren geweigerd wordt;
  - dat de hook werkt;
  - dat 2FA verplicht is;
  - dat wachtwoord wijzigen, gebruikersbeheer en deactiveren werken;
  - dat de beheerdersregels gelden.
- **Bij elke wijziging:** CI draait alles, en er wordt alleen gedeployd als alles groen is.

## Resterende risico's

Deze risico's blijven bewust bestaan, omdat ze niet op te lossen zijn binnen deze opzet (GitHub Pages en Supabase) of omdat de oplossing meer kost dan ze oplevert. Per risico staat wat het betekent en hoe het beperkt is.

### 1. XSS geeft toegang tot de sessie

**Risico:** de sessie (access en refresh token) staat in `localStorage`. Kan een aanvaller toch script in de pagina krijgen, dan kan hij de tokens lezen en de sessie overnemen tot die wordt ingetrokken.

**Waarom niet weg:** een statische site op GitHub Pages kan geen `HttpOnly`-cookies zetten, en Supabase Auth werkt in de browser met opgeslagen tokens.

**Beperking:**
- CSP met alleen eigen scripts en Trusted Types;
- het ESLint-verbod op HTML-sinks;
- geen scripts van derden;
- korte access tokens.

Het grootste overblijvende pad is een gecompromitteerde npm-afhankelijkheid (zie 9).

### 2. Inactiviteit alleen in de browser *(op het Free-plan)*

**Risico:** het automatisch uitloggen na 15 minuten gebeurt in de browser. Wie het refresh token heeft, bijvoorbeeld via XSS of een onbeheerde, niet uitgelogde browser met de devtools open, kan de sessie langer gebruiken.

**Beperking:**
- Op het **Pro-plan** zet je de inactivity timeout en de maximale sessieduur ook aan de serverkant aan (zie README).
- Een beheerder kan sessies altijd intrekken door het account te deactiveren.

### 3. Een access token blijft tot 15 minuten geldig

**Risico:** na uitloggen of het intrekken van sessies blijft een al uitgegeven access token geldig tot het verloopt.

**Beperking:**
- Na een rolwijziging of deactivering weigert `authorize()` het token direct, omdat het de database controleert.
- Alleen bij gewoon uitloggen houdt een gestolen token maximaal 15 minuten dezelfde rechten.

### 4. Het tijdelijke wachtwoord tussen aanmaken en eerste login

**Risico:** de beheerder ziet het tijdelijke wachtwoord en geeft het door. Wie het onderschept vóór de eerste login, kan zelf 2FA koppelen en het account overnemen.

**Beperking:**
- Geef het wachtwoord persoonlijk door, niet per e-mail of chat, en laat de gebruiker direct inloggen.
- Het overzicht toont "Tijdelijk wachtwoord" en of 2FA is ingesteld. Staat een account te lang zo, of zegt de gebruiker dat hij 2FA nog niet heeft gekoppeld terwijl het overzicht "Ingesteld" toont, dan reset de beheerder wachtwoord en 2FA.

### 5. Beheerders zijn vertrouwd

**Risico:** een beheerder kan het wachtwoord en de 2FA van een ander resetten en dus elk account overnemen. Eigenaren van het Supabase-project kunnen met de service role of als superuser alles, ook de triggers van de auditlog weghalen.

**Beperking:**
- Alle beheeracties staan in de auditlog.
- Houd het aantal beheerders en Supabase-eigenaren klein, en gebruik voor het Supabase- en GitHub-account zelf ook 2FA.

### 6. Geen herstel zonder beheerder

**Risico:** wachtwoord vergeten of telefoon kwijt kan alleen een beheerder oplossen. Kan geen enkele beheerder meer inloggen, dan is herstel alleen mogelijk via de SQL Editor van Supabase (zie README).

**Waarom:** de app verstuurt bewust geen e-mail.

### 7. Geen HTTP-beveiligingsheaders

**Risico:** GitHub Pages laat geen eigen headers toe. Daardoor ontbreken `frame-ancestors`, `X-Content-Type-Options` en `Permissions-Policy`. De CSP staat in een `<meta>`, en daarin werken `frame-ancestors`, `report-uri` en `sandbox` niet.

**Beperking:**
- De app weigert te draaien in een frame van een andere site.
- GitHub Pages zet zelf HTTPS en HSTS.
- Wil je echte headers, zet dan een proxy met headers (bijvoorbeeld Cloudflare) voor de site.

### 8. Rate limiting

**Risico:** de Edge Functions hebben geen eigen rate limit.

**Beperking:**
- Ze vragen een geldig token met 2FA.
- `admin-users` werkt alleen voor beheerders en `wachtwoord-wijzigen` één keer per reset.
- Inloggen en 2FA-codes vallen onder de rate limits van Supabase Auth (30 per 5 minuten per IP-adres).
- Een aanval vanaf veel IP-adressen tegelijk remt dat minder; daarom is eerst het wachtwoord nodig en daarna nog de code.

### 9. Afhankelijkheden (supply chain)

**Risico:** een gecompromitteerd npm- of Deno-pakket, een GitHub Action of een Docker-image kan code uitvoeren in de build of in de browser.

**Beperking:**
- `package-lock.json` en `deno.lock` leggen versies en checksums vast.
- GitHub Actions en het gitleaks-image staan op een versietag, niet op een commit-SHA. Pin die op SHA als je dit risico kleiner wilt maken.
- Houd afhankelijkheden bij met Dependabot of `npm audit`.

### 10. Auditlog en privacy (AVG)

**Risico:** de auditlog bevat wie wanneer inlogde en wat beheerders deden, en groeit onbeperkt. Omdat niemand regels kan verwijderen, is er geen automatische bewaartermijn.

**Te doen:** spreek een bewaartermijn af. Opschonen gaat dan via een aparte migratie die de projecteigenaar uitvoert.

### 11. De code is openbaar

**Risico:** de repository is publiek, dus iedereen kan de werking en de policies lezen.

**Beperking:**
- Er staat geen enkel secret in de repository, en gitleaks controleert dat bij elke push.
- De beveiliging steunt niet op geheimhouding van de code, maar op RLS, 2FA en de server-side controles.

### 12. Teamleiders zien alle e-mailadressen

**Risico:** het recht `gebruikers.bekijken` toont naam, e-mailadres, rol en laatste login van alle accounts.

**Waarom:** dat is bewust, voor het gebruikersoverzicht. Pas de rechten in `role_permissions` aan als dat niet gewenst is.
