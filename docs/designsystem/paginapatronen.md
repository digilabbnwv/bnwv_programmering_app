# Paginapatronen

Hoe een pagina in de app is opgebouwd. Elke pagina volgt een van de vier
patronen hieronder; een nieuwe module kiest een patroon en verzint geen eigen
vorm. Achtergrond en besluiten: [navigatie.md](../navigatie.md). Kleuren,
letters en ruimtes: [het design system](bnwv-designsystem.html) en
`src/styles/index.css`.

## Vaste opbouw

Van boven naar beneden, alles optioneel behalve de titel:

1. **Kruimelpad**: automatisch uit `src/layout/paginas.ts` (groep en, bij een
   detailpagina, het overzicht erboven).
2. **Kop**: titel, eventueel een statuslabel, en rechts de acties voor de
   pagina als geheel. Hoogstens één primaire knop; de rest `secundair`.
3. **Intro**: één zin over wat de pagina toont.
4. **Tabbladen**, als de pagina ze heeft.
5. **Filterbalk**: keuzes die voor de hele inhoud gelden (zoeken, filters,
   "ook inactieve").
6. **Kengetallen**: een rij kaarten.
7. **Inhoud**: secties met een kop (`Sectie`) en eventueel acties per sectie.

Het jaar staat niet op de pagina maar in de kopbalk (`metJaar` in
`paginas.ts`).

## Bouwstenen

| Onderdeel | Waar | Gebruik |
| --- | --- | --- |
| `Pagina` | `layout/Pagina.tsx` | `titel`, `intro`, `status`, `acties`, `breedte` |
| `StatusLabel` | `components/StatusLabel.tsx` | naast de titel; `let-op` voor een stand die aandacht vraagt |
| `Tabbladen`, `useTabblad` | `layout/Tabbladen.tsx` | tabbladen uit `paginas.ts`; `tellers` voor meldingen, `verborgen` voor tabbladen die er (nog) niet zijn |
| `Filterbalk` | `components/Filterbalk.tsx` | keuzes boven de inhoud; niet op papier |
| `Kengetallen`, `Kengetal` | `components/Kengetal.tsx` | rij kaarten; vult de breedte zelf |
| `Sectie`, `Kolommen`, `Blok`, `Gegevens` | `components/Sectie.tsx` | secties, twee kolommen vanaf xl, kaart om een grafiek, label-waardelijst |
| `Tabel` | `components/Tabel.tsx` | tabel, op een telefoon kaartjes; sorteerbaar |
| `Tekstlink` | `components/Tekstlink.tsx` | link in tekst; `licht` in een tabelcel |
| `FormulierDialoog`, `VerwijderDialoog` | `werkbelasting/onderdelen.tsx` | toevoegen, wijzigen, verwijderen |
| `Laadstatus`, `Melding` | `components/Melding.tsx` | laden, fouten, uitleg |

## Breedte

| `breedte` | Maximaal | Voor |
| --- | --- | --- |
| `smal` | 720 px | korte pagina's met weinig inhoud (pagina niet gevonden) |
| `standaard` | 1280 px | lijsten en detailpagina's |
| `breed` | 1920 px | dashboards, het teamoverzicht, het jaarplan, Scholen, Organisatie |

Lopende tekst blijft op `max-w-prose`, ook op een brede pagina.

## De vier patronen

### Lijst

Scholen, Medewerkers, Programma's, Projectgroepen, Overige taken, Gebruikers.

- Kop met de actie "Nieuwe …" als primaire knop.
- Filterbalk met zoeken en "ook inactieve/afgelopen".
- Eventueel een regel met een telling (`role="status"`).
- Een `Tabel`; de naam in de eerste kolom is een `Tekstlink` naar de detailpagina.

### Detail

School, Medewerker, Programma, Projectgroep, Taak, Project.

- Kruimelpad terug naar de lijst.
- Kop met `Wijzigen` en `Verwijderen` (secundair) en een statuslabel als het
  object inactief is.
- Is de rechterkant smal genoeg, dan `Kolommen`: links de gegevens, rechts wat
  erbij hoort (medewerker van een school, deelnemers, uitvoerders, contract).
  Brede tabellen staan eronder over de volle breedte.
- Veel onderdelen (Medewerker): tabbladen in plaats van één lange pagina.
- Zonder het recht om te wijzigen: dezelfde pagina zonder knoppen, en links naar
  pagina's die je niet mag zien als tekst.

### Dashboard

Start, Teamoverzicht, Projectplanner.

- `breedte="breed"`.
- Kop met `Afdrukken` (secundair) en een statuslabel (bijv. de fase van het
  jaarplan).
- Filterbalk, dan kengetallen boven de tabbladen: ze gelden voor alle
  tabbladen. Het eerste tabblad heeft de signalen, met een teller.
- Grafieken in een `Blok`; uitleg bij een grafiek in `text-ui-sm` boven de
  grafiek.

### Formulier

Altijd in een `FormulierDialoog` (of `VerwijderDialoog`), niet op een eigen
pagina. Uitzondering: de stappen van het inloggen (`AuthKaart`).

- Fouten bovenaan het formulier in een `Melding`.
- Knoppen onderaan: de opslaanknop (primair) en `Annuleren`.

## Regels

- Een pagina-actie hoort in de kop; een actie voor één sectie in de kop van die
  sectie; een actie voor één rij in de tabel.
- Hoogstens één primaire knop per pagina.
- Tabbladen: hoogstens vijf, het eerste met een leeg pad, meldingen als teller.
- Wat afdrukbaar is, toont geen knoppen, filters, tabbladen of navigatie op
  papier (`print:hidden`).
- Oranje alleen als accent of achtergrond, nooit als tekstkleur (contrast).
