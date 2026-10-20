-- Zonder 2FA, gedeactiveerd, tijdelijk wachtwoord, verouderd token en anoniem.
begin;
select plan(23);

select tests.create_user('beheerder@test.nl',   'beheerder');
select tests.create_user('inactief@test.nl',    'beheerder', p_active => false);
select tests.create_user('nieuw@test.nl',       'beheerder', p_must_change => true);
select tests.create_user('medewerker@test.nl',  'medewerker');
select private.write_audit(null, 'test.regel', null);

-- ---------------------------------------------------------------------------
-- Beheerder zonder AAL2 (wachtwoord ingevoerd, 2FA nog niet)
-- ---------------------------------------------------------------------------
select tests.authenticate_as('beheerder@test.nl', p_aal => 'aal1');

select is((select count(*) from public.profiles),         0::bigint, 'AAL1: ziet geen profielen, ook het eigen niet');
select is((select count(*) from public.user_roles),       0::bigint, 'AAL1: ziet geen rollen van gebruikers');
select is((select count(*) from public.roles),            0::bigint, 'AAL1: ziet geen rollen');
select is((select count(*) from public.role_permissions), 0::bigint, 'AAL1: ziet geen rechten');
select is((select count(*) from public.audit_log),        0::bigint, 'AAL1: leest de auditlog niet');
select throws_ok($$ select * from public.list_users() $$, '42501', null,
  'AAL1: ziet het gebruikersoverzicht niet');
reset role;

-- Een token zonder aal-claim telt ook niet als AAL2.
select tests.authenticate_as('beheerder@test.nl', p_aal => null);
select is((select count(*) from public.profiles), 0::bigint, 'zonder aal-claim: geen toegang');
reset role;

-- ---------------------------------------------------------------------------
-- Gedeactiveerde beheerder met een nog geldig AAL2-token
-- ---------------------------------------------------------------------------
select tests.authenticate_as('inactief@test.nl');

select is((select count(*) from public.profiles),  0::bigint, 'gedeactiveerd: ziet geen profielen');
select is((select count(*) from public.roles),     0::bigint, 'gedeactiveerd: ziet geen rollen');
select is((select count(*) from public.audit_log), 0::bigint, 'gedeactiveerd: leest de auditlog niet');
select throws_ok($$ select * from public.list_users() $$, '42501', null,
  'gedeactiveerd: ziet het gebruikersoverzicht niet');
reset role;

-- ---------------------------------------------------------------------------
-- Beheerder met tijdelijk wachtwoord (nog niet gewijzigd)
-- ---------------------------------------------------------------------------
select tests.authenticate_as('nieuw@test.nl');

select is((select count(*) from public.profiles),  1::bigint, 'tijdelijk wachtwoord: ziet alleen het eigen profiel');
select is((select count(*) from public.roles),     0::bigint, 'tijdelijk wachtwoord: ziet geen rollen');
select is((select count(*) from public.audit_log), 0::bigint, 'tijdelijk wachtwoord: leest de auditlog niet');
select throws_ok($$ select * from public.list_users() $$, '42501', null,
  'tijdelijk wachtwoord: ziet het gebruikersoverzicht niet');
reset role;

-- ---------------------------------------------------------------------------
-- Verouderd of vervalst token: claim zegt beheerder, database zegt medewerker
-- ---------------------------------------------------------------------------
select tests.authenticate_as('medewerker@test.nl', p_role_claim => 'beheerder');

select is((select count(*) from public.audit_log), 0::bigint, 'rol in token klopt niet: geen auditlog');
select is((select count(*) from public.roles),     0::bigint, 'rol in token klopt niet: geen rechten van welke rol dan ook');
select throws_ok($$ select * from public.list_users() $$, '42501', null,
  'rol in token klopt niet: geen gebruikersoverzicht');
reset role;

-- ---------------------------------------------------------------------------
-- Anoniem (alleen de publishable/anon key, niet ingelogd)
-- ---------------------------------------------------------------------------
select tests.authenticate_as_anon();

select throws_ok($$ select * from public.profiles $$,   '42501', null, 'anoniem: geen toegang tot profielen');
select throws_ok($$ select * from public.roles $$,      '42501', null, 'anoniem: geen toegang tot rollen');
select throws_ok($$ select * from public.audit_log $$,  '42501', null, 'anoniem: geen toegang tot de auditlog');
select throws_ok($$ select * from public.list_users() $$, '42501', null, 'anoniem: geen gebruikersoverzicht');
select throws_ok($$ select private.authorize('app.gebruiken') $$, '42501', null, 'anoniem: geen toegang tot private');
reset role;

select * from finish();
rollback;
