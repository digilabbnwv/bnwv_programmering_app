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
- **Overige taken** = uren per uitvoerder per jaar, naar rato van de periode. Een taak kan meerdere uitvoerders tegelijk hebben; overdragen laat de een stoppen en de ander met dezelfde uren beginnen.
- **Nog niet ingevuld** = beschikbare werktijd − schooluren − projecturen − overige taken. Negatief = overbelast.
- **Programma's**: de schooluren tellen mee bij het programma van de school (bijv. dBos, BoekStart). Projectgroepen, overige taken en extra uren vallen buiten de programma's. Een school wisselt niet van programma, dus er wordt niets per jaar vastgelegd.
- **Extra uren** (bijv. NPO-gelden) staan los van het contract en tellen niet mee in de percentages.
- **Percentages** zijn ten opzichte van de contracturen, zoals in de memo. Per week = jaaruren ÷ werkweken.
- Werkweken en mijmerpercentage zijn per jaar in te stellen en per contract te overschrijven.

## Datamodel

| Tabel | Inhoud |
| --- | --- |
| `werkjaren` | jaar, werkweken, mijmerpercentage |
| `programmas` | naam en omschrijving, bijv. dBos of BoekStart |
| `staffel_schijven` | jaar, soort school, van–tot leerlingen → uren |
| `scholen` | naam, soort, programma, BRIN, adres, postcode, plaats, contactpersoon, e-mail, telefoon, opmerking, actief |
| `school_jaargegevens` | per school per jaar: leerlingaantal, urencorrectie + reden |
| `medewerkers` | naam, e-mail, functie, actief, optioneel gekoppeld aan een inlogaccount |
| `contracten` | per medewerker: ingangsdatum, uren per week, eventueel afwijkende werkweken of mijmerpercentage |
| `school_toewijzingen` | school ↔ medewerker met start- en einddatum. Per school één medewerker tegelijk. |
| `projectgroepen` | naam, omschrijving, start- en einddatum, trekker |
| `projectgroep_deelnemers` | medewerker, uren per jaar, start- en einddatum |
| `taken` | naam, omschrijving, start- en einddatum |
| `taak_uitvoerders` | medewerker, ureninschatting per jaar, start- en einddatum |
| `extra_uren` | uren buiten het contract: jaar, omschrijving, financier, school |
| `werkbelasting_toelichtingen` | per medewerker per jaar: vrije toelichting en status concept/vastgesteld |

## Rechten

| Recht | Rollen | Betekenis |
| --- | --- | --- |
| `app.gebruiken` | alle | eigen werkbelasting, scholen, projectgroepen en staffel lezen |
| `werkbelasting.bekijken` | teamleider, beheerder | werkbelasting van het hele team zien |
| `werkbelasting.beheren` | teamleider, beheerder | alles hierboven wijzigen |

## Schermen

1. **Scholen**: lijst en formulier (NAW, soort, programma), leerlingaantal en correctie per jaar, huidige medewerker en historie, school verplaatsen naar een collega per datum.
2. **Staffel en jaarinstellingen**: schijven per jaar en soort, werkweken en mijmerpercentage.
   **Programma's** (`/programmas`): lijst met het aantal actieve scholen, detailpagina met de scholen van het programma. Het programma kies je bij de school.
3. **Medewerkers**: gegevens, koppeling met een account, contracthistorie, extra uren.
4. **Projectgroepen**: gegevens, deelnemers met uren en periode.
   **Overige taken**: gegevens, uitvoerders met uren en periode, overdragen aan een collega per datum.
5. **Rapportage** (`/rapportage`, `werkbelasting.bekijken`): teamoverzicht per jaar met kengetallen, signalen, de schooluren per programma (totaal en per medewerker), en uren en percentages per medewerker met status.
   **Werkurenverdeling** (`/werkbelasting/:id`): de memo per medewerker, printbaar, met toelichting. De scholen staan met hun programma; de verdeling van de werkuren splitst de schooluren per programma. Iedereen ziet de eigen verdeling.
   **Vaststellen** (`werkbelasting.beheren`) bewaart de totalen van dat moment. Wijken de uren later af, dan meldt de pagina dat de gegevens na het vaststellen zijn gewijzigd. "Terug naar concept" heft de vaststelling op.
6. **Dashboard (Start)**: mijn verdeling (grafiek), mijn programma's, mijn scholen, mijn projectgroepen, signalen. Het teamblok toont ook de schooluren per programma.

Signalen: overbelast (negatief nog niet ingevuld), geen contract, school zonder medewerker, projectgroep zonder deelnemers, taak zonder uitvoerder.

## Fasering

1. Database (migratie, rechten, functies, pgTAP) en rekenmodel met unit-tests.
2. Beheerschermen: staffel/jaar, scholen, medewerkers, projectgroepen.
3. Rapportage team en individueel.
4. Dashboard met grafieken.
