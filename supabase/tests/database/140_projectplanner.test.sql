-- Projectplanner: zichtbaarheid, beheren met projectplan.beheren, controles op
-- looptijd en jaar, fases van het jaarplan en de import.
begin;
select plan(33);

select tests.create_user('mt@test.nl',         'mt');
select tests.create_user('teamleider@test.nl', 'teamleider');
select tests.create_user('medewerker@test.nl', 'medewerker');

insert into public.jaarplannen (jaar, fase) values (2027, 'concept');
insert into public.projecten (id, naam, afdeling_id, tak_id, startdatum, einddatum)
select '00000000-0000-0000-0000-00000000f001', 'Kinderboekenweek', a.id, t.id, '2027-04-01', '2027-10-31'
  from public.afdelingen a join public.takken t on t.afdeling_id = a.id
 where a.afkorting = 'PROG' and t.naam = 'Doorgaande leeslijn';
insert into public.projectjaren (id, project_id, jaar) values
  ('00000000-0000-0000-0000-00000000f101', '00000000-0000-0000-0000-00000000f001', 2027);

-- ---------------------------------------------------------------------------
-- medewerker: ziet niets en wijzigt niets
-- ---------------------------------------------------------------------------
select tests.authenticate_as('medewerker@test.nl');
select is((select count(*) from public.jaarplannen),  0::bigint, 'medewerker: ziet geen jaarplannen');
select is((select count(*) from public.projecten),    0::bigint, 'medewerker: ziet geen projecten');
select is((select count(*) from public.projectjaren), 0::bigint, 'medewerker: ziet geen projectjaren');
select throws_ok(
  $$ select public.jaarplan_opslaan(2028::smallint, 'concept', false) $$,
  '42501', null, 'medewerker: kan geen jaarplan aanmaken');
reset role;

-- ---------------------------------------------------------------------------
-- teamleider: leest wel, wijzigt niet
-- ---------------------------------------------------------------------------
select tests.authenticate_as('teamleider@test.nl');
select is((select count(*) from public.projecten),    1::bigint, 'teamleider: ziet de projecten');
select is((select count(*) from public.projectjaren), 1::bigint, 'teamleider: ziet de projectjaren');
select throws_ok(
  $$ select public.projectjaar_opslaan('00000000-0000-0000-0000-00000000f101', '00000000-0000-0000-0000-00000000f001',
       2027::smallint, 'akkoord', 1000, '') $$,
  '42501', null, 'teamleider: kan de status niet zetten');
select throws_ok(
  $$ insert into public.jaarplannen (jaar) values (2029) $$,
  '42501', null, 'teamleider: kan niet direct in tabellen schrijven');
reset role;

-- ---------------------------------------------------------------------------
-- mt: beheert
-- ---------------------------------------------------------------------------
select tests.authenticate_as('mt@test.nl');

select lives_ok(
  $$ select public.jaarplan_opslaan(2028::smallint, 'wensen', false) $$,
  'mt: kan een jaarplan aanmaken');
select throws_ok(
  $$ select public.jaarplan_opslaan(2028::smallint, 'definitief', false) $$,
  '23514', null, 'definitief maken kan (nog) niet via jaarplan_opslaan');

select lives_ok(
  $$ select public.projectjaar_opslaan('00000000-0000-0000-0000-00000000f101', '00000000-0000-0000-0000-00000000f001',
       2027::smallint, 'akkoord', 2500, 'Zoals vorig jaar') $$,
  'mt: kan status en budget zetten');
select is(
  (select status || ' ' || budget from public.projectjaren where id = '00000000-0000-0000-0000-00000000f101'),
  'akkoord 2500.00', 'status en budget zijn opgeslagen');

select lives_ok(
  $$ select public.inzet_opslaan(null, '00000000-0000-0000-0000-00000000f101',
       (select id from public.functies where afkorting = 'LMC'), 'uitvoering', 3::smallint, 60, '2027-09-27', '2027-10-10') $$,
  'mt: kan inzet toevoegen');
select throws_ok(
  $$ select public.inzet_opslaan(null, '00000000-0000-0000-0000-00000000f101',
       (select id from public.functies where afkorting = 'LMC'), 'voorbereiding', 1::smallint, 20, '2027-03-01', '2027-05-01') $$,
  '23514', null, 'inzet vóór de start van het project kan niet');
select throws_ok(
  $$ select public.inzet_opslaan(null, '00000000-0000-0000-0000-00000000f101',
       (select id from public.functies where afkorting = 'LMC'), 'uitvoering', 0::smallint, 20, '2027-09-01', '2027-09-30') $$,
  '23514', null, 'minstens één collega');
select throws_ok(
  $$ select public.inzet_opslaan(null, '00000000-0000-0000-0000-00000000f101',
       (select id from public.functies where afkorting = 'LMC'), 'nazorg', 1::smallint, 20, '2027-09-01', '2027-09-30') $$,
  '23514', null, 'alleen voorbereiding of uitvoering');

select throws_ok(
  $$ select public.project_opslaan('00000000-0000-0000-0000-00000000f001', 'Kinderboekenweek', '',
       (select id from public.afdelingen where afkorting = 'PROG'), null, null, null, '2027-04-01', '2027-09-30', null) $$,
  '23514', null, 'de looptijd inkorten tot vóór de inzet kan niet');
select throws_ok(
  $$ select public.project_opslaan('00000000-0000-0000-0000-00000000f001', 'Kinderboekenweek', '',
       (select id from public.afdelingen where afkorting = 'LDV'),
       (select id from public.takken where naam = 'Doorgaande leeslijn'), null, null, '2027-04-01', '2027-10-31', null) $$,
  '23503', null, 'een tak hoort bij de afdeling van het project');

select lives_ok(
  $$ select public.project_opslaan(null, 'Dikke Pil', '', (select id from public.afdelingen where afkorting = 'PROG'),
       null, null, null, '2027-01-01', '2027-12-31', 2027::smallint) $$,
  'mt: kan een project aanmaken, direct in het jaarplan');
select is(
  (select j.status from public.projectjaren j join public.projecten p on p.id = j.project_id
    where p.naam = 'Dikke Pil' and j.jaar = 2027),
  'ingediend', 'een nieuw project staat als ingediend in het jaarplan');

-- Een project over de jaargrens: een tweede projectjaar in 2028.
select lives_ok(
  $$ select public.project_opslaan('00000000-0000-0000-0000-00000000f001', 'Kinderboekenweek', '',
       (select id from public.afdelingen where afkorting = 'PROG'), null, null, null, '2027-04-01', '2028-03-31', null) $$,
  'mt: kan de looptijd verlengen');
select lives_ok(
  $$ select public.projectjaar_opslaan(null, '00000000-0000-0000-0000-00000000f001', 2028::smallint, 'ingediend', null, '') $$,
  'mt: kan het project ook in het volgende jaarplan zetten');
select throws_ok(
  $$ select public.projectjaar_opslaan(null, '00000000-0000-0000-0000-00000000f001', 2028::smallint, 'ingediend', null, '') $$,
  '23505', null, 'een project staat maar één keer in een jaarplan');
select lives_ok(
  $$ select public.jaarplan_opslaan(2029::smallint, 'concept', false) $$,
  'mt: kan nog een jaarplan aanmaken');
select throws_ok(
  $$ select public.projectjaar_opslaan(null, '00000000-0000-0000-0000-00000000f001', 2029::smallint, 'ingediend', null, '') $$,
  '23514', null, 'een jaar buiten de looptijd kan niet');

select throws_ok(
  $$ select public.jaarplan_verwijderen(2028::smallint) $$,
  '23503', null, 'een jaarplan met projecten kan niet weg');

-- Import in een leeg jaarplan.
select lives_ok(
  $$ select public.jaarplan_opslaan(2030::smallint, 'concept', true) $$,
  'mt: kan een proefjaar aanmaken');
select is(
  public.jaarplan_importeren(2030::smallint, $j$[
    {"naam": "Vrijwilligersuitje", "afdeling": "STAF", "tak": "HR", "startdatum": "2030-02-01", "einddatum": "2030-10-31",
     "budget": 1500, "toelichting": "Excel: inzet van LDV en PROG"},
    {"naam": "Onbekende tak", "afdeling": "LDV", "tak": "Bestaat niet", "programma": "dBos",
     "startdatum": "2030-01-01", "einddatum": "2030-12-31"}
  ]$j$::jsonb),
  2, 'mt: importeert twee projecten');
select is(
  (select string_agg(p.naam || ' ' || coalesce(t.naam, '-') || ' ' || coalesce(g.naam, '-') || ' ' || j.status
                     || ' ' || coalesce(j.budget::text, '-'), '; ' order by p.naam)
     from public.projecten p
     join public.projectjaren j on j.project_id = p.id and j.jaar = 2030
     left join public.takken t on t.id = p.tak_id
     left join public.programmas g on g.id = p.programma_id),
  'Onbekende tak - dBos ingediend -; Vrijwilligersuitje HR - ingediend 1500.00',
  'de import zoekt tak en programma op, neemt het budget over en zet de status op ingediend');
select throws_ok(
  $$ select public.jaarplan_importeren(2030::smallint, '[]'::jsonb) $$,
  '23505', null, 'importeren kan maar één keer per jaarplan');
select throws_ok(
  $$ select public.jaarplan_importeren(2028::smallint, '[]'::jsonb) $$,
  '23505', null, 'importeren in een jaarplan met projecten kan niet');

select lives_ok(
  $$ select public.projectplan_verwijderen('projecten', '00000000-0000-0000-0000-00000000f001') $$,
  'mt: kan een project verwijderen, met zijn jaren en inzet');
reset role;

select is(
  (select count(*) from public.audit_log
    where action = 'projectplan.projectjaren.update' and actor_id = tests.user_id('mt@test.nl')),
  1::bigint, 'wijzigingen aan de projectplanner staan in de auditlog');

select * from finish();
rollback;
