-- Leerlingaantallen van DUO: verwerken van tellingen (werkjaar = peiljaar + 1),
-- alleen lege of overgenomen aantallen invullen, BRIN-voorstellen en koppelen.
-- Het ophalen zelf (http naar DUO) zit niet in de test; de verwerking wel.
begin;
select plan(23);

select tests.create_user('teamleider@test.nl', 'teamleider');
select tests.create_user('medewerker@test.nl', 'medewerker');

insert into public.werkjaren (jaar) values (2025), (2026);
insert into public.scholen (id, naam, soort, programma_id, brin, postcode, plaats, actief)
select v.id::uuid, v.naam, 'PO', (select id from public.programmas where naam = 'dBos'), v.brin, v.postcode, v.plaats, v.actief
  from (values ('00000000-0000-0000-0000-00000000b001', 'De Borchstee',    '21NK00', '',        '',       true),
               ('00000000-0000-0000-0000-00000000b002', 'Wildemaetschool', '11CK',   '',        '',       true),
               ('00000000-0000-0000-0000-00000000b003', 'Agnietenschool',  '00DZ00', '',        '',       true),
               ('00000000-0000-0000-0000-00000000b004', 'Dicht',           '07XX00', '',        '',       false),
               ('00000000-0000-0000-0000-00000000b005', 'CBS De Triangel', null,     '8081 AB', 'Elburg', true))
       v (id, naam, brin, postcode, plaats, actief);
insert into public.school_jaargegevens (school_id, jaar, leerlingaantal, overgenomen) values
  ('00000000-0000-0000-0000-00000000b002', 2026, 150, true),   -- overgenomen van 2025
  ('00000000-0000-0000-0000-00000000b003', 2026, 190, false);  -- met de hand ingevuld

-- Rechten -----------------------------------------------------------------------
select tests.authenticate_as('medewerker@test.nl');
select throws_ok($$ select public.duo_ophalen() $$, '42501', null, 'medewerker: kan niet ophalen bij DUO');
select throws_ok($$ select * from public.duo_brin_voorstellen() $$, '42501', null, 'medewerker: krijgt geen BRIN-voorstellen');
select throws_ok(
  $$ select public.school_brin_koppelen('[{"school_id": "00000000-0000-0000-0000-00000000b005", "brin": "99ZZ00"}]') $$,
  '42501', null, 'medewerker: kan geen BRIN koppelen');
reset role;

select is((select count(*)::integer from cron.job where jobname = 'duo-leerlingaantallen'), 1,
  'het maandelijks ophalen staat ingepland');

-- Tellingen verwerken -----------------------------------------------------------
select is(
  private.duo_tellingen_verwerken($$[
    {"INSTELLINGSCODE": "21NK", "VESTIGINGSCODE": "00", "TYPE_PO": "BO", "PEILJAAR": 2025, "AANTAL_LEERLINGEN": 298},
    {"INSTELLINGSCODE": "21NK", "VESTIGINGSCODE": "00", "TYPE_PO": "BO", "PEILJAAR": 2024, "AANTAL_LEERLINGEN": -1},
    {"INSTELLINGSCODE": "21NK", "VESTIGINGSCODE": "00", "TYPE_PO": "BO", "PEILJAAR": 2022, "AANTAL_LEERLINGEN": 280},
    {"INSTELLINGSCODE": "11CK", "VESTIGINGSCODE": "00", "TYPE_PO": "BO", "PEILJAAR": 2025, "AANTAL_LEERLINGEN": 144},
    {"INSTELLINGSCODE": "00DZ", "VESTIGINGSCODE": "00", "TYPE_PO": "BO", "PEILJAAR": 2025, "AANTAL_LEERLINGEN": 167},
    {"INSTELLINGSCODE": "07XX", "VESTIGINGSCODE": "00", "TYPE_PO": "BO", "PEILJAAR": 2025, "AANTAL_LEERLINGEN": 226.0}
  ]$$::jsonb),
  2, 'vult een leeg aantal in en werkt een overgenomen aantal bij');
select is((select count(*)::integer from public.duo_leerlingaantallen), 6, 'alle tellingen worden bewaard');
select is(
  (select aantal from public.duo_leerlingaantallen where vestigingscode = '21NK00' and peiljaar = 2024),
  null, 'een afgeschermd aantal (-1) wordt onbekend');
select is(
  (select string_agg(s.naam || ' ' || j.leerlingaantal || ' ' || j.overgenomen || ' ' || j.van_duo, '; ' order by s.naam)
     from public.school_jaargegevens j join public.scholen s on s.id = j.school_id where j.jaar = 2026),
  'Agnietenschool 190 false false; De Borchstee 298 false true; Wildemaetschool 144 false true',
  'telling 2025 hoort bij werkjaar 2026; BRIN van 4 tekens is de hoofdvestiging; handmatig blijft staan');
select is(
  (select count(*)::integer from public.school_jaargegevens where jaar in (2023, 2025)),
  0, 'geen aantal bij een onbekende telling of een jaar zonder werkjaar');
select is(
  (select count(*)::integer from public.school_jaargegevens where school_id = '00000000-0000-0000-0000-00000000b004'),
  0, 'een inactieve school krijgt niets');

select is(
  private.duo_tellingen_verwerken(
    '[{"INSTELLINGSCODE": "21NK", "VESTIGINGSCODE": "00", "TYPE_PO": "BO", "PEILJAAR": 2025, "AANTAL_LEERLINGEN": 298}]'),
  0, 'dezelfde telling nog een keer verandert niets');
select is(
  private.duo_tellingen_verwerken(
    '[{"INSTELLINGSCODE": "21NK", "VESTIGINGSCODE": "00", "TYPE_PO": "BO", "PEILJAAR": 2025, "AANTAL_LEERLINGEN": 300}]'),
  1, 'een correctie van DUO werkt een DUO-aantal bij');

-- Met de hand opslaan -----------------------------------------------------------
select tests.authenticate_as('teamleider@test.nl');
select lives_ok(
  $$ select public.school_jaargegevens_opslaan('00000000-0000-0000-0000-00000000b001', 2026::smallint, 300, 20, 'inclusief PSZ') $$,
  'teamleider: kan de correctie bij een DUO-aantal opslaan');
select is(
  (select van_duo from public.school_jaargegevens where school_id = '00000000-0000-0000-0000-00000000b001' and jaar = 2026),
  true, 'hetzelfde aantal opslaan houdt de markering DUO');
select lives_ok(
  $$ select public.school_jaargegevens_opslaan('00000000-0000-0000-0000-00000000b001', 2026::smallint, 310, 20, 'inclusief PSZ') $$,
  'teamleider: kan het aantal met de hand wijzigen');
select is(
  (select van_duo from public.school_jaargegevens where school_id = '00000000-0000-0000-0000-00000000b001' and jaar = 2026),
  false, 'een ander aantal opslaan haalt de markering DUO weg');
reset role;
select is(
  private.duo_tellingen_verwerken(
    '[{"INSTELLINGSCODE": "21NK", "VESTIGINGSCODE": "00", "TYPE_PO": "BO", "PEILJAAR": 2025, "AANTAL_LEERLINGEN": 305}]'),
  0, 'een met de hand gewijzigd aantal blijft staan');

-- Vestigingen en BRIN-voorstellen -----------------------------------------------
select throws_ok($$ select private.duo_vestigingen_verwerken('[]') $$, 'P0001', null,
  'een lege lijst vestigingen wordt geweigerd');
select is(
  private.duo_vestigingen_verwerken($$[
    {"VESTIGINGSCODE": "99ZZ00", "VESTIGINGSNAAM": "De Triangel", "STRAATNAAM": "Dorpsstraat",
     "HUISNUMMER-TOEVOEGING": "1", "POSTCODE": "8081AB", "PLAATSNAAM": "ELBURG", "GEMEENTENAAM": "ELBURG"},
    {"VESTIGINGSCODE": "21NK00", "VESTIGINGSNAAM": "Triangel", "POSTCODE": "8081AB", "PLAATSNAAM": "ELBURG"},
    {"VESTIGINGSCODE": "12AF00", "VESTIGINGSNAAM": "Het Octaaf", "POSTCODE": "8082XY", "PLAATSNAAM": "ELBURG"}
  ]$$::jsonb),
  3, 'vestigingen worden opgeslagen');

select tests.authenticate_as('teamleider@test.nl');
select is(
  (select vestigingscode || ' ' || adres from public.duo_brin_voorstellen()
    where school_id = '00000000-0000-0000-0000-00000000b005' order by score desc limit 1),
  '99ZZ00 Dorpsstraat 1', 'het beste voorstel past op naam, postcode en plaats');
select is(
  (select count(*)::integer from public.duo_brin_voorstellen() where vestigingscode = '21NK00'),
  0, 'een vestiging die al gekoppeld is, wordt niet voorgesteld');

select is(
  public.school_brin_koppelen($$[
    {"school_id": "00000000-0000-0000-0000-00000000b005", "brin": "99zz00"},
    {"school_id": "00000000-0000-0000-0000-00000000b001", "brin": "12AF00"}
  ]$$::jsonb),
  1, 'koppelt alleen scholen zonder BRIN');
select is(
  (select string_agg(naam || ' ' || brin, '; ' order by naam) from public.scholen
    where id in ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000b005')),
  'CBS De Triangel 99ZZ00; De Borchstee 21NK00', 'het BRIN wordt in hoofdletters vastgelegd');
reset role;

select * from finish();
rollback;
