-- =============================================================================
-- DUO: ophalen via GitHub Actions in plaats van vanuit de database
--
-- DUO verbreekt verbindingen die vanuit Supabase komen (OpenSSL SSL_read:
-- SSL_ERROR_SYSCALL), ook naar duo.nl; vanaf GitHub Actions werkt het wel.
-- Daarom haalt een geplande workflow (.github/workflows/duo-ophalen.yml) de
-- gegevens op en stuurt ze naar de Edge Function duo-verwerken, die deze
-- functies met de service role aanroept. De verwerking zelf blijft gelijk
-- (werkjaar = peiljaar + 1, alleen lege, overgenomen en DUO-aantallen).
--
-- Weg: de maandelijkse pg_cron-job, het ophalen met de extensie http en de
-- knop-functie public.duo_ophalen().
-- =============================================================================

select cron.unschedule('duo-leerlingaantallen')
 where exists (select 1 from cron.job where jobname = 'duo-leerlingaantallen');

drop function public.duo_ophalen();
drop function private.duo_ophalen(uuid);
drop function private.duo_records(text, jsonb);
drop extension if exists http;

-- Wat de workflow bij DUO moet opvragen: de instellingen (BRIN4) van actieve
-- scholen en per werkjaar het peiljaar ervoor.
create function public.duo_te_vragen()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'instellingen', coalesce((select jsonb_agg(distinct left(brin, 4) order by left(brin, 4))
                                from public.scholen where brin is not null and actief), '[]'::jsonb),
    'peiljaren', coalesce((select jsonb_agg(jaar - 1 order by jaar) from public.werkjaren), '[]'::jsonb)
  )
$$;

-- Verwerkt wat de workflow bij DUO heeft opgehaald en legt de ronde vast. Een
-- fout breekt de verwerking af (niets half) en komt als melding in het logboek.
create function public.duo_verwerken(p_tellingen jsonb, p_vestigingen jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ronde public.duo_ophaalrondes;
  v_ingevuld integer;
  v_vestigingen integer;
begin
  begin
    v_ingevuld := private.duo_tellingen_verwerken(coalesce(p_tellingen, '[]'::jsonb));
    v_vestigingen := private.duo_vestigingen_verwerken(p_vestigingen);

    insert into public.duo_ophaalrondes (gelukt, tellingen, vestigingen, ingevuld)
    values (true, coalesce(jsonb_array_length(p_tellingen), 0), v_vestigingen, v_ingevuld)
    returning * into v_ronde;
  exception when others then
    insert into public.duo_ophaalrondes (gelukt, melding)
    values (false, left(sqlerrm, 500))
    returning * into v_ronde;
  end;
  return to_jsonb(v_ronde);
end;
$$;

-- Ophalen bij DUO mislukte in de workflow: alleen vastleggen.
create function public.duo_mislukt(p_melding text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  insert into public.duo_ophaalrondes (gelukt, melding)
  values (false, left(coalesce(nullif(btrim(p_melding), ''), 'onbekende fout'), 500))
  returning to_jsonb(duo_ophaalrondes.*)
$$;

revoke all on function public.duo_te_vragen() from public, anon, authenticated, service_role;
revoke all on function public.duo_verwerken(jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.duo_mislukt(text) from public, anon, authenticated, service_role;
grant execute on function public.duo_te_vragen() to service_role;
grant execute on function public.duo_verwerken(jsonb, jsonb) to service_role;
grant execute on function public.duo_mislukt(text) to service_role;
