-- Leerlingaantallen overnemen naar een nieuw jaar: alleen actieve scholen,
-- bestaande gegevens blijven staan, markering 'overgenomen'.
begin;
select plan(9);

select tests.create_user('teamleider@test.nl', 'teamleider');
select tests.create_user('medewerker@test.nl', 'medewerker');

insert into public.werkjaren (jaar) values (2026), (2027);
insert into public.scholen (id, naam, soort, programma_id, actief)
select v.id::uuid, v.naam, 'PO', (select id from public.programmas where naam = 'dBos'), v.actief
  from (values ('00000000-0000-0000-0000-00000000a001', 'De Brug',  true),
               ('00000000-0000-0000-0000-00000000a002', 'Da Costa', true),
               ('00000000-0000-0000-0000-00000000a003', 'Dicht',    false)) v (id, naam, actief);
insert into public.school_jaargegevens (school_id, jaar, leerlingaantal, uren_correctie, correctie_reden) values
  ('00000000-0000-0000-0000-00000000a001', 2026, 320, 20, 'inclusief PSZ'),
  ('00000000-0000-0000-0000-00000000a002', 2026, 180, 0, ''),
  ('00000000-0000-0000-0000-00000000a003', 2026, 90, 0, ''),
  -- Da Costa heeft voor 2027 al een aantal.
  ('00000000-0000-0000-0000-00000000a002', 2027, 200, 0, '');

select tests.authenticate_as('medewerker@test.nl');
select throws_ok(
  $$ select public.school_jaargegevens_overnemen(2026::smallint, 2027::smallint, true) $$,
  '42501', null, 'medewerker: kan geen leerlingaantallen overnemen');
reset role;

select tests.authenticate_as('teamleider@test.nl');
select throws_ok(
  $$ select public.school_jaargegevens_overnemen(2026::smallint, 2028::smallint, true) $$,
  '23503', null, 'het doeljaar moet bestaan');
select is(
  public.school_jaargegevens_overnemen(2026::smallint, 2027::smallint, true), 1,
  'neemt alleen actieve scholen zonder gegevens over');
select is(
  (select string_agg(s.naam || ' ' || j.leerlingaantal || ' ' || j.uren_correctie || ' ' || j.overgenomen, '; ' order by s.naam)
     from public.school_jaargegevens j join public.scholen s on s.id = j.school_id where j.jaar = 2027),
  'Da Costa 200 0.0 false; De Brug 320 20.0 true',
  'bestaande gegevens blijven staan; de overgenomen rij krijgt aantal, correctie en markering');
select is(
  public.school_jaargegevens_overnemen(2026::smallint, 2027::smallint, true), 0,
  'nog een keer overnemen verandert niets');

select lives_ok(
  $$ select public.school_jaargegevens_opslaan('00000000-0000-0000-0000-00000000a001', 2027::smallint, 330, 20, 'inclusief PSZ') $$,
  'teamleider: kan het overgenomen aantal bijwerken');
select is(
  (select overgenomen from public.school_jaargegevens
    where school_id = '00000000-0000-0000-0000-00000000a001' and jaar = 2027),
  false, 'met de hand opslaan haalt de markering weg');

-- Zonder correctie: eerst de rij van De Brug weer weghalen (als eigenaar).
reset role;
delete from public.school_jaargegevens where school_id = '00000000-0000-0000-0000-00000000a001' and jaar = 2027;
select tests.authenticate_as('teamleider@test.nl');
select is(
  public.school_jaargegevens_overnemen(2026::smallint, 2027::smallint, false), 1,
  'neemt zonder correctie opnieuw over');
select is(
  (select uren_correctie || ' ' || correctie_reden || '|' from public.school_jaargegevens
    where school_id = '00000000-0000-0000-0000-00000000a001' and jaar = 2027),
  '0.0 |', 'zonder correctie wordt de urencorrectie 0, zonder reden');
reset role;

select * from finish();
rollback;
