-- Controle vóór het wijzigen van een tijdelijk wachtwoord (Edge Function
-- wachtwoord-wijzigen).
begin;
select plan(6);

select tests.create_user('tijdelijk@test.nl', 'medewerker', p_must_change => true);
select tests.create_user('definitief@test.nl', 'medewerker');
select tests.create_user('uit@test.nl', 'medewerker', p_active => false, p_must_change => true);

select is(public.password_change_status(tests.user_id('tijdelijk@test.nl')), 'toegestaan',
  'met een tijdelijk wachtwoord mag de gebruiker het wijzigen');
select is(public.password_change_status(tests.user_id('definitief@test.nl')), 'niet_nodig',
  'met een definitief wachtwoord is wijzigen via de functie niet nodig');
select is(public.password_change_status(tests.user_id('uit@test.nl')), 'inactief',
  'een gedeactiveerd account mag niets');
select is(public.password_change_status(gen_random_uuid()), 'inactief',
  'een onbekende gebruiker mag niets');

select ok(
  has_function_privilege('service_role', 'public.password_change_status(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.password_change_status(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.password_change_status(uuid)', 'execute'),
  'alleen de service role kan de controle uitvoeren');

select ok(
  has_function_privilege('service_role', 'public.complete_password_change(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.complete_password_change(uuid)', 'execute'),
  'alleen de service role kan de wijziging afronden');

select * from finish();
rollback;
