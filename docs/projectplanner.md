# Projectplanner: analyse en plan

> **Status: plan vastgesteld (20-11-2026).** Alle vragen zijn beantwoord, zie
> [besluiten](#5-besluiten). Fase 1 (organisatie) is gebouwd, zie
> [fasering](#9-fasering). Volgende stap: fase 2.

Bronnen: `202610-Concept-Projectplanner-BNWV-2027.xlsx` (concept-jaarplan van het
MT voor 2027), `202108-bijlage A Functiestructuur versie 16.08.2021.pdf` en de
huidige app (zie [werkbelasting.md](werkbelasting.md)).

## Inhoud

1. [Het proces](#1-het-proces)
2. [Analyse van de Excel](#2-analyse-van-de-excel)
3. [Wat de app nu al kan](#3-wat-de-app-nu-al-kan)
4. [Het gat](#4-het-gat)
5. [Besluiten](#5-besluiten)
6. [Ontwerp](#6-ontwerp)
7. [Drukte per week](#7-drukte-per-week)
8. [Dashboard voor MT en directie](#8-dashboard-voor-mt-en-directie)
9. [Fasering](#9-fasering)
10. [Aannames](#10-aannames)
11. [Later](#11-later)

---

## 1. Het proces

| Periode | Stap | Wie | Resultaat |
| --- | --- | --- | --- |
| aug – okt | Jaarplannen indienen | specialisten | wensen: projecten met budget en inzet |
| okt – dec | Concept-jaarplan opstellen | MT | wat gaan we doen, wat kost het, wie is nodig |
| dec | Definitief maken | MT | vastgesteld jaarplan |
| jan – dec | Projectgroepen starten, collega's koppelen | teamleiders / trekkers | projectgroepen met deelnemers en uren |
| jaarwisseling | Lopende projecten meenemen | MT | het deel na de jaargrens in het nieuwe jaarplan, eventueel herzien |

Projecten hebben altijd een begin en een eind. Wat doorlopend is, wordt een
programma (Digilabs, Peuterbieb, Boekjes & Babbels) en valt buiten de
projectplanner. Dat onderscheid zit al in de app.

## 2. Analyse van de Excel

### Opbouw

- **Tabbladen**: `Programmering`, `Staf`, `LDV`, plus `TOTAAL INZET JAAR` en
  `Blad1`, die allebei leeg zijn. Er is dus geen totaal over de afdelingen heen.
- **Per tabblad**: projecten gegroepeerd per tak (samengevoegde cellen in kolom A).
  - Programmering: Doorgaande leeslijn, Digitaal, IDO, Taal, Jeugd, Volwassenen
  - Staf: HR, Staf, MT, IT, Projecten, MarCom
  - LDV: CL, Locaties, Intern
- **Kolommen per project**: financieel budget, projectleden, begin en duur
  projectgroep (LDV: "voorbereiding"), start en duur uitvoering, inzet aantal
  collega's, "inzet van".
- **Weekraster**: week 1 t/m 52 met per cel een aantal uren, en per rij een
  jaartotaal. Een keuzelijst markeert een week; opmaakregels kleuren het raster
  (restanten van een Gantt-sjabloon: `Plan`, `Werkelijk`, `PercentComplete`).
- **Totalen** onder elk blok: budget (som) en uren per week per "inzet van"
  (`SUMIF`), plus een totaalrij.
- **Projecten zonder uren**: een apart blok onderaan, alleen met budget.

### Hoe vol is het concept

Bijna leeg. Alle projectnamen en takken staan erin (± 46 Programmering, ± 26 Staf,
13 LDV), maar budget is overal leeg, het weekraster heeft twee waarden
(dBos week 1: 28, Boekstart in Kinderopvang week 1: 1) en alleen twee Staf-projecten
hebben datums en projectleden ingevuld.

### Fouten en zwakke plekken

| # | Bevinding | Gevolg |
| --- | --- | --- |
| 1 | LDV, rij 21 "Inzet PROG" telt `"LMC"` op in plaats van `"PROG"` | verkeerd totaal voor Programmering |
| 2 | Staf, budgettotaal `=SUM(C6:C39,B45:B53)` telt kolom **B** (projectnamen) in plaats van C | budget zonder uren telt niet mee |
| 3 | Staf heeft een project met inzet `MT`, maar geen totaalrij voor MT | MT-inzet valt weg |
| 4 | LDV gebruikt `CL` en `BV`, maar telt alleen STAF, LMC (en "PROG") | CL- en BV-inzet valt weg |
| 5 | Programmering: kolom "inzet van" is overal leeg | alle totalen zijn 0, ook als het raster gevuld wordt |
| 6 | "Inzet van" betekent per tabblad iets anders: functies (LMC, BM, CL) bij Programmering, teams (PROG, LDV, STAF, MT) bij Staf, een mengsel bij LDV | totalen zijn niet over de afdelingen op te tellen |
| 7 | Eén project staat op meerdere rijen, één per soort inzet ("Nationale Voorleesdagen programmering" en "… LDV"; samengevoegde cellen bij Staf) | een project is geen eenheid; budget en inzet raken los van elkaar |
| 8 | Hetzelfde project staat op meerdere tabbladen (Verbouwing Elspeet bij Staf en LDV, Groepsbezoeken bij Programmering en LDV) | dubbel tellen of juist vergeten |
| 9 | Datums en duur zijn vrije tekst ("feb-okt 2027", "gehele jaar (maandelijks 1 uur ongeveer)", "dag zelf iedereen") | niet te rekenen |
| 10 | Projectleden is vrije tekst ("projectleider en 3 anderen") | niet te koppelen aan mensen of functies |
| 11 | Onduidelijke eenheid in het weekraster: uren per persoon of voor alle collega's samen? | totalen zijn niet te interpreteren |
| 12 | Geen status (ingediend, akkoord, afgewezen, uitgesteld), geen indiener, geen relatie met vorig jaar | het proces zelf staat nergens |
| 13 | Programma's die al in de app staan (dBos, Boekstart, Digilabs, Peuterbieb, Boekjes & Babbels) staan in de Excel als project | dubbele administratie |

## 3. Wat de app nu al kan

| Onderdeel | In de app |
| --- | --- |
| Projectgroepen | naam, omschrijving, MATT projectnummer, start- en einddatum, trekker |
| Deelnemers | medewerker, uren per jaar, start- en einddatum (naar rato in de werkbelasting) |
| Programma's | met scholen (dBos, BoekStart) of met vaste uitvoerders (Digilabs) |
| Overige taken | uitvoerders met uren per jaar en periode |
| Medewerkers | naam, functie (vrije tekst), contracthistorie, beschikbare werktijd per jaar |
| Werkbelasting | per medewerker per jaar, vaststellen als momentopname, rapportage en signalen |
| Rechten | rollen beheerder, teamleider, medewerker; beheren alleen voor teamleider en beheerder |

Het is een app voor **team Programmering**: medewerkers van LDV en Staf staan er
niet in, en er bestaat geen begrip afdeling of tak.

## 4. Het gat

| Nodig voor de projectplanner | Nu |
| --- | --- |
| Afdeling (LDV, Programmering, Staf) en tak (Digitaal, IDO, …) per project | ontbreekt |
| Jaarplan per jaar met fase: wensen → concept → definitief → afgesloten | ontbreekt |
| Status per project in het jaarplan | ontbreekt |
| Budget per project per jaar | ontbreekt |
| Benodigde inzet **per functie** (nog zonder namen): aantal collega's, uren, periode | ontbreekt; de app kent alleen inzet van benoemde medewerkers |
| Voorbereiding en uitvoering als aparte periodes | één periode |
| Totalen en drukte: budget en uren per functie, per afdeling, per week | ontbreekt |
| Projecten zonder uren (alleen budget) | ontbreekt |
| Gepland (jaarplan) tegenover toegewezen (deelnemers) | ontbreekt |
| Project over de jaargrens met per jaar eigen budget en inzet | ontbreekt |
| Functies als vaste lijst, medewerkers per afdeling | vrije tekst, geen afdeling |
| Rollen voor MT en voor indienen | ontbreken |

De kern van het gat: **de app begint bij mensen, de projectplanner bij functies.**
Het MT besluit "Kinderboekenweek: 3 leesmediacoaches, 80 uur, € 2.500", pas later
wordt dat "Anna 40 uur, Bram 40 uur". Daartussen moet een koppeling komen.

## 5. Besluiten

| # | Onderwerp | Besluit |
| --- | --- | --- |
| 1 | LDV en Staf | Komen uiteindelijk ook in de app, met medewerkers. Tot dan plant het MT hun inzet al per functie. |
| 2 | Inzet | Altijd per functie, nooit per team. De functies volgen de functiestructuur (zie [functies](#functies)). |
| 3 | Weekverdeling | Doel is pieken zien. Geen weekraster om in te typen: de app spreidt uren over de periode en toont de drukte. |
| 4 | Timing | 2027 is proefjaar: schaduwdraaien naast de Excel, die leidend blijft. |
| 5 | Rechten per afdeling | Een teamleider ziet en beheert alleen de eigen afdeling; het MT ziet alles. |
| 6 | MT | Nieuwe rol `mt`: beheert het jaarplan en ziet de werkbelasting van iedereen. |
| 7 | Programma's | Programma's zijn doorlopend en worden niet gepland in de projectplanner. Hun vaste uren (scholen, uitvoerders) tellen in de drukte als "al bezet". Een project kan wel bij een programma horen (bijv. "Ontwikkeling digilab 12+"). |
| 8 | Budget | Eén bedrag per project per jaar, met een toelichting. |
| 9 | Invoer schaduwjaar | Jasper zet de cijfers uit de Excel in de app, met de import als basis. |
| 10 | Wens en besluit | Geen aparte kopie van de wens: het MT past het ingediende project direct aan. |
| 11 | Looptijd | Een project heeft altijd een begin en een eind. Loopt het over de jaargrens, dan staat het in beide jaarplannen, met per jaar eigen budget en inzet. |
| 12 | Evaluatie | Nog niet; komt later (zie [Later](#11-later)). |
| 13 | Eindproduct | Een dashboard onder Rapportage waar MT en directie alles uit halen. Geen Excel-export. |
| 14 | Realisatie | Alleen plannen, geen werkelijke uren of uitgaven. |

## 6. Ontwerp

### Begrippen

- **Afdeling**: LDV, Programmering, Staf. De directeur-bestuurder en de
  stafadviseurs vallen onder Staf.
- **Functie**: een vaste lijst uit de functiestructuur. Inzet wordt per functie
  gepland. Elke medewerker heeft een functie en een afdeling.
- **Tak**: een indeling van projecten binnen een afdeling (Doorgaande leeslijn,
  Digitaal, HR, …).
- **Project**: een projectgroep in de app, uitgebreid met afdeling, tak en
  indiener. Heeft altijd een start- en een einddatum.
- **Jaarplan**: één per jaar, met een fase.
- **Projectjaar**: een project in een jaarplan, met status en budget. Een project
  over de jaargrens heeft twee projectjaren.
- **Inzetregel**: binnen een projectjaar: functie, fase (voorbereiding of
  uitvoering), aantal collega's, **totaal aantal uren** voor die collega's samen,
  en een periode. Een project met inzet van vier functies is één project met vier
  inzetregels, ook als die functies bij een andere afdeling horen
  (Verbouwing Elspeet: Staf als eigenaar, inzet van bibliotheekmedewerkers van LDV).

### Functies

Uit de functiestructuur (2021), aangevuld met de functies uit de Excel:

| Afdeling | Functie | Afkorting | Extern |
| --- | --- | --- | --- |
| Staf | Directeur-bestuurder | | |
| Staf | Adviseur Bedrijfsvoering | | |
| Staf | Backoffice Bedrijfsvoering | BV | |
| Staf | Adviseur Finance & Control | | ja |
| Staf | Adviseur HRM | | ja |
| Staf | Medewerker HRM | | |
| Staf | Adviseur Marketing & Communicatie | | |
| Staf | Medewerker Marketing & Communicatie | | |
| Staf | Management Assistent | | |
| LDV | Manager Lokale Dienstverlening | | |
| LDV | Assistent Bibliotheekmedewerker | | |
| LDV | Bibliotheekmedewerker | BM | |
| LDV | Bibliotheekmedewerker Plus | | |
| LDV | Community Librarian | CL | |
| LDV | Vrijwilliger | | |
| LDV | Invalmedewerker | | ja |
| LDV | Opruimmedewerker | | ja |
| Programmering | Manager Programmering | | |
| Programmering | Programmacoördinator | | |
| Programmering | Specialist | | |
| Programmering | Leesmediacoach | LMC | |

De lijst is beheerbaar in de app. De leesmediacoach valt tegenwoordig onder
Programmering, niet meer onder LDV zoals in de functiestructuur van 2021. De
afdeling bij een functie is de standaard; de afdeling van een medewerker wordt
apart vastgelegd, zodat een uitzondering of een toekomstige verschuiving geen
nieuwe functie vraagt.
Voor externe functies en vrijwilligers is de capaciteit onbekend: de drukte
toont daar alleen de gevraagde uren.

De Staf-codes `PROG`, `LDV`, `STAF` en `MT` uit de Excel verdwijnen: bij de
import worden dat inzetregels met een functie, die Jasper kiest.

### Datamodel

| Tabel | Inhoud |
| --- | --- |
| `afdelingen` | naam, afkorting, volgorde |
| `functies` | naam, afkorting (uniek als hij er is), standaardafdeling, extern, actief |
| `takken` | afdeling, naam (uniek binnen de afdeling), actief |
| `medewerkers` (uitbreiden) | + afdeling, + functie (verwijzing). Het vrije tekstveld `functie` gaat weg zodra alle medewerkers een functie uit de lijst hebben. |
| `jaarplannen` | jaar (verwijst naar `werkjaren`), fase (`wensen`, `concept`, `definitief`, `afgesloten`), proefjaar, vastgesteld op en door, momentopname |
| `projectgroepen` (uitbreiden) | + afdeling, + tak, + indiener, + programma (optioneel). Einddatum wordt verplicht voor projecten in een jaarplan. De tabel houdt zijn naam, zodat de werkbelasting niet geraakt wordt; in de schermen heet het "project". |
| `projectjaren` | project, jaar, status (`ingediend`, `akkoord`, `afgewezen`, `uitgesteld`), budget, toelichting budget, toelichting MT. Eén per project per jaar. |
| `projectjaar_inzet` | projectjaar, functie, fase (`voorbereiding`, `uitvoering`), aantal collega's, uren totaal, startdatum, einddatum (binnen het jaar en binnen de looptijd van het project) |
| `projectgroep_deelnemers` (bestaand) | ongewijzigd. Toegewezen uren per functie volgen uit de functie van de deelnemer en de bestaande berekening naar rato. |

Schrijven gaat, net als nu, via databasefuncties die 2FA en het juiste recht
eisen en de auditlog schrijven. Bij **definitief maken** bewaart de app een
momentopname, zoals bij het vaststellen van de werkbelasting. Latere wijzigingen
zijn dan zichtbaar als afwijking.

### Rekenregels

- **Uren per week van een inzetregel** = uren totaal ÷ aantal weken in de periode.
  Een week telt naar rato mee als de periode halverwege begint of eindigt.
- **Pieken** maak je met een eigen inzetregel. Voorbeeld Kinderboekenweek,
  leesmediacoach: voorbereiding 20 uur van april t/m september, uitvoering 60 uur
  in week 40–41. Dat is wat het weekraster probeerde te doen, zonder 52 cellen.
- **Al bezet per functie** = voor alle medewerkers met die functie: schooluren +
  programma-uitvoering + overige taken. Dit berekent `berekenWerkbelasting` al.
- **Beschikbaar voor projecten per functie per week** = (beschikbare werktijd −
  al bezet) ÷ werkweken, opgeteld over de medewerkers met die functie.
- **Bezetting** = nodig ÷ beschikbaar, per functie per week.
- **Toegewezen per functie** = de uren van deelnemers met die functie, naar rato
  van hun deelnameperiode in het jaar.
- **Uren per persoon** = uren totaal ÷ aantal collega's (alleen ter informatie).

### Schermen

**Beheer**

1. **Projecten** (vervangt Projectgroepen): lijst per jaar, te filteren op
   afdeling, tak, status en functie. Detail: gegevens, projectjaren met status
   en budget, inzetregels, deelnemers.
2. **Jaarplan** (`/jaarplan/:jaar`): fase, aantallen per status, de knop naar de
   volgende fase, en de controle vóór het definitief maken.
3. **Organisatie**: afdelingen, functies en takken.
4. **Medewerkers**: afdeling en functie uit de lijst.

**Rapportage**

5. **Projectplanner**: het dashboard, zie [hoofdstuk 8](#8-dashboard-voor-mt-en-directie).

**Iedereen** (vanaf fase 7)

6. **Project indienen**: zolang het jaarplan in de fase `wensen` is, met
   "overnemen van vorig jaar" voor terugkerende projecten zoals de Kinderboekenweek.

### Rechten

| Recht | Rollen | Mag |
| --- | --- | --- |
| `projectplan.bekijken` | mt, teamleider, beheerder | jaarplan en dashboard zien |
| `projectplan.beheren` | mt, beheerder | projecten, status, budget en inzet wijzigen; fase van het jaarplan zetten |
| `projectplan.indienen` | medewerker, teamleider | eigen projecten indienen en wijzigen zolang de fase `wensen` is (fase 7) |
| `werkbelasting.bekijken` | mt, teamleider, beheerder | mt: alle afdelingen; teamleider: eigen afdeling (fase 6) |
| `werkbelasting.beheren` (bestaand) | teamleider, beheerder | onder meer deelnemers koppelen; teamleider: eigen afdeling (fase 6) |

## 7. Drukte per week

Het doel is niet een raster met getallen, maar zien **waar het te vol wordt en
door welke projecten**. Drie weergaven, met dezelfde filters (jaar, afdeling,
functie, alleen akkoord of ook ingediend):

1. **Heatmap functie × week.** Een rij per functie, een kolom per week (met de
   maanden erboven). Elke cel is de bezetting. Kleur van rustig via vol naar te
   vol (boven 100%). Is de capaciteit onbekend (extern, vrijwilligers, of LDV en
   Staf zolang die niet in de app staan), dan toont de cel de uren zelf,
   gekleurd ten opzichte van het gemiddelde van die functie. Zo zie je pieken
   ook zonder capaciteit.
2. **Doorklikken.** Een cel aanklikken toont welke projecten in die week uren
   van die functie vragen, met hun aandeel. Dan zie je welk project je kunt
   verschuiven.
3. **Tijdlijn per project.** Een balk per project, voorbereiding en uitvoering in
   twee tinten, gegroepeerd per afdeling en tak. Hier zie je hoeveel projecten
   tegelijk lopen, ook projecten zonder uren.

Verschuiven gebeurt in het project zelf (periode van een inzetregel aanpassen);
de drukte rekent direct opnieuw.

**Weken**: ISO-weken, zoals in de Excel. De capaciteit is jaarcapaciteit ÷
werkweken, gelijk aan de rest van de app.

## 8. Dashboard voor MT en directie

Onder **Rapportage → Projectplanner**, met recht `projectplan.bekijken`, per jaar
(`?jaar=`). Printbaar, zoals de werkurenverdeling.

| Blok | Inhoud |
| --- | --- |
| Kengetallen | fase van het jaarplan; aantal projecten per status; totaal budget; totaal uren |
| Budget | per afdeling en per tak, met en zonder uren, akkoord tegenover ingediend |
| Inzet | uren per functie: nodig, beschikbaar, bezetting over het jaar |
| Drukte | heatmap, doorklikken en tijdlijn ([hoofdstuk 7](#7-drukte-per-week)) |
| Uitvoering | per project en functie gepland tegenover toegewezen (vanaf fase 5) |
| Signalen | project zonder inzet, zonder budget of zonder einddatum; inzet buiten de looptijd; weken boven 100% per functie; akkoord en gestart maar zonder deelnemers; minder toegewezen dan gepland |
| Afwijkingen | na definitief maken: wat er sindsdien is gewijzigd |

## 9. Fasering

2027 is proefjaar: de Excel blijft leidend, de app draait mee. Eerst wat het MT
nu nodig heeft, daarna de uitvoering, en de indienronde en de jaarovergang vóór
de cyclus van 2028.

| Fase | Inhoud | Klaar als | Wanneer |
| --- | --- | --- | --- |
| 1 | **Organisatie**: afdelingen, functies, takken; medewerkers krijgen afdeling en functie; rol `mt` | lijsten beheerbaar, medewerkers Programmering ingedeeld | gebouwd nov 2026 |
| 2 | **Projecten en jaarplan**: projectgroepen uitbreiden, jaarplannen, projectjaren, inzetregels; schermen Projecten en Jaarplan; import van de Excel 2027 | MT-concept 2027 staat in de app | dec 2026 |
| 3 | **Dashboard**: kengetallen, budget, inzet, drukte, tijdlijn, signalen | MT en directie zien het concept 2027 in de app | jan 2027 |
| 4 | **Definitief maken**: momentopname en afwijkingen; vergelijking met de Excel 2027 | jaarplan 2027 vastgesteld, verschillen met de Excel verklaard | jan – feb 2027 |
| 5 | **Uitvoering**: deelnemers koppelen vanuit het project, gepland tegenover toegewezen | teamleiders koppelen collega's vanuit het jaarplan | voorjaar 2027 |
| 6 | **LDV en Staf**: medewerkers en contracten, rechten per afdeling, capaciteit voor alle functies | drukte toont bezetting voor alle functies | voor de zomer 2027 |
| 7 | **Indienen**: fase `wensen`, projecten indienen door medewerkers, overnemen van vorig jaar | klaar voor de ronde van aug 2027 (jaarplan 2028) | jul 2027 |
| 8 | **Jaarovergang**: projecten die over de jaargrens lopen komen in het nieuwe jaarplan als `ingediend`, met de resterende inzet als voorstel; jaarplan afsluiten | klaar voor 2027 → 2028 | okt 2027 |

Elke fase: migratie met pgTAP-tests, rekenregels met unit-tests, schermen,
bijwerken van deze documentatie.

### Fase 1: wat er gebouwd is

- Migratie `20261120120000_organisatie.sql`: tabellen `afdelingen`, `functies`
  en `takken` met de startgegevens uit [functies](#functies) en de takken uit de
  Excel 2027; `medewerkers` krijgt `afdeling_id` en `functie_id`. Medewerkers
  waarvan de functietekst precies een functienaam of afkorting is, zijn meteen
  ingedeeld.
- Rol `mt` en de rechten `projectplan.bekijken` en `projectplan.beheren`.
- Schrijffuncties `afdeling_opslaan`, `functie_opslaan`, `tak_opslaan` en
  `organisatie_verwijderen` (projectplan.beheren); `medewerker_opslaan` neemt nu
  afdeling en functie aan in plaats van tekst. Wijzigingen staan in de auditlog
  als `organisatie.<tabel>.<actie>`.
- Scherm **Beheer → Organisatie** (`/organisatie`): per afdeling de functies en
  takken, toevoegen, wijzigen, op inactief zetten, verwijderen zolang ze niet in
  gebruik zijn.
- Medewerkers: functie en afdeling kiezen uit de lijst; de afdeling volgt de
  functie tenzij je bewust een andere kiest. Het overzicht toont wie nog niet is
  ingedeeld.

Na het uitrollen: geef de MT-leden de rol MT (Instellingen → Gebruikers) en deel
de medewerkers van Programmering in. Het oude tekstveld `functie` gaat weg in
een latere migratie, als iedereen is ingedeeld.

### Schaduwdraaien 2027

- **Import** (fase 2): projectnaam, afdeling (tabblad), tak, en de inzetfunctie
  waar die is ingevuld. Rijen die bij één project horen ("… programmering" en
  "… LDV", samengevoegde cellen bij Staf) worden één project met meerdere
  inzetregels. Rijen die een programma zijn (dBos, Boekstart in Kinderopvang,
  Digilabs, Peuterbieb, Boekjes & Babbels, …) worden niet geïmporteerd. De import
  maakt eerst een voorstel; Jasper controleert het, daarna gaat het de database in.
- **Bijhouden**: wat het MT daarna in de Excel invult, zet Jasper over in de app.
- **Vergelijken** (fase 4): per afdeling en per functie de totalen van app en
  Excel naast elkaar. Elk verschil is ofwel een invoerfout in de app, ofwel een
  van de fouten uit [de analyse](#fouten-en-zwakke-plekken). Dat is het bewijs
  dat de app de Excel voor 2028 kan vervangen.

## 10. Aannames

Controleren in fase 1; ze blokkeren de start niet.

1. De functiestructuur van 2021 klopt verder nog op hoofdlijnen (de
   leesmediacoach is al verplaatst naar Programmering). Community Librarian
   hoort bij LDV en Backoffice Bedrijfsvoering bij Staf.
2. Het MT bestaat uit de directeur-bestuurder en de managers LDV en Programmering;
   zij krijgen de rol `mt`.
3. Voor de capaciteit van LDV en Staf gelden dezelfde werkweken en mijmertijd als
   bij Programmering. Klopt dat niet, dan passen we dat in fase 6 aan.

## 11. Later

- Evaluatie per project (afgerond, doelen behaald, toelichting).
- Slepen op de tijdlijn om een project te verschuiven.
- Budget van programma's, als het MT ook die in één overzicht wil.
