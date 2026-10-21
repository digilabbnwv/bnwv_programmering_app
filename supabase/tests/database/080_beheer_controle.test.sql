-- Controle vooraf voor de Edge Function admin-users.
begin;
select plan(6);

select tests.create_user('beheer@test.nl', 'beheerder');
select tests.create_user('nieuwbeheer@test.nl', 'beheerder', p_must_change => true);
select tests.create_user('oudbeheer@test.nl', 'beheerder', p_active => false);
select tests.create_user('leider@test.nl', 'teamleider');

select ok(public.can_manage_users(tests.user_id('beheer@test.nl')),
  'een actieve beheerder mag gebruikers beheren');
select ok(not public.can_manage_users(tests.user_id('nieuwbeheer@test.nl')),
  'een beheerder met een tijdelijk wachtwoord nog niet');
select ok(not public.can_manage_users(tests.user_id('oudbeheer@test.nl')),
  'een gedeactiveerde beheerder niet');
select ok(not public.can_manage_users(tests.user_id('leider@test.nl')),
  'een teamleider niet');
select ok(not public.can_manage_users(gen_random_uuid()),
  'een onbekende gebruiker niet');

select ok(
  has_function_privilege('service_role', 'public.can_manage_users(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.can_manage_users(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.can_manage_users(uuid)', 'execute'),
  'alleen de service role kan de controle uitvoeren');

select * from finish();
rollback;
