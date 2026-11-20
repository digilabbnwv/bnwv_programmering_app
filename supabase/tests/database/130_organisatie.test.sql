-- Organisatie: startgegevens, lezen, beheren met projectplan.beheren, de rol mt
-- en medewerkers met afdeling en functie.
begin;
select plan(24);

select tests.create_user('mt@test.nl',         'mt');
select tests.create_user('teamleider@test.nl', 'teamleider');
select tests.create_user('medewerker@test.nl', 'medewerker');

insert into public.medewerkers (id, naam, user_id) values
  ('00000000-0000-0000-0000-00000000b001', 'Medewerker', tests.user_id('medewerker@test.nl')),
  ('00000000-0000-0000-0000-00000000b002', 'Collega',    null);

-- ---------------------------------------------------------------------------
-- Startgegevens
-- ---------------------------------------------------------------------------
select is(
  (select string_agg(afkorting, ', ' order by volgorde) from public.afdelingen),
  'LDV, PROG, STAF', 'de drie afdelingen staan klaar');
select is((select count(*) from public.functies), 21::bigint, 'de functies uit de functiestructuur staan klaar');
select is(
  (select a.afkorting from public.functies f join public.afdelingen a on a.id = f.afdeling_id where f.afkorting = 'LMC'),
  'PROG', 'de leesmediacoach valt onder Programmering');
select is(
  (select string_agg(f.afkorting, ', ' order by f.afkorting) from public.functies f where f.afkorting <> ''),
  'BM, BV, CL, LMC', 'de afkortingen uit de projectplanner');
select is((select count(*) from public.takken), 15::bigint, 'de takken uit de projectplanner 2027 staan klaar');
select is((select id from public.roles where naam = 'MT'), 'mt', 'de rol MT bestaat');

-- ---------------------------------------------------------------------------
-- medewerker: lezen wel, wijzigen niet
-- ---------------------------------------------------------------------------
select tests.authenticate_as('medewerker@test.nl');
select is((select count(*) from public.afdelingen), 3::bigint,  'medewerker: ziet de afdelingen');
select is((select count(*) from public.functies),   21::bigint, 'medewerker: ziet de functies');
select is((select count(*) from public.takken),     15::bigint, 'medewerker: ziet de takken');
select throws_ok(
  $$ select public.functie_opslaan(null, 'Nieuw', '', (select id from public.afdelingen where afkorting = 'LDV'), false, true) $$,
  '42501', null, 'medewerker: kan geen functie aanmaken');
select throws_ok(
  $$ insert into public.takken (afdeling_id, naam) select id, 'X' from public.afdelingen where afkorting = 'LDV' $$,
  '42501', null, 'medewerker: kan niet direct in tabellen schrijven');
reset role;

-- ---------------------------------------------------------------------------
-- teamleider: deelt medewerkers in, beheert de lijsten niet
-- ---------------------------------------------------------------------------
select tests.authenticate_as('teamleider@test.nl');
select throws_ok(
  $$ select public.tak_opslaan(null, (select id from public.afdelingen where afkorting = 'PROG'), 'Nieuw', true) $$,
  '42501', null, 'teamleider: kan geen tak aanmaken');
select lives_ok(
  $$ select public.medewerker_opslaan('00000000-0000-0000-0000-00000000b002', 'Collega', '',
       (select id from public.afdelingen where afkorting = 'PROG'),
       (select id from public.functies where afkorting = 'LMC'), null, true, '') $$,
  'teamleider: kan een medewerker afdeling en functie geven');
select is(
  (select f.afkorting || ' ' || a.afkorting
     from public.medewerkers m
     join public.functies f on f.id = m.functie_id
     join public.afdelingen a on a.id = m.afdeling_id
    where m.id = '00000000-0000-0000-0000-00000000b002'),
  'LMC PROG', 'de medewerker heeft de gekozen afdeling en functie');
reset role;

-- ---------------------------------------------------------------------------
-- mt: beheert de lijsten en ziet alle medewerkers
-- ---------------------------------------------------------------------------
select tests.authenticate_as('mt@test.nl');
select is((select count(*) from public.medewerkers), 2::bigint, 'mt: ziet alle medewerkers');
select lives_ok(
  $$ select public.functie_opslaan(null, ' Mediacoach ', 'mc', (select id from public.afdelingen where afkorting = 'PROG'), false, true) $$,
  'mt: kan een functie aanmaken');
select is(
  (select naam || ' ' || afkorting from public.functies where naam = 'Mediacoach'),
  'Mediacoach MC', 'naam zonder spaties, afkorting in hoofdletters');
select throws_ok(
  $$ select public.functie_opslaan(null, 'Iets anders', 'lmc', (select id from public.afdelingen where afkorting = 'PROG'), false, true) $$,
  '23505', null, 'een afkorting komt maar één keer voor');
select lives_ok(
  $$ select public.tak_opslaan(null, (select id from public.afdelingen where afkorting = 'PROG'), 'Erfgoed', true) $$,
  'mt: kan een tak aanmaken');
select throws_ok(
  $$ select public.tak_opslaan(null, (select id from public.afdelingen where afkorting = 'PROG'), 'Digitaal', true) $$,
  '23505', null, 'een tak komt binnen een afdeling maar één keer voor');
select throws_ok(
  $$ select public.organisatie_verwijderen('functies', (select id from public.functies where afkorting = 'LMC')) $$,
  '23503', null, 'een functie die een medewerker heeft, kan niet weg');
select lives_ok(
  $$ select public.organisatie_verwijderen('functies', (select id from public.functies where naam = 'Mediacoach')) $$,
  'mt: kan een ongebruikte functie verwijderen');
select throws_ok(
  $$ select public.medewerker_opslaan('00000000-0000-0000-0000-00000000b002', 'Collega', '', null, null, null, true, '') $$,
  '42501', null, 'mt: beheert geen medewerkers');
reset role;

select is(
  (select count(*) from public.audit_log
    where action in ('organisatie.functies.insert', 'organisatie.functies.delete', 'organisatie.takken.insert')
      and actor_id = tests.user_id('mt@test.nl')),
  3::bigint, 'wijzigingen aan de organisatie staan in de auditlog');

select * from finish();
rollback;
