-- =============================================================================
-- Custom Access Token Hook
--
-- Supabase Auth roept deze functie aan voor elk nieuw access token. Ze:
--   * zet user_role, is_active en must_change_password als claims in de JWT;
--   * weigert tokens voor gedeactiveerde accounts en accounts zonder profiel
--     of rol (ook bij een refresh: een lopende sessie stopt dus ook);
--   * schrijft inloggen (wachtwoord- en 2FA-stap) naar de auditlog.
--
-- De rol komt uit user_roles, nooit uit user_metadata: die kan de gebruiker
-- zelf aanpassen.
--
-- Activeren in het dashboard: Authentication → Hooks → Customize Access Token
-- → Postgres-functie public.custom_access_token_hook. Lokaal: config.toml.
--
-- security definer: Supabase Auth (supabase_auth_admin) heeft zo alleen
-- uitvoerrecht op deze ene functie nodig, en geen lees- of schrijfrechten op
-- de tabellen zelf.
-- =============================================================================

create function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (event ->> 'user_id')::uuid;
  v_method text := event ->> 'authentication_method';
  v_claims jsonb := event -> 'claims';
  v_role text;
  v_active boolean;
  v_must_change boolean;
begin
  select ur.role_id into v_role
  from public.user_roles ur
  where ur.user_id = v_user_id;

  select p.is_active, p.must_change_password into v_active, v_must_change
  from public.profiles p
  where p.user_id = v_user_id;

  if v_role is null or v_active is distinct from true then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Dit account is niet actief. Neem contact op met een beheerder.'
      )
    );
  end if;

  v_claims := v_claims || jsonb_build_object(
    'user_role', v_role,
    'is_active', v_active,
    'must_change_password', v_must_change
  );

  -- Alleen echte inlogstappen loggen, niet elke token-refresh.
  if v_method is not null and v_method <> 'token_refresh' then
    insert into public.audit_log (actor_id, action, target_user_id, details)
    values (v_user_id, 'auth.ingelogd', v_user_id, jsonb_build_object('methode', v_method));
  end if;

  return jsonb_build_object('claims', v_claims);
end;
$$;

-- Alleen Supabase Auth mag de hook uitvoeren.
revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated, service_role;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
