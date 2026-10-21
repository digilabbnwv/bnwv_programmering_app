-- =============================================================================
-- Controle vooraf voor de Edge Function admin-users
--
-- Bij het aanmaken van een gebruiker maakt de functie eerst het account in
-- Supabase Auth aan en daarna pas profiel en rol (admin_create_profile). Met
-- deze controle vooraf ontstaat er geen Auth-account als de aanroeper geen
-- beheerder is. admin_create_profile controleert het daarna nog een keer.
-- =============================================================================

create function public.can_manage_users(p_actor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.user_id
    join public.role_permissions rp on rp.role_id = ur.role_id
    where p.user_id = p_actor
      and p.is_active
      and not p.must_change_password
      and rp.permission_id = 'gebruikers.beheren'
  )
$$;

revoke all on function public.can_manage_users(uuid) from public, anon, authenticated;
grant execute on function public.can_manage_users(uuid) to service_role;
