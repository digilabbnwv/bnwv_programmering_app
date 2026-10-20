-- Per rol: wat mag wel en wat niet (ingelogd met 2FA, account actief).
begin;
select plan(48);

select tests.create_user('beheerder@test.nl',  'beheerder');
select tests.create_user('teamleider@test.nl', 'teamleider');
select tests.create_user('medewerker@test.nl', 'medewerker');
select tests.create_user('lezer@test.nl',      'alleen-lezen');
select private.write_audit(null, 'test.regel', null);

-- ---------------------------------------------------------------------------
-- beheerder
-- ---------------------------------------------------------------------------
select tests.authenticate_as('beheerder@test.nl');

select is((select count(*) from public.profiles),         4::bigint, 'beheerder: ziet alle profielen');
select is((select count(*) from public.user_roles),       4::bigint, 'beheerder: ziet alle rollen van gebruikers');
select is((select count(*) from public.roles),            4::bigint, 'beheerder: ziet de rollen');
select is((select count(*) from public.role_permissions), 8::bigint, 'beheerder: ziet alle rechten per rol');
select ok((select count(*) from public.audit_log) > 0,               'beheerder: leest de auditlog');
select lives_ok($$ select * from public.list_users() $$,             'beheerder: ziet het gebruikersoverzicht');
select is((select count(*) from public.list_users()),     4::bigint, 'beheerder: gebruikersoverzicht is compleet');

select throws_ok($$ update public.user_roles set role_id = 'medewerker' $$, '42501', null,
  'beheerder: kan rollen niet direct wijzigen (alleen via Edge Function)');
select throws_ok($$ insert into public.role_permissions values ('medewerker', 'auditlog.lezen') $$, '42501', null,
  'beheerder: kan rechten niet direct toekennen');
select throws_ok($$ delete from public.audit_log $$, '42501', null,
  'beheerder: kan de auditlog niet verwijderen');
select throws_ok($$ select public.admin_set_role(auth.uid(), auth.uid(), 'medewerker') $$, '42501', null,
  'beheerder: kan beheerfuncties niet zelf aanroepen');
select throws_ok($$ select public.custom_access_token_hook('{}'::jsonb) $$, '42501', null,
  'beheerder: kan de token-hook niet aanroepen');
reset role;

-- ---------------------------------------------------------------------------
-- teamleider
-- ---------------------------------------------------------------------------
select tests.authenticate_as('teamleider@test.nl');

select is((select count(*) from public.profiles),         4::bigint, 'teamleider: ziet alle profielen');
select is((select count(*) from public.user_roles),       4::bigint, 'teamleider: ziet alle rollen van gebruikers');
select is((select count(*) from public.roles),            4::bigint, 'teamleider: ziet de rollen');
select is((select count(*) from public.role_permissions), 8::bigint, 'teamleider: ziet alle rechten per rol');
select is((select count(*) from public.audit_log),        0::bigint, 'teamleider: leest de auditlog niet');
select lives_ok($$ select * from public.list_users() $$,             'teamleider: ziet het gebruikersoverzicht');

select throws_ok($$ update public.user_roles set role_id = 'beheerder' $$, '42501', null,
  'teamleider: kan rollen niet wijzigen');
select throws_ok($$ update public.profiles set is_active = false $$, '42501', null,
  'teamleider: kan accounts niet deactiveren');
select throws_ok($$ insert into public.audit_log (action) values ('test.vals') $$, '42501', null,
  'teamleider: kan niets in de auditlog schrijven');
select throws_ok($$ select public.admin_set_active(auth.uid(), auth.uid(), false) $$, '42501', null,
  'teamleider: kan beheerfuncties niet aanroepen');
select throws_ok($$ select public.complete_password_change(auth.uid()) $$, '42501', null,
  'teamleider: kan "wachtwoord gewijzigd" niet zelf zetten');
select throws_ok($$ select private.write_audit(null, 'test.vals', null) $$, '42501', null,
  'teamleider: kan interne functies niet aanroepen');
reset role;

-- ---------------------------------------------------------------------------
-- medewerker
-- ---------------------------------------------------------------------------
select tests.authenticate_as('medewerker@test.nl');

select is((select count(*) from public.profiles),         1::bigint, 'medewerker: ziet alleen het eigen profiel');
select is((select user_id from public.profiles), tests.user_id('medewerker@test.nl'),
  'medewerker: het zichtbare profiel is het eigen profiel');
select is((select count(*) from public.user_roles),       1::bigint, 'medewerker: ziet alleen de eigen rol');
select is((select count(*) from public.roles),            4::bigint, 'medewerker: ziet de rollen');
select is((select count(*) from public.role_permissions), 1::bigint, 'medewerker: ziet alleen de eigen rechten');
select is((select count(*) from public.audit_log),        0::bigint, 'medewerker: leest de auditlog niet');
select throws_ok($$ select * from public.list_users() $$, '42501', null,
  'medewerker: ziet het gebruikersoverzicht niet');

select throws_ok($$ update public.user_roles set role_id = 'beheerder' where user_id = auth.uid() $$, '42501', null,
  'medewerker: kan zichzelf geen andere rol geven');
select throws_ok($$ update public.profiles set must_change_password = false where user_id = auth.uid() $$, '42501', null,
  'medewerker: kan eigen profiel niet wijzigen');
select throws_ok($$ insert into public.user_roles (user_id, role_id) values (gen_random_uuid(), 'beheerder') $$, '42501', null,
  'medewerker: kan geen rollen toekennen');
select throws_ok($$ select public.admin_create_profile(auth.uid(), gen_random_uuid(), 'x', 'beheerder') $$, '42501', null,
  'medewerker: kan geen gebruikers aanmaken');
reset role;

-- ---------------------------------------------------------------------------
-- alleen-lezen
-- ---------------------------------------------------------------------------
select tests.authenticate_as('lezer@test.nl');

select is((select count(*) from public.profiles),         1::bigint, 'alleen-lezen: ziet alleen het eigen profiel');
select is((select count(*) from public.user_roles),       1::bigint, 'alleen-lezen: ziet alleen de eigen rol');
select is((select count(*) from public.roles),            4::bigint, 'alleen-lezen: ziet de rollen');
select is((select count(*) from public.role_permissions), 1::bigint, 'alleen-lezen: ziet alleen de eigen rechten');
select is((select count(*) from public.audit_log),        0::bigint, 'alleen-lezen: leest de auditlog niet');
select throws_ok($$ select * from public.list_users() $$, '42501', null,
  'alleen-lezen: ziet het gebruikersoverzicht niet');

select throws_ok($$ update public.user_roles set role_id = 'beheerder' where user_id = auth.uid() $$, '42501', null,
  'alleen-lezen: kan zichzelf geen andere rol geven');
select throws_ok($$ update public.profiles set weergavenaam = 'x' $$, '42501', null,
  'alleen-lezen: kan profielen niet wijzigen');
select throws_ok($$ delete from public.profiles $$, '42501', null,
  'alleen-lezen: kan profielen niet verwijderen');
select throws_ok($$ insert into public.roles (id, naam) values ('baas', 'Baas') $$, '42501', null,
  'alleen-lezen: kan geen rollen aanmaken');
select throws_ok($$ insert into public.permissions (id, omschrijving) values ('alles.mogen', 'x') $$, '42501', null,
  'alleen-lezen: kan geen rechten aanmaken');
select throws_ok($$ select public.admin_reset_mfa(auth.uid(), auth.uid()) $$, '42501', null,
  'alleen-lezen: kan geen 2FA resetten');
reset role;

select is((select count(*) from public.user_roles where role_id = 'beheerder'), 1::bigint,
  'na alle pogingen is er nog steeds precies één beheerder');

select * from finish();
rollback;
