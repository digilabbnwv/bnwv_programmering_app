# Navigatie en paginaopbouw: analyse en plan

> **Status: plan vastgesteld (21-11-2026).** Alle vragen zijn beantwoord, zie
> [besluiten](#7-besluiten). Fase 1 en 2 zijn gebouwd, zie [fasering](#8-fasering).
> Volgende stap: fase 3.

De app groeit van één onderwerp (werkbelasting) naar twee (werkbelasting en
projectplanner), met meer op komst: indienen, uitvoering, LDV en Staf (zie
[projectplanner.md](projectplanner.md#9-fasering)). Dit document legt vast hoe de
navigatie, de schermbreedte en de opbouw van pagina's daarop meegroeien, zodat
elke nieuwe module dezelfde vorm krijgt.

## Inhoud

1. [Huidige situatie](#1-huidige-situatie)
2. [Knelpunten](#2-knelpunten)
3. [Navigatie](#3-navigatie)
4. [Tabbladen](#4-tabbladen)
5. [Breedte](#5-breedte)
6. [Opbouw van een pagina](#6-opbouw-van-een-pagina)
7. [Besluiten](#7-besluiten)
8. [Fasering](#8-fasering)

---

## 1. Huidige situatie

Het hoofdmenu ([navigatie.ts](../src/layout/navigatie.ts)) staat rechts in de
kopbalk en heeft twee uitklapmenu's. Instellingen staan in het gebruikersmenu.

| Menu | Items | Recht |
| --- | --- | --- |
| Start | – | `app.gebruiken` |
| Rapportage | Signalen, Verdeling per programma, Verdeling per medewerker | `werkbelasting.bekijken` |
| | Projectplanner (dashboard) | `projectplan.bekijken` |
| Beheer | Scholen, Medewerkers, Projectgroepen, Overige taken, Programma’s, Jaar en staffel | `werkbelasting.beheren` |
| | Jaarplan | `projectplan.bekijken` |
| | Organisatie | `projectplan.beheren` |
| Gebruikersmenu | Gebruikers, Auditlog, weergave, uitloggen | `gebruikers.beheren`, `auditlog.lezen` |

Wat iedere rol daardoor ziet:

| Rol | Menu |
| --- | --- |
| Medewerker, Alleen lezen | alleen Start; de eigen werkurenverdeling alleen via een link op de startpagina |
| Teamleider | Start, Rapportage (4), Beheer (7) |
| MT | Start, Rapportage (4), Beheer (Jaarplan, Organisatie) |
| Beheerder | alles: 15 items en 2 instellingen |

Kopbalk, inhoud en voettekst zijn allemaal maximaal 1180 px breed
(`--container-page` in [index.css](../src/styles/index.css)).

## 2. Knelpunten

| # | Bevinding | Gevolg |
| --- | --- | --- |
| 1 | Het menu is ingedeeld naar soort handeling (rapportage, beheer), niet naar onderwerp | het projectplanner-dashboard staat onder Rapportage, het jaarplan onder Beheer; wie aan het jaarplan werkt, wisselt steeds tussen twee uitklapmenu's |
| 2 | Beheer heeft 8 items en haalt dagelijks werk (scholen, projectgroepen, jaarplan) door elkaar met inrichting die je één keer per jaar aanraakt (jaar en staffel, organisatie) | lang menu, de belangrijkste dingen vallen niet op |
| 3 | Het jaarplan, het hoofdwerk van het MT, heet "Beheer" | het menu zegt niet wat de gebruiker er doet |
| 4 | Uitklapmenu's zijn dicht zodra je op een pagina bent; er is geen kruimelpad | je ziet niet waar je bent in de app |
| 5 | Terug-links op detailpagina's staan steeds op een andere plek met een andere tekst ("Alle medewerkers", "Terug naar het jaarplan", "Terug naar scholen") | geen vast patroon om terug te gaan |
| 6 | Rapportage, Jaarplan en Dashboard hebben elk een eigen jaarkeuze (andere breedte, andere plek); de startpagina gebruikt altijd het huidige jaar | het jaar, het kader van de hele app, is per pagina anders geregeld |
| 7 | Alles is 1180 px breed, ook de heatmap van 52 weken, de tijdlijn en tabellen met 7 à 8 kolommen | op een breed scherm blijft de helft leeg terwijl de gegevens krap staan |
| 8 | Secties staan onder elkaar: 6 op het projectplanner-dashboard, 7 op de medewerkerpagina | veel verticaal scrollen om bij de inhoud te komen |
| 9 | De werkurenverdeling (`/werkbelasting/:id`) is een losse route naast de medewerkerpagina | twee pagina's over dezelfde persoon |
| 10 | `Kengetal` staat 4 keer los in de code (met kleine verschillen), `linkStijl` 6 keer; `Sectie` staat in `werkbelasting/` maar de projectplanner gebruikt hem ook | de vormgeving loopt per pagina uit elkaar |
| 11 | Pagina-acties staan soms in de kop van een sectie, soms naast een filter en soms als linkknop in een zin (bijvoorbeeld "Fase wijzigen" op het jaarplan) | geen vaste plek voor acties |
| 12 | De rechten per pagina staan dubbel: in [router.tsx](../src/router.tsx) en in [navigatie.ts](../src/layout/navigatie.ts) | bij een nieuwe pagina kunnen ze uit elkaar lopen |

## 3. Navigatie

### Twee opties

| | A. Megamenu | B. Zijbalk + tabbladen (advies) |
| --- | --- | --- |
| Vorm | onderwerpen in de kopbalk; een klik opent een breed paneel met groepen | onderwerpen en pagina's links in een vaste, inklapbare zijbalk; tabbladen binnen de pagina |
| Waar ben ik | niet zichtbaar zodra het paneel dicht is | altijd zichtbaar |
| Wisselen tussen pagina's | twee klikken | één klik |
| Groei | goed, tot het paneel vol is | goed: groepen en items erbij |
| Met tabbladen | drie horizontale balken boven elkaar (kop, paneel of subnavigatie, tabbladen) | verticaal = waar in de app, horizontaal = welk deel van de pagina |
| Weinig items (medewerker) | past goed | zijbalk is bijna leeg; zie hieronder |

Een megamenu met dezelfde indeling als nu lost knelpunt 1 tot en met 3 niet op:
het probleem zit in de groepen, niet in de vorm van het menu. Een megamenu werkt
vooral voor websites die je af en toe bezoekt; deze app is een werktool waarin
je de hele dag tussen een paar schermen wisselt.

**Besluit: optie B.**

### Indeling

Per onderwerp, en binnen een onderwerp naar wat je doet:

| Groep | Items | Recht |
| --- | --- | --- |
| – | Start | `app.gebruiken` |
| Werkbelasting | Teamoverzicht, Medewerkers | `werkbelasting.bekijken` (Medewerkers alleen-lezen; wijzigen met `werkbelasting.beheren`) |
| Inzet | Scholen, Programma’s, Projectgroepen, Overige taken | `werkbelasting.beheren` |
| Projectplanner | Dashboard, Jaarplan | `projectplan.bekijken` |
| Inrichting | Jaar en staffel, Organisatie | `werkbelasting.beheren`, `projectplan.beheren` |
| Systeem (onderaan) | Gebruikers, Auditlog | `gebruikers.beheren`, `auditlog.lezen` |

- **Teamoverzicht** vervangt de drie rapportagepagina's (zie [tabbladen](#4-tabbladen)).
- **Projectgroepen** is de brug tussen jaarplan en werkbelasting en wordt
  belangrijker in fase 5 van de projectplanner (uitvoering). Een project toont
  altijd zijn projectgroep en andersom.
- **Medewerkers** is met `werkbelasting.bekijken` alleen-lezen te zien: de
  lijst en alle tabbladen van een medewerker, zonder knoppen om te wijzigen.
  Zo ziet het MT een medewerker volledig. De database staat dat al toe (de
  leesregels in `20261023120000_werkbelasting.sql` vragen
  `werkbelasting.bekijken`); alleen de routes en de knoppen veranderen.
- Een groep zonder zichtbare items verdwijnt, zoals nu.
- Weergave (licht/donker) en uitloggen blijven in het gebruikersmenu rechtsboven.

### Weinig items

Een medewerker of iemand met Alleen lezen heeft maar één of twee bestemmingen.
Dan geen zijbalk: de kopbalk toont Start en **Mijn werkurenverdeling** als vaste
links. Die laatste zit nu alleen op de startpagina.

### Inklappen

Op een groot scherm staat de zijbalk standaard uitgeklapt, met namen. Wie hem
inklapt tot iconen, houdt dat zo op dit apparaat (localStorage, met try/catch).
Ingeklapt tonen de iconen hun naam als tooltip en blijven ze met het toetsenbord
bereikbaar.

### Kopbalk

Over de volle breedte en vast bovenaan: logo, jaarkeuze en het gebruikersmenu.
Het kruimelpad staat niet in de kopbalk maar boven de titel van de pagina (zie
[opbouw van een pagina](#6-opbouw-van-een-pagina)): daar kent de pagina zijn
eigen naam.

### Jaarkeuze

Eén jaarkeuze voor de hele app, in de kopbalk.

- Het jaar staat in de URL (`?jaar=`), zodat een gedeelde link hetzelfde jaar
  toont, en wordt per gebruiker onthouden (localStorage, met try/catch).
- De keuzelijst toont de jaren waarvoor een werkjaar of een jaarplan bestaat.
- Elke pagina leest het jaar daaruit. Geen werkjaar of jaarplan voor dat jaar:
  een lege staat met de actie om het aan te maken (bijvoorbeeld "Jaarplan 2028
  toevoegen"), alleen met het juiste recht.
- Pagina's zonder jaar (Organisatie, Gebruikers, Auditlog) tonen de keuze niet.

### Mobiel

De zijbalk wordt een uitschuifmenu achter de knop Menu, zoals het huidige mobiele
menu: groepen als kopje met de items eronder.

## 4. Tabbladen

Tabbladen verdelen een grote pagina in delen, zodat je minder scrolt.

### Regels

- Een tabblad heeft een eigen URL (`/medewerkers/123/werk`). Links, de
  terugknop en het kruimelpad blijven daardoor werken.
- Tabbladen zijn links met `aria-current="page"` in een `nav`, geen ARIA-tabbladen
  (`role="tablist"`): elk tabblad is een eigen adres.
- Hoogstens 5 tabbladen per pagina.
- Filters en het jaar staan boven de tabbladen en gelden voor alle tabbladen.
- Waarschuwingen verstop je niet in een tabblad: het tabblad krijgt een teller
  ("Signalen 3").
- Afdrukken drukt het actieve tabblad af.
- Het eerste tabblad is de standaard; `/medewerkers/123` toont dat tabblad.

### Per pagina

| Pagina | Tabbladen |
| --- | --- |
| Teamoverzicht (nu drie pagina's onder Rapportage) | Signalen · Per medewerker · Per programma |
| Medewerker | Gegevens en contract · Werk (scholen, programma-uitvoering, projectgroepen, overige taken) · Extra uren · Werkurenverdeling (nu `/werkbelasting/:id`). Teamleider en beheerder zien alles met knoppen, het MT alles alleen-lezen, de medewerker zelf alleen het tabblad Werkurenverdeling (via Mijn werkurenverdeling) |
| Projectplanner-dashboard | Samenvatting (kengetallen, signalen) · Drukte (heatmap, gelijktijdig, inzet per functie) · Budget · Tijdlijn |
| Jaarplan | Projecten · Afwijkingen (na definitief maken) · Vergelijken met de Excel (proefjaar) |
| Project | Overzicht · Inzet per jaar · Projectgroep |
| Organisatie | één tabblad per afdeling, met functies en takken naast elkaar |

Oude adressen (`/rapportage/signalen`, `/werkbelasting/:id`) sturen door naar het
nieuwe tabblad, zoals `/rapportage` nu al doorstuurt.

Kleinere pagina's (school, programma, projectgroep, taak) krijgen geen
tabbladen maar twee kolommen (zie [breedte](#5-breedte)).

## 5. Breedte

Kopbalk en zijbalk lopen over de volle breedte. De inhoud krijgt een van drie
breedtes, via een prop `breedte` op `Pagina`:

| Breedte | Maximaal | Voor |
| --- | --- | --- |
| `smal` | ± 720 px | formulieren, inloggen, wachtwoord, 2FA |
| `standaard` | ± 1280 px | lijsten en detailpagina's; op een breed scherm in twee kolommen: hoofdinhoud links, kerngegevens en acties rechts |
| `breed` | ± 1920 px, vloeiend | dashboards, het teamoverzicht, het jaarplan, grote tabellen |

- Lopende tekst blijft op `max-w-prose`, ook op een brede pagina.
- Afdrukken gebruikt de volle papierbreedte, zoals nu.
- De voettekst vervalt: hij voegt niets toe en kost hoogte. Naam van de
  organisatie en team staan al in het logo.

## 6. Opbouw van een pagina

Elke pagina heeft dezelfde volgorde:

1. **Kruimelpad**, bijvoorbeeld Projectplanner › Jaarplan 2027 › Verbouwing
   Elspeet. Vervangt de losse terug-links.
2. **Paginakop**: titel, eventueel een statuslabel (concept, definitief,
   vastgesteld) en de primaire acties rechts (Wijzigen, Afdrukken, Definitief
   maken). Hoogstens één primaire knop.
3. **Tabbladen**, als de pagina ze heeft.
4. **Filterbalk**, als de pagina filters heeft.
5. **Kengetallen**, als rij kaarten.
6. **Inhoud**: secties met een kop en eventueel acties per sectie.

### Paginapatronen

Vast te leggen in het [design system](designsystem/bnwv-designsystem.html):

| Patroon | Opbouw | Voorbeelden |
| --- | --- | --- |
| Lijst | kop met actie "… toevoegen", filterbalk, tabel | Scholen, Medewerkers, Projectgroepen |
| Detail | kruimelpad, kop met acties, tabbladen of twee kolommen | Medewerker, School, Project |
| Dashboard | kop, filterbalk, kengetallen, tabbladen met grafieken en tabellen | Start, Teamoverzicht, Projectplanner |
| Formulier | dialoog (`FormulierDialoog`), of een smalle pagina | alle wijzig-dialogen, wachtwoord wijzigen |

### Bouwstenen

Naar `src/components/`, één keer gedefinieerd:

| Component | Nu | Wordt |
| --- | --- | --- |
| `PaginaKop` | `Pagina` (titel en intro) | titel, intro, statuslabel, acties, kruimelpad, breedte |
| `Kruimelpad` | losse terug-links | afgeleid uit de routeconfiguratie, met de naam van het object |
| `Tabbladen` | – | links met `aria-current`, teller per tabblad |
| `Filterbalk` | losse `SelectField`s per pagina | vaste plek en uitlijning |
| `Kengetal` | 4 kopieën | één component, met `tabular-nums` |
| `Sectie`, `Blok` | `werkbelasting/onderdelen.tsx`, `StartPage.tsx` | `components/` |
| `Tekstlink` | `linkStijl` in 6 bestanden | één component |
| `StatusLabel` | tekst in een zin | label naast de titel |

### Eén configuratie voor routes en menu

Elke pagina krijgt één regel met pad, label, recht, groep, breedte en eventueel
tabbladen. Daaruit volgen de routes, het menu, het kruimelpad en de
rechtencontrole (`VereistRecht`). Dat lost knelpunt 12 op.

## 7. Besluiten

Genomen op 21-11-2026:

| # | Vraag | Besluit |
| --- | --- | --- |
| 1 | Zijbalk (B), megamenu (A) of een tweeregelige kopbalk? | zijbalk met tabbladen in de pagina; geen zijbalk bij één of twee bestemmingen |
| 2 | Klopt de indeling in groepen, en de namen (Inzet, Inrichting, Teamoverzicht)? | ja, zoals in [indeling](#indeling) |
| 3 | Eén jaarkeuze voor de hele app, of per pagina? | één keuze in de kopbalk, in de URL en per gebruiker onthouden |
| 4 | Werkurenverdeling als tabblad van de medewerker? | ja; oude links sturen door; de medewerker zelf ziet alleen dat tabblad |
| 5 | Voettekst weg? | ja |
| 6 | Mag het MT de medewerkers zien? Nu kan dat alleen met `werkbelasting.beheren`. | ja, alleen-lezen met `werkbelasting.bekijken`: lijst en alle tabbladen, zonder knoppen |
| 7 | Hoe staat de zijbalk standaard? | uitgeklapt; inklappen tot iconen wordt per apparaat onthouden |

## 8. Fasering

| Fase | Inhoud | Klaar als |
| --- | --- | --- |
| 1 | **Fundament**: bouwstenen uit [6](#bouwstenen) naar `components/`; prop `breedte`; één configuratie voor routes en menu. Weinig zichtbaar. | geen dubbele `Kengetal`/`linkStijl` meer; rechten op één plek; tests groen — **gebouwd nov 2026** |
| 2 | **Navigatie**: nieuwe indeling, zijbalk (standaard uitgeklapt, inklappen onthouden, mobiel uitschuifmenu), kruimelpad, jaarkeuze in de kopbalk, voettekst weg | elke rol ziet het juiste menu; het jaar geldt op alle pagina's — **gebouwd nov 2026** |
| 3 | **Tabbladen** op Teamoverzicht, Medewerker, Projectplanner-dashboard en Jaarplan, met doorsturen vanaf de oude adressen; Medewerkers alleen-lezen met `werkbelasting.bekijken` | die pagina's passen zonder lang scrollen; oude links werken; het MT ziet medewerkers zonder wijzigknoppen |
| 4 | **De rest**: overige pagina's naar de vaste opbouw en de juiste breedte; paginapatronen in het design system | elke pagina volgt een patroon |

Fase 1 is ook los waardevol: de volgende modules van de projectplanner
(uitvoering, indienen, LDV en Staf) worden dan met dezelfde bouwstenen gebouwd.

Elke fase: unit-tests voor de navigatie (`navigatie.test.ts`), controle met
toetsenbord en schermlezer, licht en donker, en afdrukken.

### Fase 1: wat er gebouwd is

- **Eén paginaconfiguratie**: [paginas.ts](../src/layout/paginas.ts) heeft per
  pagina het pad, het recht en (voor het menu) de naam. De router maakt elke
  route met `route(PAGINAS.x, <Pagina />)`, het menu verwijst naar dezelfde
  regels. Tests controleren dat elk pad uniek is en dat elke pagina met een naam
  in het menu of bij de instellingen staat.
- **Bouwstenen in `src/components/`**:
  - `Kengetal` en `Kengetallen` (Kengetal.tsx): vervangen vier kopieën. De rij
    vult de breedte zelf (`auto-fit`, minstens 10rem per kaart), dus de vaste
    kolomaantallen per pagina zijn weg; op een telefoon staan er nu twee naast
    elkaar in plaats van één.
  - `Sectie`, `Blok` en `Gegevens` (Sectie.tsx): uit `werkbelasting/onderdelen.tsx`
    en `StartPage.tsx`.
  - `Laadstatus` (bij `Melding`): uit `werkbelasting/onderdelen.tsx`.
  - `Tekstlink`: vervangt `linkStijl` in zes bestanden en de losse link-klassen
    op ruim twintig plekken; `licht` voor links in een tabelcel. Een paar
    terug-links hadden geen hover-stijl; nu wel.
  - `Filterbalk`: de balk met jaar en knoppen op Rapportage, Projectplanner,
    Werkurenverdeling, Jaarplan, Jaar en staffel en Scholen. Overal `mb-8` en
    niet op papier; bij Jaarplan, Jaar en staffel en Scholen was de balk eerst
    wel op papier zichtbaar en bij Scholen `mb-6`.
- **Breedte**: `<main>` loopt over de volle breedte; `Pagina` (en `PaginaKader`
  voor de laadstatus van `VereistRecht`) houdt de inhoud op `smal` (720 px),
  `standaard` (1180 px, zoals het was) of `breed` (1920 px). Alle pagina's staan
  nog op `standaard`; de keuze per pagina volgt in fase 4, als de kopbalk in
  fase 2 ook de volle breedte heeft.
- **Bewust uitgesteld** tot het eerste gebruik, om geen ongebruikte code te
  hebben: `Kruimelpad` (fase 2), `Tabbladen` (fase 3), en in `Pagina` de
  props voor acties en een statuslabel (fase 4).

### Fase 2: wat er gebouwd is

- **Indeling** zoals in [indeling](#indeling), in
  [navigatie.ts](../src/layout/navigatie.ts): Start en Mijn werkurenverdeling
  los bovenaan, dan Werkbelasting, Inzet, Projectplanner en Inrichting, en
  onderaan Systeem. Gebruikers en Auditlog staan niet meer in het
  gebruikersmenu; dat heeft nu naam, rol, weergave en uitloggen.
  - Tot fase 3 staan onder Werkbelasting nog de drie rapportagepagina's
    (Signalen, Verdeling per medewerker, Verdeling per programma); in fase 3
    worden ze samen het Teamoverzicht met tabbladen.
  - Het dashboard van de projectplanner heeft een eigen adres: `/projectplanner`.
    `/rapportage/projectplanner` stuurt door, met `?jaar=`.
  - **Mijn werkurenverdeling** (`/mijn-werkurenverdeling`) toont de
    werkurenverdeling van de medewerker die aan het account gekoppeld is
    ([EigenMedewerker.tsx](../src/layout/EigenMedewerker.tsx)). Zonder
    gekoppelde medewerker staat het item niet in het menu.
- **Zijbalk** ([Zijbalk.tsx](../src/layout/Zijbalk.tsx)): 18rem breed, vast
  onder de kopbalk, met eigen lijniconen ([Icoon.tsx](../src/layout/Icoon.tsx)).
  Ingeklapt 4rem met alleen iconen; de naam staat dan in sr-only en, bij hover
  of focus, in een tooltip naast de balk. De keuze staat in localStorage
  (`bnwv.zijbalk`). Met twee of minder bestemmingen (een medewerker) is er geen
  zijbalk en staan de links in de kopbalk.
- **Kopbalk**: 64 px, vast bovenaan, over de volle breedte; de voettekst is weg.
- **Jaarkeuze** ([jaarkeuze.ts](../src/layout/jaarkeuze.ts) en
  [JaarProvider.tsx](../src/layout/JaarProvider.tsx)): één keuzelijst in de
  kopbalk, alleen op pagina's met `metJaar` in PAGINAS. Het jaar komt uit de URL
  (`?jaar=`), anders uit localStorage (`bnwv.jaar`), anders het huidige jaar. De
  lijst bevat de jaren met een werkjaar of jaarplan, plus het huidige en het
  gekozen jaar. De eigen jaarkeuzes op Signalen, Verdelingen,
  Werkurenverdeling, Projectplanner, Jaarplan, Scholen en Jaar en staffel zijn
  weg; de startpagina volgt nu ook de keuze in plaats van altijd het huidige
  jaar.
  - Heeft een jaar geen werkjaar of jaarplan, dan zegt de pagina dat en toont
    knoppen naar de jaren die er wel zijn (`AndereJaren`). Jaarplan en Jaar en
    staffel bieden dan ook aan om dat jaar toe te voegen.
  - Gevolg van één jaar: de projectplanner opende eerst vanzelf het jaarplan van
    volgend jaar. Nu begint iedereen op het huidige jaar en kiest het MT één keer
    2027; dat wordt onthouden, ook voor de werkbelasting.
- **Kruimelpad** in `Pagina`, boven de titel: de menugroep en, bij een
  detailpagina, het overzicht erboven als link (`ouder` in PAGINAS). Mag je het
  overzicht niet zien, dan is er geen kruimelpad. De losse links "Alle scholen",
  "Alle medewerkers", "Terug naar het jaarplan" en dergelijke zijn weg, net als
  de link "Teamoverzicht" op de werkurenverdeling.
- **Tests**: menu per rol, zijbalk of kopbalk per rol, `paginaBij`, het
  kruimelpad en de jaarkeuze.
- **Bekeken** in de browser met een nep-Supabase-client (licht en donker,
  groot scherm, ingeklapt, medewerker zonder zijbalk, telefoon). Niet met
  echte gegevens of echte login.
