-- =============================================================================
-- MATT projectnummer bij projectgroepen
--
-- Zoals bij scholen: een vrij tekstveld (optioneel). projectgroep_opslaan
-- krijgt er een parameter bij, dus de oude functie gaat weg en komt terug met
-- de nieuwe handtekening.
-- =============================================================================

alter table public.projectgroepen
  add column matt_projectnummer text not null default ''
    check (char_length(matt_projectnummer) <= 30);

drop function public.projectgroep_opslaan(uuid, text, text, date, date, uuid);

create function public.projectgroep_opslaan(
  p_id uuid, p_naam text, p_omschrijving text, p_matt_projectnummer text,
  p_startdatum date, p_einddatum date, p_trekker_id uuid
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
    insert into public.projectgroepen (naam, omschrijving, matt_projectnummer, startdatum, einddatum, trekker_id)
    values (btrim(p_naam), coalesce(p_omschrijving, ''), coalesce(btrim(p_matt_projectnummer), ''),
            p_startdatum, p_einddatum, p_trekker_id)
    returning id into v_id;
  else
    update public.projectgroepen
       set naam = btrim(p_naam), omschrijving = coalesce(p_omschrijving, ''),
           matt_projectnummer = coalesce(btrim(p_matt_projectnummer), ''),
           startdatum = p_startdatum, einddatum = p_einddatum, trekker_id = p_trekker_id
     where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end;
$$;

revoke all on function public.projectgroep_opslaan(uuid, text, text, text, date, date, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.projectgroep_opslaan(uuid, text, text, text, date, date, uuid)
  to authenticated;
