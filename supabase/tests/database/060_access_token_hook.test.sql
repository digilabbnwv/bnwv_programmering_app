-- De Custom Access Token Hook. Supabase Auth roept hem aan als
-- supabase_auth_admin; die rol heeft alleen uitvoerrecht op de functie.
begin;
select plan(12);

select tests.create_user('admin@test.nl',     'beheerder');
select tests.create_user('med@test.nl',       'medewerker', p_must_change => true);
select tests.create_user('inactief@test.nl',  'medewerker', p_active => false);
select tests.create_user('zonderrol@test.nl', null);

create function pg_temp.hook(p_email text, p_method text, p_claims jsonb default '{}')
returns jsonb
language sql
as $$
  select public.custom_access_token_hook(jsonb_build_object(
    'user_id', tests.user_id(p_email),
    'authentication_method', p_method,
    'claims', jsonb_build_object('sub', tests.user_id(p_email), 'aal', 'aal1', 'role', 'authenticated') || p_claims
  ))
$$;

select is(
  pg_temp.hook('admin@test.nl', 'password') -> 'claims' ->> 'user_role',
  'beheerder', 'de rol komt in de JWT');
select is(
  pg_temp.hook('admin@test.nl', 'password') -> 'claims' -> 'is_active',
  'true'::jsonb, 'is_active komt in de JWT');
select is(
  pg_temp.hook('admin@test.nl', 'password') -> 'claims' ->> 'aal',
  'aal1', 'bestaande claims blijven staan');
select is(
  pg_temp.hook('med@test.nl', 'totp',
    '{"user_role": "beheerder", "user_metadata": {"user_role": "beheerder"}}') -> 'claims' ->> 'user_role',
  'medewerker', 'een rol uit user_metadata of een meegestuurde claim wordt genegeerd');
select is(
  pg_temp.hook('med@test.nl', 'totp') -> 'claims' -> 'must_change_password',
  'true'::jsonb, 'must_change_password komt in de JWT');
select ok(
  (select r ? 'error' and not r ? 'claims' from pg_temp.hook('inactief@test.nl', 'password') r),
  'een gedeactiveerd account krijgt geen token');
select ok(
  (select r ? 'error' and not r ? 'claims' from pg_temp.hook('inactief@test.nl', 'token_refresh') r),
  'een gedeactiveerd account kan zijn token ook niet verversen');
select ok(
  pg_temp.hook('zonderrol@test.nl', 'password') ? 'error',
  'een account zonder rol krijgt geen token');

-- Logging: alleen echte inlogstappen, geen refresh.
select private.write_audit(null, 'test.start', null);
select pg_temp.hook('admin@test.nl', 'password');
select pg_temp.hook('admin@test.nl', 'totp');
select pg_temp.hook('admin@test.nl', 'token_refresh');

select is(
  (select array_agg(details ->> 'methode' order by id) from public.audit_log
    where action = 'auth.ingelogd' and actor_id = tests.user_id('admin@test.nl')
      and id > (select max(id) from public.audit_log where action = 'test.start')),
  array['password', 'totp'], 'inloggen met wachtwoord en met 2FA wordt gelogd, een refresh niet');

select ok(
  has_function_privilege('supabase_auth_admin', 'public.custom_access_token_hook(jsonb)', 'execute'),
  'Supabase Auth kan de hook uitvoeren');
select ok(
  not has_table_privilege('supabase_auth_admin', 'public.audit_log', 'insert')
  and not has_table_privilege('supabase_auth_admin', 'public.user_roles', 'select'),
  'Supabase Auth heeft verder geen rechten op onze tabellen');
select ok(
  not has_function_privilege('anon', 'public.custom_access_token_hook(jsonb)', 'execute')
  and not has_function_privilege('service_role', 'public.custom_access_token_hook(jsonb)', 'execute'),
  'anon en de service role kunnen de hook niet aanroepen');

select * from finish();
rollback;
