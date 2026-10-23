-- Werkbelasting: wie ziet wat, wie mag wijzigen, en de regels in de database
-- (geen overlap, school verplaatsen, auditlog).
begin;
select plan(37);

select tests.create_user('beheerder@test.nl',  'beheerder');
select tests.create_user('teamleider@test.nl', 'teamleider');
select tests.create_user('medewerker@test.nl', 'medewerker');
select tests.create_user('collega@test.nl',    'medewerker');
select tests.create_user('lezer@test.nl',      'alleen-lezen');

-- Testgegevens, als database-eigenaar.
insert into public.werkjaren (jaar) values (2026);
insert into public.scholen (id, naam, soort) values
  ('00000000-0000-0000-0000-00000000a001', 'De Brug', 'PO'),
  ('00000000-0000-0000-0000-00000000a002', 'Da Costa', 'PO');
insert into public.medewerkers (id, naam, user_id) values
  ('00000000-0000-0000-0000-00000000b001', 'Medewerker', tests.user_id('medewerker@test.nl')),
  ('00000000-0000-0000-0000-00000000b002', 'Collega',    tests.user_id('collega@test.nl'));
insert into public.contracten (medewerker_id, ingangsdatum, uren_per_week) values
  ('00000000-0000-0000-0000-00000000b001', '2026-01-01', 32),
  ('00000000-0000-0000-0000-00000000b002', '2026-01-01', 24);
insert into public.school_toewijzingen (school_id, medewerker_id, startdatum) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000b001', '2026-01-01'),
  ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-00000000b002', '2026-01-01');
insert into public.projectgroepen (id, naam, startdatum) values
  ('00000000-0000-0000-0000-00000000c001', 'Open Boek', '2026-01-01');
insert into public.projectgroep_deelnemers (projectgroep_id, medewerker_id, uren_per_jaar, startdatum) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b001', 40, '2026-01-01'),
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b002', 10, '2026-01-01');
insert into public.extra_uren (medewerker_id, jaar, omschrijving, uren) values
  ('00000000-0000-0000-0000-00000000b002', 2026, 'NPO', 30);

-- ---------------------------------------------------------------------------
-- medewerker: eigen gegevens en algemene gegevens, niets wijzigen
-- ---------------------------------------------------------------------------
select tests.authenticate_as('medewerker@test.nl');

select is((select count(*) from public.scholen),                 2::bigint, 'medewerker: ziet alle scholen');
select is((select count(*) from public.projectgroepen),          1::bigint, 'medewerker: ziet de projectgroepen');
select is((select count(*) from public.werkjaren),               1::bigint, 'medewerker: ziet de werkjaren');
select is((select naam from public.medewerkers),                 'Medewerker', 'medewerker: ziet alleen zichzelf');
select is((select count(*) from public.contracten),              1::bigint, 'medewerker: ziet alleen het eigen contract');
select is((select count(*) from public.school_toewijzingen),     1::bigint, 'medewerker: ziet alleen de eigen scholen');
select is((select count(*) from public.projectgroep_deelnemers), 1::bigint, 'medewerker: ziet alleen de eigen deelnames');
select is((select count(*) from public.extra_uren),              0::bigint, 'medewerker: ziet geen extra uren van een ander');

select throws_ok($$ insert into public.scholen (naam, soort) values ('X', 'PO') $$, '42501', null,
  'medewerker: kan niet direct in tabellen schrijven');
select throws_ok(
  $$ select public.school_opslaan(null, 'X', 'PO', null, null, '', '', '', '', '', '', '', true) $$,
  '42501', null, 'medewerker: kan geen school opslaan');
select throws_ok(
  $$ select public.werkbelasting_verwijderen('scholen', '00000000-0000-0000-0000-00000000a001') $$,
  '42501', null, 'medewerker: kan niets verwijderen');
select throws_ok(
  $$ select public.medewerker_opslaan('00000000-0000-0000-0000-00000000b001', 'Ik', '', '', null, true, '') $$,
  '42501', null, 'medewerker: kan zichzelf niet wijzigen');
select throws_ok(
  $$ select public.werkbelasting_vaststellen('00000000-0000-0000-0000-00000000b001', 2026::smallint, '{}') $$,
  '42501', null, 'medewerker: kan de eigen werkbelasting niet vaststellen');
reset role;

-- Zonder 2FA niets.
select tests.authenticate_as('medewerker@test.nl', 'aal1');
select is((select count(*) from public.scholen),     0::bigint, 'AAL1: ziet geen scholen');
select is((select count(*) from public.medewerkers), 0::bigint, 'AAL1: ziet zichzelf niet');
reset role;

-- ---------------------------------------------------------------------------
-- alleen-lezen zonder gekoppelde medewerker
-- ---------------------------------------------------------------------------
select tests.authenticate_as('lezer@test.nl');
select is((select count(*) from public.scholen),             2::bigint, 'alleen-lezen: ziet de scholen');
select is((select count(*) from public.medewerkers),         0::bigint, 'alleen-lezen: ziet geen medewerkers');
select is((select count(*) from public.school_toewijzingen), 0::bigint, 'alleen-lezen: ziet geen toewijzingen');
reset role;

-- ---------------------------------------------------------------------------
-- teamleider: ziet en beheert alles
-- ---------------------------------------------------------------------------
select tests.authenticate_as('teamleider@test.nl');

select is((select count(*) from public.medewerkers), 2::bigint, 'teamleider: ziet alle medewerkers');
select is((select count(*) from public.extra_uren),  1::bigint, 'teamleider: ziet alle extra uren');

select lives_ok(
  $$ select public.school_opslaan(null, 'Petraschool', 'PO', null, '12ab', 'Straat 1', '8071 ab',
       'Nunspeet', '', 'Info@School.nl', '', '', true) $$,
  'teamleider: kan een school aanmaken');
select is((select brin || ' ' || postcode || ' ' || email from public.scholen where naam = 'Petraschool'),
  '12AB 8071 AB info@school.nl', 'school opslaan normaliseert BRIN, postcode en e-mail');

-- Da Costa per 1 oktober van Collega naar Medewerker.
select lives_ok(
  $$ select public.school_toewijzen('00000000-0000-0000-0000-00000000a002',
       '00000000-0000-0000-0000-00000000b001', '2026-10-01') $$,
  'teamleider: kan een school verplaatsen');
select is(
  (select einddatum from public.school_toewijzingen
    where school_id = '00000000-0000-0000-0000-00000000a002'
      and medewerker_id = '00000000-0000-0000-0000-00000000b002'),
  '2026-09-30'::date, 'verplaatsen: de vorige toewijzing eindigt de dag ervoor');
select is(
  (select count(*) from public.school_toewijzingen
    where medewerker_id = '00000000-0000-0000-0000-00000000b001' and einddatum is null),
  2::bigint, 'verplaatsen: de nieuwe medewerker heeft de school erbij');

select throws_ok(
  $$ insert into public.school_toewijzingen (school_id, medewerker_id, startdatum)
     values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000b002', '2026-03-01') $$,
  '42501', null, 'teamleider: kan ook niet direct in tabellen schrijven');
select throws_ok(
  $$ select public.toewijzing_wijzigen(
       (select id from public.school_toewijzingen
         where school_id = '00000000-0000-0000-0000-00000000a002' and einddatum is null),
       '2026-09-01', null) $$,
  '23P01', null, 'een school heeft nooit twee medewerkers tegelijk');

select lives_ok(
  $$ select public.staffel_schijf_opslaan(null, 2026::smallint, 'PO', 0, 199, 80) $$,
  'teamleider: kan een staffelschijf toevoegen');
select throws_ok(
  $$ select public.staffel_schijf_opslaan(null, 2026::smallint, 'PO', 150, 300, 100) $$,
  '23P01', null, 'staffelschijven overlappen niet');

select throws_ok(
  $$ select public.werkbelasting_verwijderen('audit_log', gen_random_uuid()) $$,
  '22023', null, 'verwijderen kan alleen in de werkbelastingtabellen');

select lives_ok(
  $$ select public.toelichting_opslaan('00000000-0000-0000-0000-00000000b001', 2026::smallint,
       'Da Costa per oktober overgenomen.') $$,
  'teamleider: kan een toelichting schrijven');
select lives_ok(
  $$ select public.werkbelasting_vaststellen('00000000-0000-0000-0000-00000000b001', 2026::smallint,
       '{"contracturen": 1504}') $$,
  'teamleider: kan de werkbelasting vaststellen');
select is(
  (select status || ' ' || (vastgesteld_door = auth.uid())::text || ' ' || (totalen ->> 'contracturen') || ' ' || toelichting
     from public.werkbelasting_toelichtingen where medewerker_id = '00000000-0000-0000-0000-00000000b001'),
  'vastgesteld true 1504 Da Costa per oktober overgenomen.',
  'vaststellen bewaart wie, de totalen en laat de toelichting staan');
select lives_ok(
  $$ select public.werkbelasting_heropenen('00000000-0000-0000-0000-00000000b001', 2026::smallint) $$,
  'teamleider: kan een vastgestelde werkbelasting heropenen');
select is(
  (select status || ' ' || coalesce(totalen::text, 'geen') || ' ' || coalesce(vastgesteld_op::text, 'geen')
     from public.werkbelasting_toelichtingen where medewerker_id = '00000000-0000-0000-0000-00000000b001'),
  'concept geen geen', 'heropenen wist de vaststelling');
select throws_ok(
  $$ select public.werkbelasting_heropenen('00000000-0000-0000-0000-00000000b002', 2026::smallint) $$,
  'P0002', null, 'heropenen zonder vaststelling geeft niet gevonden');
reset role;

select is(
  (select count(*) from public.audit_log
    where action in ('werkbelasting.scholen.insert', 'werkbelasting.school_toewijzingen.update',
                     'werkbelasting.werkbelasting_toelichtingen.insert')
      and actor_id = tests.user_id('teamleider@test.nl')),
  3::bigint, 'wijzigingen staan in de auditlog met de teamleider als actor');

select * from finish();
rollback;
