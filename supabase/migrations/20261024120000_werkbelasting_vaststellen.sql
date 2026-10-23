-- =============================================================================
-- Werkbelasting vaststellen
--
-- Toelichting en status worden apart gewijzigd. Bij vaststellen worden de
-- totalen van dat moment bewaard (uren per onderdeel), zodat de rapportage kan
-- laten zien dat de gegevens na het vaststellen nog zijn veranderd. Klein
-- gehouden: de auditlog bewaart de hele rij (max. 8 kB).
-- =============================================================================

alter table public.werkbelasting_toelichtingen
  add column totalen jsonb
    check (totalen is null or (jsonb_typeof(totalen) = 'object' and pg_column_size(totalen) <= 2048));

drop function public.toelichting_opslaan(uuid, smallint, text, text);

-- Wijzigt alleen de tekst; de status blijft zoals hij is.
create function public.toelichting_opslaan(p_medewerker_id uuid, p_jaar smallint, p_toelichting text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.vereis_werkbelasting_beheren();
  insert into public.werkbelasting_toelichtingen (medewerker_id, jaar, toelichting)
  values (p_medewerker_id, p_jaar, coalesce(p_toelichting, ''))
  on conflict (medewerker_id, jaar) do update
    set toelichting = excluded.toelichting;
end;
$$;

create function public.werkbelasting_vaststellen(p_medewerker_id uuid, p_jaar smallint, p_totalen jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.vereis_werkbelasting_beheren();
  if p_totalen is null then
    raise exception 'Totalen ontbreken' using errcode = 'not_null_violation';
  end if;
  insert into public.werkbelasting_toelichtingen as t (
    medewerker_id, jaar, status, vastgesteld_door, vastgesteld_op, totalen
  ) values (
    p_medewerker_id, p_jaar, 'vastgesteld', auth.uid(), now(), p_totalen
  )
  on conflict (medewerker_id, jaar) do update
    set status = 'vastgesteld',
        vastgesteld_door = auth.uid(),
        vastgesteld_op = now(),
        totalen = excluded.totalen;
end;
$$;

create function public.werkbelasting_heropenen(p_medewerker_id uuid, p_jaar smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.vereis_werkbelasting_beheren();
  update public.werkbelasting_toelichtingen
     set status = 'concept', vastgesteld_door = null, vastgesteld_op = null, totalen = null
   where medewerker_id = p_medewerker_id and jaar = p_jaar;
  if not found then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.toelichting_opslaan(uuid, smallint, text)',
    'public.werkbelasting_vaststellen(uuid, smallint, jsonb)',
    'public.werkbelasting_heropenen(uuid, smallint)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
