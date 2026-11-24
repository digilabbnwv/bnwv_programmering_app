# Werkbelasting: plan

Digitale versie van de memo "Werkurenverdeling" per medewerker, voor het hele
team op te vragen. Uitgangspunt is de memo 2026 van Ingeborg.

## Keuzes

| Onderwerp | Keuze |
| --- | --- |
| Periode | Kalenderjaar. Leerlingaantal en staffel worden per jaar vastgelegd. |
| Zichtbaarheid | Een medewerker ziet alleen de eigen gegevens. Teamleider en beheerder zien en beheren het hele team. |
| Staffel | Beheerbaar in de app, per jaar en per soort school (PO, VO, KDV). |
| Realisatie | Alleen planning. Uren schrijven valt buiten deze opzet. |
| Schrijven | Databasefuncties die 2FA en het recht `werkbelasting.beheren` eisen en de auditlog schrijven. Geen Edge Function. |

## Rekenregels (zoals de memo)

- **Contracturen** = uren per week × werkweken (standaard 47). Verandert het contract
  in de loop van het jaar, dan telt elke periode naar rato van het aantal dagen.
- **Mijmertijd** = contracturen × mijmerpercentage (standaard 20%).
- **Beschikbare werktijd** = contracturen − mijmertijd.
- **Schooluren** = uren volgens de staffel bij het leerlingaantal + een correctie
  per school (bijv. "inclusief PSZ"). Naar rato van de periode dat de medewerker
  de school heeft (overdracht halverwege het jaar).
- **Projectgroepen** = uren per deelnemer per jaar, naar rato van de deelnameperiode.
- **Programma-uitvoering** = uren per vaste uitvoerder per jaar bij een programma zonder scholen (bijv. Digilabs), naar rato van de periode. Overdragen werkt zoals bij overige taken.
- **Overige taken** = uren per uitvoerder per jaar, naar rato van de periode. Een taak kan meerdere uitvoerders tegelijk hebben; overdragen laat de een stoppen en de ander met dezelfde uren beginnen.
- **Nog niet ingevuld** = beschikbare werktijd − schooluren − programma-uitvoering − projecturen − overige taken. Negatief = overbelast.
- **Programma's**: een programma werkt óf met scholen (dBos, BoekStart), óf met vaste uitvoerders (Digilabs), nooit allebei. Elke school valt onder een programma met scholen. De uren per programma zijn de schooluren en de programma-uitvoering samen: één optelling, ongeacht waar de uren vandaan komen. Projectgroepen, overige taken en extra uren vallen buiten de programma's. Een school wisselt niet van programma, dus er wordt niets per jaar vastgelegd.
- **Extra uren** (bijv. NPO-gelden) staan los van het contract en tellen niet mee in de percentages.
- **Percentages** zijn ten opzichte van de contracturen, zoals in de memo. Per week = jaaruren ÷ werkweken.
- Werkweken en mijmerpercentage zijn per jaar in te stellen en per contract te overschrijven.

## Datamodel

| Tabel | Inhoud |
| --- | --- |
| `werkjaren` | jaar, werkweken, mijmerpercentage |
| `programmas` | naam, omschrijving en type: `scholen` (bijv. dBos, BoekStart) of `uitvoerders` (bijv. Digilabs). Het type wijzigt alleen zolang er niets aan het programma hangt. |
| `staffel_schijven` | jaar, soort school, van–tot leerlingen → uren |
| `scholen` | naam, soort, programma (verplicht, type `scholen`), BRIN, adres, postcode, plaats, contactpersoon, e-mail, telefoon, opmerking, actief |
| `school_jaargegevens` | per school per jaar: leerlingaantal, urencorrectie + reden, markering `overgenomen` (van het vorige jaar, nog niet met de hand opgeslagen) en `van_duo` (telling van DUO, aantal niet met de hand gewijzigd) |
| `medewerkers` | naam, e-mail, afdeling en functie (uit de lijsten van de [organisatie](projectplanner.md#functies)), actief, optioneel gekoppeld aan een inlogaccount. Het oude tekstveld `functie` blijft tot iedereen is ingedeeld. |
| `contracten` | per medewerker: ingangsdatum, uren per week, eventueel afwijkende werkweken of mijmerpercentage |
| `school_toewijzingen` | school ↔ medewerker met start- en einddatum. Per school één medewerker tegelijk. |
| `projectgroepen` | naam, omschrijving, MATT projectnummer, start- en einddatum, trekker, en het project uit de [projectplanner](projectplanner.md#van-project-naar-projectgroep) als de groep daaruit ontstond |
| `projectgroep_deelnemers` | medewerker, uren per jaar, start- en einddatum |
| `programma_uitvoerders` | bij een programma van het type `uitvoerders`: medewerker, uren per jaar, start- en einddatum |
| `taken` | naam, omschrijving, start- en einddatum |
| `taak_uitvoerders` | medewerker, ureninschatting per jaar, start- en einddatum |
| `extra_uren` | uren buiten het contract: jaar, omschrijving, financier, school |
| `werkbelasting_toelichtingen` | per medewerker per jaar: vrije toelichting en status concept/vastgesteld |
| `duo_leerlingaantallen` | telling van DUO per vestiging (BRIN6) en peiljaar; `aantal` is leeg bij 1 t/m 4 leerlingen |
| `duo_vestigingen` | vestigingen bo en so in Gelderland (naam, adres, plaats) voor BRIN-voorstellen |
| `duo_ophaalrondes` | logboek van elke keer ophalen bij DUO: wanneer, door wie (leeg = automatisch), gelukt, aantallen, foutmelding |

## Leerlingaantallen van DUO

De app haalt de leerlingaantallen op uit de [open onderwijsdata van DUO](https://onderwijsdata.duo.nl/datasets)
(open API zonder sleutel, licentie CC BY: vermeld "Bron: DUO"):

- **Leerlingen po per vestiging** (`poleerlingen-v1`): telling op 1 oktober per vestiging en peiljaar, ook (V)SO.
  DUO publiceert de telling in januari. Aantallen van 1 t/m 4 zijn afgeschermd (-1) en blijven leeg.
- **Vestigingen bo en so** (`adressen_bo`, `adressen_so`, maandelijks bijgewerkt): voor BRIN-voorstellen.

Afspraken:

- **Werkjaar = peiljaar + 1.** De telling van 1 oktober 2025 (gepubliceerd in januari 2026) hoort bij werkjaar
  2026. Zo is het aantal er aan het begin van het werkjaar, en januari t/m juli van dat jaar vallen in het
  schooljaar van die telling. Wie in november 2026 ophaalt, krijgt voor 2026 de telling van oktober 2025; de
  telling van oktober 2026 komt in januari 2027 binnen bij werkjaar 2027 (als dat jaar al bestaat).
- **Alleen lege of overgenomen aantallen** worden ingevuld; die krijgen het label "DUO". Een later gecorrigeerde
  telling werkt een DUO-aantal bij. Een met de hand ingevuld aantal blijft staan; wijkt DUO af, dan staat
  "DUO: …" erachter. Wie een DUO-aantal met de hand wijzigt, maakt het handmatig (alleen de correctie wijzigen niet).
- **BRIN**: 4 tekens is de hoofdvestiging (BRIN + 00). Scholen zonder BRIN krijgen via "BRIN-nummers koppelen"
  voorstellen op naam, postcode en plaats; alleen duidelijke overeenkomsten staan vooraf gekozen.
- **Ophalen** gebeurt in de database (extensie `http`): met de knop "Ophalen bij DUO" op Scholen, en elke maand
  automatisch via `pg_cron` (job `duo-leerlingaantallen`, de 5e om 05:00 UTC). Er zijn geen sleutels voor nodig.
  Een mislukte ronde verandert niets en staat met de foutmelding in `duo_ophaalrondes`.
- Wijzigt DUO het id van een bestand, dan mislukt het ophalen. Zoek het nieuwe id op met
  `https://onderwijsdata.duo.nl/api/3/action/package_show?id=poleerlingen-v1` en pas `private.duo_ophalen` aan.

## Rechten

| Recht | Rollen | Betekenis |
| --- | --- | --- |
| `app.gebruiken` | alle | eigen werkbelasting, scholen, projectgroepen en staffel lezen |
| `werkbelasting.bekijken` | teamleider, beheerder | werkbelasting van het hele team zien |
| `werkbelasting.beheren` | teamleider, beheerder | alles hierboven wijzigen |

Het MT (rol `mt`) heeft `werkbelasting.bekijken`, maar wijzigt niets. Zie
[projectplanner.md](projectplanner.md#rechten) voor de rechten van de projectplanner.

## Schermen

1. **Scholen**: lijst per jaar en formulier (NAW, soort, programma), leerlingaantal en correctie per jaar. Voor een nieuw jaar neemt "Leerlingaantallen van … overnemen" in één keer het aantal (en desgewenst de correctie) van het vorige jaar over voor alle actieve scholen zonder gegevens; die krijgen het label "overgenomen" tot ze bij de school worden bijgewerkt. "Ophalen bij DUO" vult de telling van DUO in (zie [Leerlingaantallen van DUO](#leerlingaantallen-van-duo)); "BRIN-nummers koppelen" stelt BRIN-nummers voor bij scholen zonder. Verder: huidige medewerker en historie, school verplaatsen naar een collega per datum.
2. **Staffel en jaarinstellingen**: schijven per jaar en soort, werkweken en mijmerpercentage.
   **Programma's** (`/programmas`): lijst met soort en het aantal actieve scholen of uitvoerders. De detailpagina toont bij een programma met scholen de scholen (het programma kies je bij de school), en bij een programma met vaste uitvoerders de uitvoerders met uren en periode, met overdragen aan een collega per datum.
3. **Medewerkers**: gegevens, functie en afdeling, koppeling met een account, contracthistorie, extra uren.
4. **Projectgroepen**: gegevens, deelnemers met uren en periode.
   **Overige taken**: gegevens, uitvoerders met uren en periode, overdragen aan een collega per datum.
5. **Rapportage** (`werkbelasting.bekijken`), drie pagina's met hetzelfde jaar (`?jaar=`): **Signalen** (`/rapportage/signalen`, ook via `/rapportage`) met kengetallen en aandachtspunten; **Verdeling per programma** (`/rapportage/programmas`) met de uren per programma, totaal en per medewerker; **Verdeling per medewerker** (`/rapportage/medewerkers`) met filters, sorteren en uren of percentages.
   **Werkurenverdeling** (`/werkbelasting/:id`): de memo per medewerker, printbaar, met toelichting. De scholen staan met hun programma, programma-uitvoering heeft een eigen blok; de verdeling van de werkuren splitst de programma-uren per programma. Iedereen ziet de eigen verdeling.
   **Vaststellen** (`werkbelasting.beheren`) bewaart de totalen van dat moment. Wijken de uren later af, dan meldt de pagina dat de gegevens na het vaststellen zijn gewijzigd. "Terug naar concept" heft de vaststelling op.
6. **Dashboard (Start)**: mijn verdeling (grafiek), mijn programma's, mijn scholen, mijn projectgroepen, signalen. Het teamblok toont ook de uren per programma.

Signalen: overbelast (negatief nog niet ingevuld), geen contract, school zonder medewerker, projectgroep zonder deelnemers, taak zonder uitvoerder.

## Fasering

1. Database (migratie, rechten, functies, pgTAP) en rekenmodel met unit-tests.
2. Beheerschermen: staffel/jaar, scholen, medewerkers, projectgroepen.
3. Rapportage team en individueel.
4. Dashboard met grafieken.
