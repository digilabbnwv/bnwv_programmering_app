-- =============================================================================
-- Autorisatie: hulpfuncties en RLS-policies.
--
-- Elke policy gaat via private.authorize() of private.session_is_valid(). Beide
-- eisen AAL2. authorize() controleert daarnaast:
--   * account actief en wachtwoord niet meer tijdelijk;
--   * de rol in de JWT (claim user_role, gezet door de access token hook)
--     is nog steeds de rol in user_roles. Na een rolwijziging verliest een oud
--     token dus direct zijn rechten (fail closed) tot de volgende refresh;
--   * de rol heeft het gevraagde recht in role_permissions.
--
-- Aanroepen in policies staan in (select ...), zodat Postgres ze één keer per
-- query uitvoert in plaats van per rij.
-- =============================================================================

create function private.is_aal2()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

-- Ingelogd met 2FA en account actief. Voor toegang tot je eigen gegevens.
create function private.session_is_valid()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_aal2()
    and exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.is_active
    )
$$;

create function private.authorize(requested_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_aal2()
    and exists (
      select 1
      from public.profiles p
      join public.user_roles ur on ur.user_id = p.user_id
      join public.role_permissions rp on rp.role_id = ur.role_id
      where p.user_id = auth.uid()
        and p.is_active
        and not p.must_change_password
        and ur.role_id = auth.jwt() ->> 'user_role'
        and rp.permission_id = requested_permission
    )
$$;

revoke all on function private.is_aal2() from public;
revoke all on function private.session_is_valid() from public;
revoke all on function private.authorize(text) from public;
grant execute on function private.is_aal2() to authenticated;
grant execute on function private.session_is_valid() to authenticated;
grant execute on function private.authorize(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Policies (alleen SELECT; schrijven gaat via functies voor de service role)
-- -----------------------------------------------------------------------------
create policy "Rollen lezen"
  on public.roles for select to authenticated
  using ((select private.authorize('app.gebruiken')));

create policy "Rechten lezen"
  on public.permissions for select to authenticated
  using ((select private.authorize('app.gebruiken')));

create policy "Eigen rechten of alle rechten met gebruikers.bekijken"
  on public.role_permissions for select to authenticated
  using (
    (select private.authorize('gebruikers.bekijken'))
    or (
      role_id = (select auth.jwt() ->> 'user_role')
      and (select private.authorize('app.gebruiken'))
    )
  );

create policy "Eigen profiel of alle profielen met gebruikers.bekijken"
  on public.profiles for select to authenticated
  using (
    (user_id = (select auth.uid()) and (select private.session_is_valid()))
    or (select private.authorize('gebruikers.bekijken'))
  );

create policy "Eigen rol of alle rollen met gebruikers.bekijken"
  on public.user_roles for select to authenticated
  using (
    (user_id = (select auth.uid()) and (select private.session_is_valid()))
    or (select private.authorize('gebruikers.bekijken'))
  );

create policy "Auditlog lezen met auditlog.lezen"
  on public.audit_log for select to authenticated
  using ((select private.authorize('auditlog.lezen')));
