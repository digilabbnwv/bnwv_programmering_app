-- Algemene regels die voor elke tabel en functie moeten gelden. Deze tests
-- falen ook voor tabellen die later worden toegevoegd.
begin;
select plan(9);

select is(
  (select array_agg(tablename::text order by tablename)
     from pg_tables
    where schemaname = 'public' and not rowsecurity),
  null,
  'RLS staat aan op elke tabel in public'
);

select is(
  (select array_agg(distinct table_name::text)
     from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon'),
  null,
  'anon heeft op geen enkele tabel rechten'
);

select is(
  (select array_agg(distinct table_name || ':' || privilege_type)
     from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee = 'authenticated'
      and privilege_type <> 'SELECT'),
  null,
  'authenticated mag in public alleen lezen'
);

select is(
  (select array_agg(p.proname::text order by p.proname)
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'execute')),
  null,
  'anon kan geen enkele functie in public uitvoeren'
);

select is(
  (select array_agg(p.proname::text order by p.proname)
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('authenticated', p.oid, 'execute')),
  array['contract_opslaan', 'deelnemer_opslaan', 'extra_uren_opslaan', 'list_users',
        'medewerker_opslaan', 'programma_opslaan', 'programma_overdragen',
        'programma_uitvoerder_opslaan', 'projectgroep_opslaan',
        'school_jaargegevens_opslaan', 'school_opslaan', 'school_toewijzen',
        'staffel_schijf_opslaan', 'taak_opslaan', 'taak_overdragen', 'toelichting_opslaan',
        'toewijzing_wijzigen', 'uitvoerder_opslaan', 'werkbelasting_heropenen', 'werkbelasting_vaststellen', 'werkbelasting_verwijderen',
        'werkjaar_opslaan'],
  'authenticated kan in public alleen list_users en de werkbelastingfuncties uitvoeren'
);

select is(
  (select array_agg(p.proname::text order by p.proname)
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and has_function_privilege('authenticated', p.oid, 'execute')),
  array['authorize', 'eigen_medewerker_id', 'is_aal2', 'session_is_valid'],
  'authenticated kan in private alleen de autorisatiecontroles uitvoeren'
);

select ok(
  not has_function_privilege('authenticated', 'public.custom_access_token_hook(jsonb)', 'execute')
  and has_function_privilege('supabase_auth_admin', 'public.custom_access_token_hook(jsonb)', 'execute'),
  'alleen Supabase Auth kan de access token hook uitvoeren'
);

select ok(
  has_function_privilege('service_role', 'public.admin_set_role(uuid, uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.admin_set_role(uuid, uuid, text)', 'execute'),
  'beheerfuncties zijn alleen voor de service role'
);

select results_eq(
  $$ select role_id, array_agg(permission_id::text order by permission_id)
       from public.role_permissions group by role_id order by role_id $$,
  $$ values
       ('alleen-lezen', array['app.gebruiken']),
       ('beheerder',    array['app.gebruiken', 'auditlog.lezen', 'gebruikers.beheren', 'gebruikers.bekijken',
                              'werkbelasting.beheren', 'werkbelasting.bekijken']),
       ('medewerker',   array['app.gebruiken']),
       ('teamleider',   array['app.gebruiken', 'gebruikers.bekijken',
                              'werkbelasting.beheren', 'werkbelasting.bekijken']) $$,
  'rechten per rol zoals afgesproken'
);

select * from finish();
rollback;
