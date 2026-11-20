-- =============================================================================
-- Projectplanner (fase 4): jaarplan definitief maken, van project naar
-- projectgroep
--
-- * Definitief maken bewaart een momentopname van alle projectjaren met hun
--   status, budget en inzet, zodat latere wijzigingen als afwijking te zien zijn.
-- * Elk project met status akkoord krijgt daarbij een projectgroep, gekoppeld
--   via projectgroepen.project_id. Bestaat de projectgroep al, dan kan de
--   gebruiker die koppelen in plaats van een nieuwe te maken. Daarna loopt alles
--   via de bestaande werkbelasting: deelnemers, uren en signalen.
-- * Na definitief blijft wijzigen mogelijk; de pagina toont de afwijkingen.
--   "Terug naar concept" heft de vaststelling op; projectgroepen blijven staan.
-- * project_naar_projectgroep: voor een project dat later akkoord wordt.
--
-- Rechten: projectplan.beheren. Zie docs/projectplanner.md.
-- =============================================================================

alter table public.jaarplannen
  add column vastgesteld_op timestamptz,
  add column vastgesteld_door uuid references auth.users (id) on delete set null,
  -- Bewaard bij vaststellen: de naam is voor iedereen met projectplan.bekijken
  -- leesbaar, de profielen niet.
  add column vastgesteld_door_naam text not null default '' check (char_length(vastgesteld_door_naam) <= 100),
  add column momentopname jsonb;

alter table public.projectgroepen
  add column project_id uuid unique references public.projecten (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Hulpfuncties
-- -----------------------------------------------------------------------------

-- Maakt een projectgroep voor het project, of koppelt de opgegeven bestaande
-- projectgroep. Heeft het project al een projectgroep, dan gebeurt er niets.
-- Geeft het id van de projectgroep terug.
create function private.projectgroep_voor_project(p_project_id uuid, p_projectgroep_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projecten;
  v_id uuid;
begin
  select id into v_id from public.projectgroepen where project_id = p_project_id;
  if v_id is not null then return v_id; end if;

  select * into v_project from public.projecten where id = p_project_id;
  if not found then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;

  if p_projectgroep_id is not null then
    update public.projectgroepen set project_id = p_project_id
     where id = p_projectgroep_id and project_id is null
    returning id into v_id;
    if v_id is null then
      raise exception 'Deze projectgroep bestaat niet of hoort al bij een ander project' using errcode = 'P0002';
    end if;
    return v_id;
  end if;

  insert into public.projectgroepen (naam, omschrijving, startdatum, einddatum, project_id)
  values (v_project.naam, left(v_project.omschrijving, 1000), v_project.startdatum, v_project.einddatum, p_project_id)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function private.projectgroep_voor_project(uuid, uuid) from public;

-- -----------------------------------------------------------------------------
-- Schrijffuncties (projectplan.beheren)
-- -----------------------------------------------------------------------------

-- p_koppelingen: lijst van { project_id, projectgroep_id } voor akkoord
-- projecten die een bestaande projectgroep krijgen. Akkoord projecten die er
-- niet in staan, krijgen een nieuwe. Geeft het aantal nieuwe projectgroepen.
create function public.jaarplan_definitief(p_jaar smallint, p_koppelingen jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_nieuw integer := 0;
  v_had boolean;
begin
  perform private.vereis_projectplan_beheren();
  if not exists (select 1 from public.jaarplannen where jaar = p_jaar and fase in ('wensen', 'concept')) then
    raise exception 'Geen jaarplan in concept voor dit jaar' using errcode = 'P0002';
  end if;

  for v_project_id in
    select j.project_id from public.projectjaren j
     where j.jaar = p_jaar and j.status = 'akkoord'
  loop
    v_had := exists (select 1 from public.projectgroepen where project_id = v_project_id);
    perform private.projectgroep_voor_project(
      v_project_id,
      (select (k ->> 'projectgroep_id')::uuid
         from jsonb_array_elements(coalesce(p_koppelingen, '[]'::jsonb)) k
        where (k ->> 'project_id')::uuid = v_project_id
        limit 1)
    );
    if not v_had and not exists (
      select 1 from jsonb_array_elements(coalesce(p_koppelingen, '[]'::jsonb)) k
       where (k ->> 'project_id')::uuid = v_project_id and k ->> 'projectgroep_id' is not null
    ) then
      v_nieuw := v_nieuw + 1;
    end if;
  end loop;

  update public.jaarplannen
     set fase = 'definitief',
         vastgesteld_op = now(),
         vastgesteld_door = auth.uid(),
         vastgesteld_door_naam = coalesce((select weergavenaam from public.profiles where user_id = auth.uid()), ''),
         momentopname = (
           select coalesce(jsonb_agg(jsonb_build_object(
                    'project_id', p.id,
                    'naam', p.naam,
                    'afdeling_id', p.afdeling_id,
                    'status', j.status,
                    'budget', j.budget,
                    'inzet', coalesce((
                      select jsonb_agg(jsonb_build_object(
                               'functie_id', i.functie_id, 'fase', i.fase, 'uren', i.uren,
                               'startdatum', i.startdatum, 'einddatum', i.einddatum)
                             order by i.startdatum, i.functie_id)
                        from public.projectjaar_inzet i where i.projectjaar_id = j.id), '[]'::jsonb)
                  ) order by p.naam), '[]'::jsonb)
             from public.projectjaren j
             join public.projecten p on p.id = j.project_id
            where j.jaar = p_jaar)
   where jaar = p_jaar;

  return v_nieuw;
end;
$$;

-- Terug naar concept: de vaststelling en momentopname vervallen. Projectgroepen
-- blijven staan, want er kunnen al collega's aan gekoppeld zijn.
create function public.jaarplan_heropenen(p_jaar smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.vereis_projectplan_beheren();
  update public.jaarplannen
     set fase = 'concept', vastgesteld_op = null, vastgesteld_door = null,
         vastgesteld_door_naam = '', momentopname = null
   where jaar = p_jaar and fase = 'definitief';
  if not found then raise exception 'Geen definitief jaarplan voor dit jaar' using errcode = 'P0002'; end if;
end;
$$;

-- Voor een project dat na het vaststellen akkoord wordt: een nieuwe of een
-- bestaande projectgroep. Alleen voor een project dat ergens akkoord is.
create function public.project_naar_projectgroep(p_project_id uuid, p_projectgroep_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.vereis_projectplan_beheren();
  if not exists (select 1 from public.projectjaren where project_id = p_project_id and status = 'akkoord') then
    raise exception 'Alleen een project met status akkoord krijgt een projectgroep' using errcode = 'check_violation';
  end if;
  return private.projectgroep_voor_project(p_project_id, p_projectgroep_id);
end;
$$;

-- Wijzigingen aan het jaarplan zelf (definitief, terug naar concept) staan al in
-- de auditlog via de trigger op jaarplannen; het koppelen van projectgroepen via
-- de trigger op projectgroepen.

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.jaarplan_definitief(smallint, jsonb)',
    'public.jaarplan_heropenen(smallint)',
    'public.project_naar_projectgroep(uuid, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
