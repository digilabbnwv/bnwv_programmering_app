-- Soorten programma's: scholen óf uitvoerders, zichtbaarheid van de
-- uitvoering, beheren en overdragen.
begin;
select plan(16);

select tests.create_user('teamleider@test.nl', 'teamleider');
select tests.create_user('medewerker@test.nl', 'medewerker');
select tests.create_user('collega@test.nl',    'medewerker');

insert into public.medewerkers (id, naam, user_id) values
  ('00000000-0000-0000-0000-00000000b001', 'Medewerker', tests.user_id('medewerker@test.nl')),
  ('00000000-0000-0000-0000-00000000b002', 'Collega',    tests.user_id('collega@test.nl'));
insert into public.programmas (id, naam, type) values
  ('00000000-0000-0000-0000-00000000f001', 'Digilabs', 'uitvoerders'),
  ('00000000-0000-0000-0000-00000000f002', 'Leeg',     'scholen');
insert into public.programma_uitvoerders (id, programma_id, medewerker_id, uren_per_jaar, startdatum) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000b001', 200, '2026-01-01'),
  ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000b002', 100, '2026-01-01');

select is((select type from public.programmas where naam = 'dBos'), 'scholen', 'bestaande programma''s werken met scholen');

-- ---------------------------------------------------------------------------
-- medewerker
-- ---------------------------------------------------------------------------
select tests.authenticate_as('medewerker@test.nl');
select is((select count(*) from public.programma_uitvoerders), 1::bigint, 'medewerker: ziet alleen de eigen programma-uitvoering');
select throws_ok(
  $$ select public.programma_uitvoerder_opslaan(null, '00000000-0000-0000-0000-00000000f001',
       '00000000-0000-0000-0000-00000000b001', 5, '2027-01-01', null) $$,
  '42501', null, 'medewerker: kan geen uitvoerder toevoegen');
select throws_ok(
  $$ select public.programma_overdragen('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000b002', '2026-07-01') $$,
  '42501', null, 'medewerker: kan programma-uitvoering niet overdragen');
reset role;

-- ---------------------------------------------------------------------------
-- teamleider
-- ---------------------------------------------------------------------------
select tests.authenticate_as('teamleider@test.nl');
select is((select count(*) from public.programma_uitvoerders), 2::bigint, 'teamleider: ziet alle uitvoerders');

select lives_ok(
  $$ select public.programma_opslaan(null, 'Makers', '', 'uitvoerders') $$,
  'teamleider: kan een programma met uitvoerders aanmaken');
select throws_ok(
  $$ select public.programma_opslaan(null, 'Fout', '', 'anders') $$,
  '23514', null, 'alleen de types scholen en uitvoerders');

select throws_ok(
  $$ select public.school_opslaan(null, 'Petraschool', 'PO', '00000000-0000-0000-0000-00000000f001', null, '',
       '', '', '', '', '', '', '', true) $$,
  '23503', null, 'een school kan niet onder een programma met uitvoerders vallen');
select throws_ok(
  $$ select public.school_opslaan(null, 'Petraschool', 'PO', null, null, '', '', '', '', '', '', '', '', true) $$,
  '23502', null, 'een school valt altijd onder een programma');
select throws_ok(
  $$ select public.programma_uitvoerder_opslaan(null, '00000000-0000-0000-0000-00000000f002',
       '00000000-0000-0000-0000-00000000b001', 5, '2026-01-01', null) $$,
  '23503', null, 'een programma met scholen heeft geen uitvoerders');

select throws_ok(
  $$ select public.programma_opslaan('00000000-0000-0000-0000-00000000f001', 'Digilabs', '', 'scholen') $$,
  '23503', null, 'het type wijzigt niet zolang er uitvoerders zijn');
select lives_ok(
  $$ select public.programma_opslaan('00000000-0000-0000-0000-00000000f002', 'Leeg', '', 'uitvoerders') $$,
  'het type wijzigt wel als er niets aan het programma hangt');

select throws_ok(
  $$ select public.programma_uitvoerder_opslaan(null, '00000000-0000-0000-0000-00000000f001',
       '00000000-0000-0000-0000-00000000b001', 5, '2026-03-01', null) $$,
  '23P01', null, 'een medewerker is niet twee keer tegelijk uitvoerder van hetzelfde programma');

-- Collega stopt halverwege; het deel van Medewerker gaat per 1 oktober naar Collega.
select lives_ok(
  $$ select public.programma_uitvoerder_opslaan('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-00000000f001',
       '00000000-0000-0000-0000-00000000b002', 100, '2026-01-01', '2026-06-30') $$,
  'teamleider: kan een uitvoerder laten stoppen');
select lives_ok(
  $$ select public.programma_overdragen('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000b002', '2026-10-01') $$,
  'teamleider: kan het deel van een uitvoerder overdragen');
select is(
  (select string_agg(m.naam || ' ' || u.startdatum || ' ' || coalesce(u.einddatum::text, 'lopend') || ' ' || u.uren_per_jaar, '; '
            order by u.startdatum, m.naam)
     from public.programma_uitvoerders u join public.medewerkers m on m.id = u.medewerker_id),
  'Collega 2026-01-01 2026-06-30 100.0; Medewerker 2026-01-01 2026-09-30 200.0; Collega 2026-10-01 lopend 200.0',
  'overdragen: de oude stopt de dag ervoor, de nieuwe neemt de uren over');
reset role;

select * from finish();
rollback;
