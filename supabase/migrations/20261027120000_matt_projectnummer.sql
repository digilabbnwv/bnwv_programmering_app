-- =============================================================================
-- MATT projectnummer bij scholen
--
-- Vrij tekstveld (optioneel). school_opslaan krijgt er een parameter bij, dus
-- de oude functie gaat weg en komt terug met de nieuwe handtekening.
-- =============================================================================

alter table public.scholen
  add column matt_projectnummer text not null default ''
    check (char_length(matt_projectnummer) <= 30);

drop function public.school_opslaan(uuid, text, text, uuid, text, text, text, text, text, text, text, text, boolean);

create function public.school_opslaan(
  p_id uuid, p_naam text, p_soort text, p_programma_id uuid, p_brin text,
  p_matt_projectnummer text,
  p_adres text, p_postcode text, p_plaats text, p_contactpersoon text,
  p_email text, p_telefoon text, p_opmerking text, p_actief boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.vereis_werkbelasting_beheren();
  if p_id is null then
    insert into public.scholen (
      naam, soort, programma_id, brin, matt_projectnummer, adres, postcode, plaats,
      contactpersoon, email, telefoon, opmerking, actief
    ) values (
      btrim(p_naam), p_soort, p_programma_id, nullif(upper(btrim(p_brin)), ''),
      coalesce(btrim(p_matt_projectnummer), ''),
      coalesce(btrim(p_adres), ''), coalesce(upper(btrim(p_postcode)), ''), coalesce(btrim(p_plaats), ''),
      coalesce(btrim(p_contactpersoon), ''), coalesce(lower(btrim(p_email)), ''),
      coalesce(btrim(p_telefoon), ''), coalesce(p_opmerking, ''), coalesce(p_actief, true)
    )
    returning id into v_id;
  else
    update public.scholen
       set naam = btrim(p_naam), soort = p_soort, programma_id = p_programma_id,
           brin = nullif(upper(btrim(p_brin)), ''),
           matt_projectnummer = coalesce(btrim(p_matt_projectnummer), ''),
           adres = coalesce(btrim(p_adres), ''), postcode = coalesce(upper(btrim(p_postcode)), ''),
           plaats = coalesce(btrim(p_plaats), ''), contactpersoon = coalesce(btrim(p_contactpersoon), ''),
           email = coalesce(lower(btrim(p_email)), ''), telefoon = coalesce(btrim(p_telefoon), ''),
           opmerking = coalesce(p_opmerking, ''), actief = coalesce(p_actief, true)
     where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end;
$$;

revoke all on function public.school_opslaan(uuid, text, text, uuid, text, text, text, text, text, text, text, text, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.school_opslaan(uuid, text, text, uuid, text, text, text, text, text, text, text, text, text, boolean)
  to authenticated;
