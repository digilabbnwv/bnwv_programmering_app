-- =============================================================================
-- Wachtwoord wijzigen na een tijdelijk wachtwoord
--
-- De Edge Function wachtwoord-wijzigen vraagt eerst of de gebruiker zijn
-- wachtwoord mag wijzigen, en wijzigt het pas daarna. Zo heeft de service
-- role geen leesrechten op de tabellen nodig.
-- =============================================================================

create function public.password_change_status(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.user_id is null or not p.is_active then 'inactief'
    when p.must_change_password then 'toegestaan'
    else 'niet_nodig'
  end
  from (select 1) as dummy
  left join public.profiles p on p.user_id = p_user
$$;

revoke all on function public.password_change_status(uuid) from public, anon, authenticated;
grant execute on function public.password_change_status(uuid) to service_role;
