-- Overige taken: zichtbaarheid, beheren, overdragen en geen dubbele deelname.
begin;
select plan(14);

select tests.create_user('teamleider@test.nl', 'teamleider');
select tests.create_user('medewerker@test.nl', 'medewerker');
select tests.create_user('collega@test.nl',    'medewerker');

insert into public.medewerkers (id, naam, user_id) values
  ('00000000-0000-0000-0000-00000000b001', 'Medewerker', tests.user_id('medewerker@test.nl')),
  ('00000000-0000-0000-0000-00000000b002', 'Collega',    tests.user_id('collega@test.nl'));
insert into public.taken (id, naam, startdatum) values
  ('00000000-0000-0000-0000-00000000d001', 'BHV', '2026-01-01');
insert into public.taak_uitvoerders (id, taak_id, medewerker_id, uren_per_jaar, startdatum) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000b001', 20, '2026-01-01'),
  ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000b002', 10, '2026-01-01');

-- ---------------------------------------------------------------------------
-- medewerker
-- ---------------------------------------------------------------------------
select tests.authenticate_as('medewerker@test.nl');
select is((select count(*) from public.taken),            1::bigint, 'medewerker: ziet de taken');
select is((select count(*) from public.taak_uitvoerders), 1::bigint, 'medewerker: ziet alleen de eigen uitvoering');
select throws_ok(
  $$ select public.taak_opslaan(null, 'X', '', '2026-01-01', null) $$,
  '42501', null, 'medewerker: kan geen taak aanmaken');
select throws_ok(
  $$ select public.taak_overdragen('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000b002', '2026-07-01') $$,
  '42501', null, 'medewerker: kan een taak niet overdragen');
select throws_ok(
  $$ insert into public.taak_uitvoerders (taak_id, medewerker_id, uren_per_jaar, startdatum)
     values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000b001', 5, '2027-01-01') $$,
  '42501', null, 'medewerker: kan niet direct in tabellen schrijven');
reset role;

-- ---------------------------------------------------------------------------
-- teamleider
-- ---------------------------------------------------------------------------
select tests.authenticate_as('teamleider@test.nl');
select is((select count(*) from public.taak_uitvoerders), 2::bigint, 'teamleider: ziet alle uitvoerders');

select lives_ok(
  $$ select public.taak_opslaan(null, 'Coördinatie', 'Afstemming', '2026-01-01', null) $$,
  'teamleider: kan een taak aanmaken');

select throws_ok(
  $$ select public.uitvoerder_opslaan(null, '00000000-0000-0000-0000-00000000d001',
       '00000000-0000-0000-0000-00000000b001', 5, '2026-03-01', null) $$,
  '23P01', null, 'een medewerker voert dezelfde taak niet twee keer tegelijk uit');

-- Het deel van Medewerker per 1 juli naar Collega? Collega doet al mee: overlap.
select throws_ok(
  $$ select public.taak_overdragen('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000b002', '2026-07-01') $$,
  '23P01', null, 'overdragen aan iemand die al uitvoerder is geeft overlap');

-- Collega stopt; daarna kan Medewerker het deel van Collega niet overnemen,
-- maar Collega's deel kan wel naar een nieuwe collega.
select lives_ok(
  $$ select public.uitvoerder_opslaan('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-00000000d001',
       '00000000-0000-0000-0000-00000000b002', 10, '2026-01-01', '2026-06-30') $$,
  'teamleider: kan een uitvoerder laten stoppen');
select lives_ok(
  $$ select public.taak_overdragen('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000b002', '2026-10-01') $$,
  'teamleider: kan het deel van een uitvoerder overdragen');
select is(
  (select string_agg(m.naam || ' ' || u.startdatum || ' ' || coalesce(u.einddatum::text, 'lopend') || ' ' || u.uren_per_jaar, '; '
            order by u.startdatum, m.naam)
     from public.taak_uitvoerders u join public.medewerkers m on m.id = u.medewerker_id),
  'Collega 2026-01-01 2026-06-30 10.0; Medewerker 2026-01-01 2026-09-30 20.0; Collega 2026-10-01 lopend 20.0',
  'overdragen: de oude stopt de dag ervoor, de nieuwe neemt de uren over');
select throws_ok(
  $$ select public.taak_overdragen('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000b002', '2026-12-01') $$,
  '23514', null, 'overdragen na de einddatum kan niet');
reset role;

select is(
  (select count(*) from public.audit_log
    where action in ('werkbelasting.taken.insert', 'werkbelasting.taak_uitvoerders.update',
                     'werkbelasting.taak_uitvoerders.insert')
      and actor_id = tests.user_id('teamleider@test.nl')),
  4::bigint, 'wijzigingen aan taken staan in de auditlog');

select * from finish();
rollback;
