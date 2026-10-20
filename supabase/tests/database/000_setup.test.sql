-- Testhulpfuncties. Dit bestand draait als eerste (alfabetisch) en commit
-- bewust, zodat de andere testbestanden de functies kunnen gebruiken.
-- De tests gaan uit van een schone database: `supabase db reset`.

create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

-- Maakt een gebruiker in auth.users plus profiel en (optioneel) rol.
create or replace function tests.create_user(
  p_email text,
  p_role text,
  p_active boolean default true,
  p_must_change boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    p_email, '', now(), '{}', '{}', now(), now()
  );

  insert into public.profiles (user_id, weergavenaam, is_active, must_change_password)
  values (v_id, p_email, p_active, p_must_change);

  if p_role is not null then
    insert into public.user_roles (user_id, role_id) values (v_id, p_role);
  end if;

  return v_id;
end;
$$;

create or replace function tests.user_id(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where email = p_email
$$;

-- Doet alsof de gebruiker via de API ingelogd is: rol authenticated en een
-- JWT met de claims die de access token hook zou zetten.
-- p_role_claim overschrijft de rol in het token (voor tests met een verouderd
-- of vervalst token).
create or replace function tests.authenticate_as(
  p_email text,
  p_aal text default 'aal2',
  p_role_claim text default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := tests.user_id(p_email);
  v_claims jsonb;
begin
  if v_id is null then
    raise exception 'Testgebruiker % bestaat niet', p_email;
  end if;

  select jsonb_build_object(
    'sub', v_id,
    'role', 'authenticated',
    'aal', p_aal,
    'user_role', coalesce(p_role_claim, ur.role_id),
    'is_active', p.is_active,
    'must_change_password', p.must_change_password
  )
  into v_claims
  from public.profiles p
  left join public.user_roles ur on ur.user_id = p.user_id
  where p.user_id = v_id;

  perform set_config('request.jwt.claims', v_claims::text, true);
  perform set_config('request.jwt.claim.sub', v_id::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function tests.authenticate_as_anon()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('role', 'anon', true);
end;
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

begin;
select plan(1);
select has_function('tests', 'authenticate_as', 'testhulpfuncties staan klaar');
select * from finish();
commit;
