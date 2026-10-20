-- =============================================================================
-- Gebruikersbeheer
--
-- Wijzigingen lopen via functies die alleen de service role mag uitvoeren,
-- dus alleen de Edge Function admin-users. Die geeft de ingelogde beheerder
-- mee als p_actor; elke functie controleert zelf nog of die beheerder
-- gebruikers.beheren heeft (dubbele controle) en schrijft de auditlog in
-- dezelfde transactie.
--
-- De regels voor beheerders zitten in triggers, zodat ze ook gelden voor
-- wijzigingen buiten deze functies om (bijv. SQL in het dashboard):
--   * een beheerder kan zichzelf de rol niet afnemen of zichzelf deactiveren;
--   * er blijft altijd minstens één actieve beheerder.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Interne hulpfuncties
-- -----------------------------------------------------------------------------
create function private.current_actor()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('app.actor_id', true), '')::uuid
$$;

-- Controleert de beheerder en onthoudt hem voor de triggers in deze transactie.
create function private.require_user_admin(p_actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_actor is null or not exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.user_id
    join public.role_permissions rp on rp.role_id = ur.role_id
    where p.user_id = p_actor
      and p.is_active
      and not p.must_change_password
      and rp.permission_id = 'gebruikers.beheren'
  ) then
    raise exception 'Je hebt geen rechten voor gebruikersbeheer'
      using errcode = 'insufficient_privilege';
  end if;

  perform set_config('app.actor_id', p_actor::text, true);
end;
$$;

create function private.write_audit(
  p_actor uuid,
  p_action text,
  p_target uuid,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, target_user_id, details)
  values (p_actor, p_action, p_target, coalesce(p_details, '{}'::jsonb))
$$;

-- Trekt alle sessies (refresh tokens) van een gebruiker in. Een al uitgegeven
-- access token blijft geldig tot het verloopt (jwt_expiry), maar
-- private.authorize() laat het na een rol- of statuswijziging al niet meer toe.
create function private.revoke_sessions(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.sessions where user_id = p_user
$$;

create function private.require_existing_user(p_user uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where user_id = p_user) then
    raise exception 'Gebruiker niet gevonden' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke all on function private.current_actor() from public;
revoke all on function private.require_user_admin(uuid) from public;
revoke all on function private.write_audit(uuid, text, uuid, jsonb) from public;
revoke all on function private.revoke_sessions(uuid) from public;
revoke all on function private.require_existing_user(uuid) from public;

-- -----------------------------------------------------------------------------
-- Regels voor beheerders (triggers)
-- -----------------------------------------------------------------------------
create function private.guard_beheerders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.current_actor();
  v_admin_removed boolean := false;
begin
  -- Serialiseer, zodat twee gelijktijdige wijzigingen niet allebei
  -- "er is nog een andere beheerder" zien.
  perform pg_advisory_xact_lock(hashtext('bnwv.beheerders'));

  if tg_table_name = 'user_roles' then
    v_admin_removed := old.role_id = 'beheerder'
      and (tg_op = 'DELETE' or new.role_id <> 'beheerder');

    if v_admin_removed and old.user_id = v_actor then
      raise exception 'Je kunt jezelf de beheerdersrol niet afnemen'
        using errcode = 'check_violation';
    end if;
  else -- profiles
    v_admin_removed := old.is_active
      and (tg_op = 'DELETE' or not new.is_active)
      and exists (
        select 1 from public.user_roles
        where user_id = old.user_id and role_id = 'beheerder'
      );

    if old.is_active and (tg_op = 'DELETE' or not new.is_active)
       and old.user_id = v_actor then
      raise exception 'Je kunt je eigen account niet deactiveren'
        using errcode = 'check_violation';
    end if;
  end if;

  if v_admin_removed and not exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.user_id = ur.user_id
    where ur.role_id = 'beheerder' and p.is_active
  ) then
    raise exception 'Er moet minstens één actieve beheerder blijven'
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

revoke all on function private.guard_beheerders() from public;

create trigger guard_beheerders
  after update or delete on public.user_roles
  for each row execute function private.guard_beheerders();

create trigger guard_beheerders
  after update of is_active or delete on public.profiles
  for each row execute function private.guard_beheerders();

-- updated_at bijhouden
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.user_roles
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Beheerfuncties (alleen service role, via de Edge Function)
-- -----------------------------------------------------------------------------

-- Na het aanmaken van de gebruiker in Supabase Auth: profiel en rol vastleggen.
create function public.admin_create_profile(
  p_actor uuid,
  p_user uuid,
  p_weergavenaam text,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_user_admin(p_actor);

  insert into public.profiles (user_id, weergavenaam, must_change_password)
  values (p_user, btrim(p_weergavenaam), true);

  insert into public.user_roles (user_id, role_id, updated_by)
  values (p_user, p_role, p_actor);

  perform private.write_audit(p_actor, 'gebruiker.aangemaakt', p_user,
    jsonb_build_object('rol', p_role));
end;
$$;

create function public.admin_set_role(p_actor uuid, p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  perform private.require_user_admin(p_actor);
  perform private.require_existing_user(p_user);

  select role_id into v_old from public.user_roles where user_id = p_user for update;
  if v_old is not distinct from p_role then
    return;
  end if;

  insert into public.user_roles (user_id, role_id, updated_by)
  values (p_user, p_role, p_actor)
  on conflict (user_id) do update
    set role_id = excluded.role_id, updated_by = excluded.updated_by;

  perform private.revoke_sessions(p_user);
  perform private.write_audit(p_actor, 'gebruiker.rol_gewijzigd', p_user,
    jsonb_build_object('van', v_old, 'naar', p_role));
end;
$$;

create function public.admin_set_active(p_actor uuid, p_user uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_user_admin(p_actor);
  perform private.require_existing_user(p_user);

  update public.profiles set is_active = p_active where user_id = p_user;

  if not p_active then
    perform private.revoke_sessions(p_user);
  end if;

  perform private.write_audit(p_actor,
    case when p_active then 'gebruiker.geactiveerd' else 'gebruiker.gedeactiveerd' end,
    p_user);
end;
$$;

-- Aanroepen vóórdat de Edge Function het nieuwe tijdelijke wachtwoord zet.
create function public.admin_reset_password(p_actor uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_user_admin(p_actor);
  perform private.require_existing_user(p_user);

  update public.profiles set must_change_password = true where user_id = p_user;
  perform private.revoke_sessions(p_user);
  perform private.write_audit(p_actor, 'gebruiker.wachtwoord_gereset', p_user);
end;
$$;

-- Verwijdert alle 2FA-factoren; de gebruiker stelt 2FA opnieuw in bij inloggen.
create function public.admin_reset_mfa(p_actor uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_user_admin(p_actor);
  perform private.require_existing_user(p_user);

  delete from auth.mfa_factors where user_id = p_user;
  perform private.revoke_sessions(p_user);
  perform private.write_audit(p_actor, 'gebruiker.2fa_gereset', p_user);
end;
$$;

-- Na een geslaagde wachtwoordwijziging door de gebruiker zelf.
create function public.complete_password_change(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_existing_user(p_user);
  update public.profiles set must_change_password = false where user_id = p_user;
  perform private.write_audit(p_user, 'auth.wachtwoord_gewijzigd', p_user);
end;
$$;

revoke all on function public.admin_create_profile(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_set_role(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_set_active(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.admin_reset_password(uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_reset_mfa(uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_password_change(uuid) from public, anon, authenticated;

grant execute on function public.admin_create_profile(uuid, uuid, text, text) to service_role;
grant execute on function public.admin_set_role(uuid, uuid, text) to service_role;
grant execute on function public.admin_set_active(uuid, uuid, boolean) to service_role;
grant execute on function public.admin_reset_password(uuid, uuid) to service_role;
grant execute on function public.admin_reset_mfa(uuid, uuid) to service_role;
grant execute on function public.complete_password_change(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- Gebruikersoverzicht (lezen, voor gebruikers.bekijken)
-- -----------------------------------------------------------------------------
create function public.list_users()
returns table (
  user_id uuid,
  email text,
  weergavenaam text,
  role_id text,
  is_active boolean,
  must_change_password boolean,
  heeft_2fa boolean,
  laatst_ingelogd timestamptz,
  aangemaakt timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.authorize('gebruikers.bekijken') then
    raise exception 'Je hebt geen rechten om gebruikers te bekijken'
      using errcode = 'insufficient_privilege';
  end if;

  return query
    select
      p.user_id,
      u.email::text,
      p.weergavenaam,
      ur.role_id,
      p.is_active,
      p.must_change_password,
      exists (
        select 1 from auth.mfa_factors f
        where f.user_id = p.user_id and f.status = 'verified'
      ),
      u.last_sign_in_at,
      p.created_at
    from public.profiles p
    join auth.users u on u.id = p.user_id
    left join public.user_roles ur on ur.user_id = p.user_id
    order by p.weergavenaam;
end;
$$;

revoke all on function public.list_users() from public, anon;
grant execute on function public.list_users() to authenticated;

-- -----------------------------------------------------------------------------
-- Sluitstuk: in private mag authenticated alleen de autorisatiecontroles
-- uitvoeren. Supabase geeft nieuwe functies standaard uitvoerrechten; die
-- trekken we hier voor het hele schema in. De test 010_schema bewaakt dit.
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_aal2() to authenticated;
grant execute on function private.session_is_valid() to authenticated;
grant execute on function private.authorize(text) to authenticated;
