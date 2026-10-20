-- Beheerfuncties (zoals de Edge Function ze aanroept) en de beheerdersregels.
begin;
select plan(26);

select tests.create_user('admin1@test.nl',  'beheerder');
select tests.create_user('admin2@test.nl',  'beheerder');
select tests.create_user('med@test.nl',     'medewerker');
select tests.create_user('nieuw@test.nl',   'beheerder', p_must_change => true);

-- Een actieve sessie om te zien dat die wordt ingetrokken.
insert into auth.sessions (id, user_id, created_at, updated_at)
values (gen_random_uuid(), tests.user_id('med@test.nl'), now(), now());

-- ---------------------------------------------------------------------------
-- Rol wijzigen
-- ---------------------------------------------------------------------------
select lives_ok(
  format($$ select public.admin_set_role(%L, %L, 'teamleider') $$,
         tests.user_id('admin1@test.nl'), tests.user_id('med@test.nl')),
  'beheerder kan een rol wijzigen');
select is((select role_id from public.user_roles where user_id = tests.user_id('med@test.nl')),
  'teamleider', 'de rol is gewijzigd');
select is((select count(*) from auth.sessions where user_id = tests.user_id('med@test.nl')),
  0::bigint, 'sessies van de gebruiker zijn ingetrokken na een rolwijziging');
select is(
  (select details from public.audit_log
    where action = 'gebruiker.rol_gewijzigd' and target_user_id = tests.user_id('med@test.nl')),
  '{"van": "medewerker", "naar": "teamleider"}'::jsonb,
  'rolwijziging staat in de auditlog, met oude en nieuwe rol');
select is(
  (select actor_id from public.audit_log where action = 'gebruiker.rol_gewijzigd'),
  tests.user_id('admin1@test.nl'), 'de auditlog noemt de beheerder die het deed');

select throws_ok(
  format($$ select public.admin_set_role(%L, %L, 'beheerder') $$,
         tests.user_id('med@test.nl'), tests.user_id('med@test.nl')),
  '42501', null, 'een niet-beheerder kan via de functie geen rollen wijzigen');
select throws_ok(
  format($$ select public.admin_set_role(%L, %L, 'medewerker') $$,
         tests.user_id('nieuw@test.nl'), tests.user_id('med@test.nl')),
  '42501', null, 'een beheerder met tijdelijk wachtwoord kan nog niets beheren');
select throws_ok(
  format($$ select public.admin_set_role(%L, %L, 'baas') $$,
         tests.user_id('admin1@test.nl'), tests.user_id('med@test.nl')),
  '23503', null, 'een onbekende rol wordt geweigerd');

-- ---------------------------------------------------------------------------
-- Beheerdersregels
-- ---------------------------------------------------------------------------
select throws_ok(
  format($$ select public.admin_set_role(%L, %L, 'medewerker') $$,
         tests.user_id('admin1@test.nl'), tests.user_id('admin1@test.nl')),
  '23514', 'Je kunt jezelf de beheerdersrol niet afnemen',
  'een beheerder kan zichzelf de beheerdersrol niet afnemen');
select throws_ok(
  format($$ select public.admin_set_active(%L, %L, false) $$,
         tests.user_id('admin1@test.nl'), tests.user_id('admin1@test.nl')),
  '23514', 'Je kunt je eigen account niet deactiveren',
  'een beheerder kan zichzelf niet deactiveren');

-- De tweede actieve beheerder mag wel weg, want admin1 blijft over.
select lives_ok(
  format($$ select public.admin_set_role(%L, %L, 'medewerker') $$,
         tests.user_id('admin1@test.nl'), tests.user_id('admin2@test.nl')),
  'een andere beheerder degraderen mag zolang er een beheerder overblijft');

-- Vanaf hier directe SQL, zonder beheerder als actor (zoals in het dashboard).
-- De beheerfuncties zetten app.actor_id voor de rest van de transactie.
select set_config('app.actor_id', '', true);

-- admin1 is nu de laatste actieve beheerder ('nieuw' telt mee, dus eerst weg).
update public.profiles set is_active = false where user_id = tests.user_id('nieuw@test.nl');

select throws_ok(
  format($$ update public.user_roles set role_id = 'medewerker' where user_id = %L $$,
         tests.user_id('admin1@test.nl')),
  '23514', 'Er moet minstens één actieve beheerder blijven',
  'de laatste beheerder kan zijn rol niet verliezen, ook niet via directe SQL');
select throws_ok(
  format($$ update public.profiles set is_active = false where user_id = %L $$,
         tests.user_id('admin1@test.nl')),
  '23514', 'Er moet minstens één actieve beheerder blijven',
  'de laatste beheerder kan niet gedeactiveerd worden');
select throws_ok(
  format($$ delete from auth.users where id = %L $$, tests.user_id('admin1@test.nl')),
  '23514', 'Er moet minstens één actieve beheerder blijven',
  'de laatste beheerder kan niet verwijderd worden');

-- ---------------------------------------------------------------------------
-- Deactiveren, wachtwoord en 2FA resetten
-- ---------------------------------------------------------------------------
select lives_ok(
  format($$ select public.admin_set_active(%L, %L, false) $$,
         tests.user_id('admin1@test.nl'), tests.user_id('med@test.nl')),
  'beheerder kan een account deactiveren');
select is((select is_active from public.profiles where user_id = tests.user_id('med@test.nl')),
  false, 'het account is gedeactiveerd');

select lives_ok(
  format($$ select public.admin_reset_password(%L, %L) $$,
         tests.user_id('admin1@test.nl'), tests.user_id('admin2@test.nl')),
  'beheerder kan een wachtwoord resetten');
select is((select must_change_password from public.profiles where user_id = tests.user_id('admin2@test.nl')),
  true, 'na een reset moet de gebruiker het wachtwoord wijzigen');

select lives_ok(
  format($$ select public.admin_reset_mfa(%L, %L) $$,
         tests.user_id('admin1@test.nl'), tests.user_id('admin2@test.nl')),
  'beheerder kan 2FA resetten');
select is((select count(*) from public.audit_log
            where action in ('gebruiker.gedeactiveerd', 'gebruiker.wachtwoord_gereset', 'gebruiker.2fa_gereset')),
  3::bigint, 'deactiveren en resetten staan in de auditlog');

select throws_ok(
  format($$ select public.admin_set_active(%L, %L, true) $$,
         tests.user_id('admin1@test.nl'), gen_random_uuid()),
  'P0002', null, 'een onbekende gebruiker geeft een duidelijke fout');

-- ---------------------------------------------------------------------------
-- Gebruiker aanmaken en eerste wachtwoordwijziging
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'nieuwe.collega@test.nl', '', now(), now());

select lives_ok(
  format($$ select public.admin_create_profile(%L, '11111111-1111-1111-1111-111111111111', '  Nieuwe Collega ', 'medewerker') $$,
         tests.user_id('admin1@test.nl')),
  'beheerder kan een profiel met rol aanmaken');
select results_eq(
  $$ select p.weergavenaam, p.must_change_password, ur.role_id
       from public.profiles p join public.user_roles ur using (user_id)
      where p.user_id = '11111111-1111-1111-1111-111111111111' $$,
  $$ values ('Nieuwe Collega', true, 'medewerker') $$,
  'nieuw account: naam opgeschoond, rol gezet, tijdelijk wachtwoord');

select throws_ok(
  format($$ select public.admin_create_profile(%L, %L, '   ', 'medewerker') $$,
         tests.user_id('admin1@test.nl'), tests.user_id('med@test.nl')),
  '23514', null, 'een lege naam wordt geweigerd');

select lives_ok(
  $$ select public.complete_password_change('11111111-1111-1111-1111-111111111111') $$,
  'na de eerste wachtwoordwijziging gaat de vlag uit');
select is(
  (select must_change_password from public.profiles where user_id = '11111111-1111-1111-1111-111111111111'),
  false, 'het tijdelijke wachtwoord is vervangen');

select * from finish();
rollback;
