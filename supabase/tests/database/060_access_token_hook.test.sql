-- De Custom Access Token Hook, uitgevoerd als supabase_auth_admin (de rol
-- waarmee Supabase Auth de hook aanroept).
begin;
select plan(10);

select tests.create_user('admin@test.nl',    'beheerder');
select tests.create_user('med@test.nl',      'medewerker', p_must_change => true);
select tests.create_user('inactief@test.nl', 'medewerker', p_active => false);
select tests.create_user('zonderrol@test.nl', null);

create function pg_temp.event(p_email text, p_method text, p_claims jsonb default '{}')
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'user_id', tests.user_id(p_email),
    'authentication_method', p_method,
    'claims', jsonb_build_object('sub', tests.user_id(p_email), 'aal', 'aal1', 'role', 'authenticated') || p_claims
  )
$$;

-- De events vooraf opbouwen; supabase_auth_admin mag tests.* niet lezen.
create temp table events as
select 'admin'      as naam, pg_temp.event('admin@test.nl', 'password')                as event
union all select 'med_vals',  pg_temp.event('med@test.nl', 'totp',
                                 '{"user_role": "beheerder", "user_metadata": {"user_role": "beheerder"}}')
union all select 'refresh',   pg_temp.event('admin@test.nl', 'token_refresh')
union all select 'inactief',  pg_temp.event('inactief@test.nl', 'password')
union all select 'zonderrol', pg_temp.event('zonderrol@test.nl', 'password');
create temp table resultaten (naam text, resultaat jsonb);
grant select on events to supabase_auth_admin;
grant insert on resultaten to supabase_auth_admin;

set local role supabase_auth_admin;
insert into resultaten
select naam, public.custom_access_token_hook(event) from events;

-- Mag Supabase Auth ook andere regels in de auditlog schrijven? (moet niet)
do $$
begin
  insert into public.audit_log (action) values ('gebruiker.rol_gewijzigd');
  insert into resultaten values ('vals_log', '"gelukt"');
exception when insufficient_privilege then
  insert into resultaten values ('vals_log', '"geweigerd"');
end;
$$;
reset role;

select is(
  (select resultaat -> 'claims' ->> 'user_role' from resultaten where naam = 'admin'),
  'beheerder', 'de rol komt in de JWT');
select is(
  (select resultaat -> 'claims' -> 'is_active' from resultaten where naam = 'admin'),
  'true'::jsonb, 'is_active komt in de JWT');
select is(
  (select resultaat -> 'claims' ->> 'aal' from resultaten where naam = 'admin'),
  'aal1', 'bestaande claims blijven staan');
select is(
  (select resultaat -> 'claims' ->> 'user_role' from resultaten where naam = 'med_vals'),
  'medewerker', 'een rol uit user_metadata of een meegestuurde claim wordt genegeerd');
select is(
  (select resultaat -> 'claims' -> 'must_change_password' from resultaten where naam = 'med_vals'),
  'true'::jsonb, 'must_change_password komt in de JWT');
select ok(
  (select resultaat ? 'error' and not resultaat ? 'claims' from resultaten where naam = 'inactief'),
  'een gedeactiveerd account krijgt geen token');
select ok(
  (select resultaat ? 'error' from resultaten where naam = 'zonderrol'),
  'een account zonder rol krijgt geen token');

select is(
  (select count(*) from public.audit_log where action = 'auth.ingelogd'),
  2::bigint, 'inloggen met wachtwoord en met 2FA wordt gelogd, een refresh niet');
select is(
  (select details ->> 'methode' from public.audit_log
    where action = 'auth.ingelogd' and actor_id = tests.user_id('med@test.nl')),
  'totp', 'de inlogmethode staat in de auditlog');

select is(
  (select resultaat from resultaten where naam = 'vals_log'),
  '"geweigerd"'::jsonb, 'Supabase Auth kan alleen inlogregels schrijven');

select * from finish();
rollback;
