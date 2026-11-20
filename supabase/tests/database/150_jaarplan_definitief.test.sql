-- Jaarplan definitief maken: projectgroepen voor akkoord projecten (nieuw of
-- gekoppeld), momentopname, terug naar concept en later nog een projectgroep.
begin;
select plan(19);

select tests.create_user('mt@test.nl',         'mt');
select tests.create_user('teamleider@test.nl', 'teamleider');

insert into public.jaarplannen (jaar, fase) values (2027, 'concept');
insert into public.projecten (id, naam, omschrijving, afdeling_id, startdatum, einddatum)
select v.id::uuid, v.naam, 'Doel', a.id, '2027-03-01', '2027-11-30'
  from (values
    ('00000000-0000-0000-0000-00000000f001', 'Kinderboekenweek'),
    ('00000000-0000-0000-0000-00000000f002', 'Dikke Pil'),
    ('00000000-0000-0000-0000-00000000f003', 'Podcast'),
    ('00000000-0000-0000-0000-00000000f004', 'Leescollege')
  ) as v (id, naam)
  cross join public.afdelingen a where a.afkorting = 'PROG';
insert into public.projectjaren (id, project_id, jaar, status, budget) values
  ('00000000-0000-0000-0000-00000000f101', '00000000-0000-0000-0000-00000000f001', 2027, 'akkoord', 2500),
  ('00000000-0000-0000-0000-00000000f102', '00000000-0000-0000-0000-00000000f002', 2027, 'akkoord', null),
  ('00000000-0000-0000-0000-00000000f103', '00000000-0000-0000-0000-00000000f003', 2027, 'ingediend', 500),
  ('00000000-0000-0000-0000-00000000f104', '00000000-0000-0000-0000-00000000f004', 2027, 'afgewezen', null);
insert into public.projectjaar_inzet (projectjaar_id, functie_id, fase, uren, startdatum, einddatum)
select '00000000-0000-0000-0000-00000000f101', id, 'uitvoering', 60, '2027-10-04', '2027-10-10'
  from public.functies where afkorting = 'LMC';
-- Een projectgroep die een teamleider al had aangemaakt.
insert into public.projectgroepen (id, naam, startdatum) values
  ('00000000-0000-0000-0000-00000000c001', 'Dikke Pil 2027', '2027-01-01');

-- ---------------------------------------------------------------------------
-- teamleider: mag niet
-- ---------------------------------------------------------------------------
select tests.authenticate_as('teamleider@test.nl');
select throws_ok(
  $$ select public.jaarplan_definitief(2027::smallint, '[]'::jsonb) $$,
  '42501', null, 'teamleider: kan het jaarplan niet definitief maken');
select throws_ok(
  $$ select public.project_naar_projectgroep('00000000-0000-0000-0000-00000000f001', null) $$,
  '42501', null, 'teamleider: kan geen projectgroep voor een project maken');
reset role;

-- ---------------------------------------------------------------------------
-- mt: definitief maken
-- ---------------------------------------------------------------------------
select tests.authenticate_as('mt@test.nl');
select throws_ok(
  $$ select public.jaarplan_definitief(2027::smallint,
       '[{"project_id": "00000000-0000-0000-0000-00000000f002", "projectgroep_id": "00000000-0000-0000-0000-00000000c999"}]'::jsonb) $$,
  'P0002', null, 'koppelen aan een projectgroep die niet bestaat kan niet');
select is((select fase from public.jaarplannen where jaar = 2027), 'concept', 'na een fout blijft het jaarplan concept');

select is(
  public.jaarplan_definitief(2027::smallint,
    '[{"project_id": "00000000-0000-0000-0000-00000000f002", "projectgroep_id": "00000000-0000-0000-0000-00000000c001"}]'::jsonb),
  1, 'mt: definitief maken; één nieuwe projectgroep, één gekoppeld');
select is((select fase from public.jaarplannen where jaar = 2027), 'definitief', 'het jaarplan is definitief');
select ok((select vastgesteld_op is not null and vastgesteld_door_naam = 'mt@test.nl' from public.jaarplannen where jaar = 2027),
  'vastgesteld op en door staan vast');
select is(
  (select string_agg(g.naam || ' ' || g.startdatum || ' ' || coalesce(g.einddatum::text, '-'), '; ' order by g.naam)
     from public.projectgroepen g where g.project_id is not null),
  'Dikke Pil 2027 2027-01-01 -; Kinderboekenweek 2027-03-01 2027-11-30',
  'nieuwe projectgroep met naam en looptijd van het project; de bestaande gekoppeld en ongewijzigd');
select is((select omschrijving from public.projectgroepen where project_id = '00000000-0000-0000-0000-00000000f001'), 'Doel',
  'de omschrijving gaat mee');
select is((select count(*) from public.projectgroepen where project_id in (
    '00000000-0000-0000-0000-00000000f003', '00000000-0000-0000-0000-00000000f004')), 0::bigint,
  'ingediende en afgewezen projecten krijgen geen projectgroep');
select is(
  (select jsonb_array_length(momentopname) from public.jaarplannen where jaar = 2027), 4,
  'de momentopname bevat alle projecten van het jaar');
select is(
  (select e -> 'inzet' -> 0 ->> 'uren'
     from public.jaarplannen, jsonb_array_elements(momentopname) e
    where jaar = 2027 and e ->> 'naam' = 'Kinderboekenweek'),
  '60.0', 'de momentopname bevat de inzet');
select throws_ok(
  $$ select public.jaarplan_definitief(2027::smallint, '[]'::jsonb) $$,
  'P0002', null, 'een definitief jaarplan kan niet nog eens definitief worden');

-- Later akkoord: een projectgroep via de knop.
select throws_ok(
  $$ select public.project_naar_projectgroep('00000000-0000-0000-0000-00000000f003', null) $$,
  '23514', null, 'een project dat niet akkoord is, krijgt geen projectgroep');
select lives_ok(
  $$ select public.projectjaar_opslaan('00000000-0000-0000-0000-00000000f103', '00000000-0000-0000-0000-00000000f003',
       2027::smallint, 'akkoord', 500, '') $$,
  'mt: kan na het vaststellen nog wijzigen');
select lives_ok(
  $$ select public.project_naar_projectgroep('00000000-0000-0000-0000-00000000f003', null) $$,
  'mt: maakt een projectgroep voor een project dat later akkoord is');
select is(
  public.project_naar_projectgroep('00000000-0000-0000-0000-00000000f003', null),
  (select id from public.projectgroepen where project_id = '00000000-0000-0000-0000-00000000f003'),
  'nog eens aanmaken geeft de bestaande projectgroep terug');

-- Terug naar concept.
select lives_ok($$ select public.jaarplan_heropenen(2027::smallint) $$, 'mt: kan terug naar concept');
select is(
  (select fase || ' ' || (momentopname is null)::text || ' ' || (select count(*) from public.projectgroepen where project_id is not null)
     from public.jaarplannen where jaar = 2027),
  'concept true 3', 'terug naar concept: momentopname weg, projectgroepen blijven');
reset role;

select * from finish();
rollback;
