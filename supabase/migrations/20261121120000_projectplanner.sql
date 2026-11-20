-- =============================================================================
-- Projectplanner (fase 2): jaarplannen, projecten, projectjaren en inzet
--
-- * jaarplannen: één per jaar, met een fase (wensen, concept, definitief,
--   afgesloten). Definitief maken en afsluiten komen in fase 4 en 8; tot dan
--   zet jaarplan_opslaan alleen wensen of concept.
-- * projecten: het project zoals het MT het plant, met afdeling, tak, indiener
--   en eventueel een programma. Altijd met begin en eind. Bewust een eigen
--   tabel naast projectgroepen: een gepland project hoort pas bij de
--   werkbelasting als de projectgroep start (fase 5 koppelt ze).
-- * projectjaren: een project in een jaarplan, met status en budget. Een project
--   over de jaargrens heeft er twee.
-- * projectjaar_inzet: inzet per functie en fase, met aantal collega's, het
--   totaal aantal uren voor die collega's samen en een periode binnen het jaar
--   en binnen de looptijd van het project.
--
-- Lezen: projectplan.bekijken. Wijzigen: projectplan.beheren, via functies met
-- auditlog. Zie docs/projectplanner.md.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabellen
-- -----------------------------------------------------------------------------
create table public.jaarplannen (
  jaar smallint primary key
    check (jaar between 2000 and 2100),
  fase text not null default 'concept'
    check (fase in ('wensen', 'concept', 'definitief', 'afgesloten')),
  -- Proefjaar: de app draait mee naast de Excel, die leidend is.
  proefjaar boolean not null default false
);

-- Voor de samengestelde verwijzing projecten (tak_id, afdeling_id): een tak
-- hoort altijd bij de afdeling van het project.
alter table public.takken add constraint takken_id_afdeling_uniek unique (id, afdeling_id);

create table public.projecten (
  id uuid primary key default gen_random_uuid(),
  naam text not null
    check (char_length(btrim(naam)) between 1 and 120),
  omschrijving text not null default '' check (char_length(omschrijving) <= 2000),
  afdeling_id uuid not null references public.afdelingen (id) on delete restrict,
  tak_id uuid,
  indiener_id uuid references public.medewerkers (id) on delete set null,
  programma_id uuid references public.programmas (id) on delete set null,
  startdatum date not null,
  einddatum date not null,
  check (einddatum >= startdatum),
  foreign key (tak_id, afdeling_id) references public.takken (id, afdeling_id) on delete restrict
);

create index projecten_afdeling_idx on public.projecten (afdeling_id);
create index projecten_tak_idx on public.projecten (tak_id);

create table public.projectjaren (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projecten (id) on delete cascade,
  jaar smallint not null references public.jaarplannen (jaar) on delete restrict,
  status text not null default 'ingediend'
    check (status in ('ingediend', 'akkoord', 'afgewezen', 'uitgesteld')),
  -- null: nog niet bekend; 0: bewust geen budget.
  budget numeric(12,2) check (budget >= 0),
  toelichting text not null default '' check (char_length(toelichting) <= 2000),
  unique (project_id, jaar)
);

create index projectjaren_jaar_idx on public.projectjaren (jaar);

create table public.projectjaar_inzet (
  id uuid primary key default gen_random_uuid(),
  projectjaar_id uuid not null references public.projectjaren (id) on delete cascade,
  functie_id uuid not null references public.functies (id) on delete restrict,
  fase text not null
    check (fase in ('voorbereiding', 'uitvoering')),
  aantal_collegas smallint not null default 1
    check (aantal_collegas between 1 and 999),
  -- Totaal voor alle collega's samen.
  uren numeric(7,1) not null
    check (uren >= 0),
  startdatum date not null,
  einddatum date not null,
  check (einddatum >= startdatum)
);

create index projectjaar_inzet_projectjaar_idx on public.projectjaar_inzet (projectjaar_id);
create index projectjaar_inzet_functie_idx on public.projectjaar_inzet (functie_id);

-- -----------------------------------------------------------------------------
-- Rechten op de tabellen
-- -----------------------------------------------------------------------------
alter table public.jaarplannen       enable row level security;
alter table public.projecten         enable row level security;
alter table public.projectjaren      enable row level security;
alter table public.projectjaar_inzet enable row level security;

revoke all on public.jaarplannen, public.projecten, public.projectjaren, public.projectjaar_inzet
  from anon, authenticated;
grant select on public.jaarplannen, public.projecten, public.projectjaren, public.projectjaar_inzet
  to authenticated;

create policy "Jaarplannen lezen" on public.jaarplannen for select to authenticated
  using ((select private.authorize('projectplan.bekijken')));
create policy "Projecten lezen" on public.projecten for select to authenticated
  using ((select private.authorize('projectplan.bekijken')));
create policy "Projectjaren lezen" on public.projectjaren for select to authenticated
  using ((select private.authorize('projectplan.bekijken')));
create policy "Inzet lezen" on public.projectjaar_inzet for select to authenticated
  using ((select private.authorize('projectplan.bekijken')));

do $$
declare
  t text;
begin
  foreach t in array array['jaarplannen', 'projecten', 'projectjaren', 'projectjaar_inzet'] loop
    execute format(
      'create trigger audit after insert or update or delete on public.%I
         for each row execute function private.audit_werkbelasting(''projectplan'')', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Controles
--
-- Een projectjaar valt (deels) binnen de looptijd van het project, en een
-- inzetregel valt binnen het jaar én binnen de looptijd. Anders 23514 met een
-- vaste tekst; de frontend controleert hetzelfde vooraf.
-- -----------------------------------------------------------------------------
create function private.controleer_project(p_project_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_project public.projecten;
begin
  select * into v_project from public.projecten where id = p_project_id;
  if not found then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;

  if exists (
    select 1 from public.projectjaren j
     where j.project_id = p_project_id
       and (make_date(j.jaar, 12, 31) < v_project.startdatum or make_date(j.jaar, 1, 1) > v_project.einddatum)
  ) then
    raise exception 'Een jaar van het project valt buiten de looptijd' using errcode = 'check_violation';
  end if;

  if exists (
    select 1
      from public.projectjaar_inzet i
      join public.projectjaren j on j.id = i.projectjaar_id
     where j.project_id = p_project_id
       and (i.startdatum < greatest(v_project.startdatum, make_date(j.jaar, 1, 1))
            or i.einddatum > least(v_project.einddatum, make_date(j.jaar, 12, 31)))
  ) then
    raise exception 'Inzet valt buiten het jaar of de looptijd van het project' using errcode = 'check_violation';
  end if;
end;
$$;

revoke all on function private.controleer_project(uuid) from public;

-- -----------------------------------------------------------------------------
-- Schrijffuncties (projectplan.beheren)
-- -----------------------------------------------------------------------------
create function public.jaarplan_opslaan(p_jaar smallint, p_fase text, p_proefjaar boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.vereis_projectplan_beheren();
  -- Definitief maken en afsluiten krijgen eigen functies (fase 4 en 8).
  if p_fase is null or p_fase not in ('wensen', 'concept') then
    raise exception 'Deze fase kan hier niet worden gekozen' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.jaarplannen where jaar = p_jaar and fase in ('definitief', 'afgesloten')) then
    raise exception 'Dit jaarplan is al definitief' using errcode = 'check_violation';
  end if;
  insert into public.jaarplannen (jaar, fase, proefjaar)
  values (p_jaar, p_fase, coalesce(p_proefjaar, false))
  on conflict (jaar) do update
    set fase = excluded.fase, proefjaar = excluded.proefjaar;
end;
$$;

-- Een nieuw project komt met p_jaar meteen in dat jaarplan (status ingediend),
-- in dezelfde transactie. Bij wijzigen wordt p_jaar genegeerd.
create function public.project_opslaan(
  p_id uuid, p_naam text, p_omschrijving text, p_afdeling_id uuid, p_tak_id uuid,
  p_indiener_id uuid, p_programma_id uuid, p_startdatum date, p_einddatum date, p_jaar smallint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.vereis_projectplan_beheren();
  if p_id is null then
    insert into public.projecten (naam, omschrijving, afdeling_id, tak_id, indiener_id, programma_id, startdatum, einddatum)
    values (btrim(p_naam), coalesce(p_omschrijving, ''), p_afdeling_id, p_tak_id, p_indiener_id,
            p_programma_id, p_startdatum, p_einddatum)
    returning id into v_id;
    if p_jaar is not null then
      insert into public.projectjaren (project_id, jaar) values (v_id, p_jaar);
      perform private.controleer_project(v_id);
    end if;
  else
    update public.projecten
       set naam = btrim(p_naam), omschrijving = coalesce(p_omschrijving, ''),
           afdeling_id = p_afdeling_id, tak_id = p_tak_id, indiener_id = p_indiener_id,
           programma_id = p_programma_id, startdatum = p_startdatum, einddatum = p_einddatum
     where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
    perform private.controleer_project(v_id);
  end if;
  return v_id;
end;
$$;

create function public.projectjaar_opslaan(
  p_id uuid, p_project_id uuid, p_jaar smallint, p_status text, p_budget numeric, p_toelichting text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.vereis_projectplan_beheren();
  if p_id is null then
    insert into public.projectjaren (project_id, jaar, status, budget, toelichting)
    values (p_project_id, p_jaar, coalesce(p_status, 'ingediend'), p_budget, coalesce(p_toelichting, ''))
    returning id into v_id;
  else
    -- Het jaar en het project liggen vast; maak voor een ander jaar een nieuw projectjaar.
    update public.projectjaren
       set status = coalesce(p_status, 'ingediend'), budget = p_budget,
           toelichting = coalesce(p_toelichting, '')
     where id = p_id and project_id = p_project_id and jaar = p_jaar
    returning id into v_id;
    if v_id is null then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
  end if;
  perform private.controleer_project(p_project_id);
  return v_id;
end;
$$;

create function public.inzet_opslaan(
  p_id uuid, p_projectjaar_id uuid, p_functie_id uuid, p_fase text, p_aantal_collegas smallint,
  p_uren numeric, p_startdatum date, p_einddatum date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_project_id uuid;
begin
  perform private.vereis_projectplan_beheren();
  if p_id is null then
    insert into public.projectjaar_inzet (projectjaar_id, functie_id, fase, aantal_collegas, uren, startdatum, einddatum)
    values (p_projectjaar_id, p_functie_id, p_fase, coalesce(p_aantal_collegas, 1), p_uren, p_startdatum, p_einddatum)
    returning id into v_id;
  else
    update public.projectjaar_inzet
       set functie_id = p_functie_id, fase = p_fase, aantal_collegas = coalesce(p_aantal_collegas, 1),
           uren = p_uren, startdatum = p_startdatum, einddatum = p_einddatum
     where id = p_id and projectjaar_id = p_projectjaar_id
    returning id into v_id;
    if v_id is null then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
  end if;
  select project_id into v_project_id from public.projectjaren where id = p_projectjaar_id;
  perform private.controleer_project(v_project_id);
  return v_id;
end;
$$;

-- Verwijderen van een project haalt ook zijn projectjaren en inzet weg; een
-- jaarplan kan alleen weg zolang er geen projectjaren in staan (23503).
create function public.projectplan_verwijderen(p_tabel text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aantal integer;
begin
  perform private.vereis_projectplan_beheren();
  if p_tabel is null or p_tabel not in ('projecten', 'projectjaren', 'projectjaar_inzet') then
    raise exception 'Onbekende tabel' using errcode = 'invalid_parameter_value';
  end if;

  execute format('delete from public.%I where id = $1', p_tabel) using p_id;
  get diagnostics v_aantal = row_count;
  if v_aantal = 0 then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
end;
$$;

create function public.jaarplan_verwijderen(p_jaar smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.vereis_projectplan_beheren();
  delete from public.jaarplannen where jaar = p_jaar;
  if not found then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
end;
$$;

-- Eenmalige import van een concept-jaarplan uit de projectplanner-Excel. De
-- browser leest de Excel en de gebruiker kiest de projecten; het bestand zelf
-- komt niet in de database of de repository.
-- p_projecten is een lijst van
--   { naam, omschrijving, afdeling (afkorting), tak (naam), programma (naam),
--     startdatum, einddatum, budget, toelichting }
-- Alleen in een bestaand, nog leeg jaarplan (anders 23505). Een onbekende
-- afdeling geeft 23503; een onbekende tak of programma wordt leeg gelaten.
-- Elk project krijgt een projectjaar met status ingediend en het budget uit de
-- Excel (of zonder budget).
create function public.jaarplan_importeren(p_jaar smallint, p_projecten jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project jsonb;
  v_afdeling_id uuid;
  v_project_id uuid;
  v_aantal integer := 0;
begin
  perform private.vereis_projectplan_beheren();
  if not exists (select 1 from public.jaarplannen where jaar = p_jaar and fase in ('wensen', 'concept')) then
    raise exception 'Geen jaarplan in concept voor dit jaar' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.projectjaren where jaar = p_jaar) then
    raise exception 'Dit jaarplan heeft al projecten' using errcode = 'unique_violation';
  end if;
  if jsonb_typeof(p_projecten) is distinct from 'array' then
    raise exception 'Ongeldige import' using errcode = 'invalid_parameter_value';
  end if;

  for v_project in select value from jsonb_array_elements(p_projecten) loop
    select id into v_afdeling_id from public.afdelingen where afkorting = v_project ->> 'afdeling';
    if v_afdeling_id is null then
      raise exception 'Onbekende afdeling %', v_project ->> 'afdeling' using errcode = 'foreign_key_violation';
    end if;

    insert into public.projecten (naam, omschrijving, afdeling_id, tak_id, programma_id, startdatum, einddatum)
    values (
      btrim(v_project ->> 'naam'),
      coalesce(v_project ->> 'omschrijving', ''),
      v_afdeling_id,
      (select t.id from public.takken t
        where t.afdeling_id = v_afdeling_id and lower(t.naam) = lower(v_project ->> 'tak')),
      (select p.id from public.programmas p where lower(p.naam) = lower(v_project ->> 'programma')),
      (v_project ->> 'startdatum')::date,
      (v_project ->> 'einddatum')::date
    )
    returning id into v_project_id;

    insert into public.projectjaren (project_id, jaar, budget, toelichting)
    values (v_project_id, p_jaar, (v_project ->> 'budget')::numeric, coalesce(v_project ->> 'toelichting', ''));

    perform private.controleer_project(v_project_id);
    v_aantal := v_aantal + 1;
  end loop;

  return v_aantal;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.jaarplan_opslaan(smallint, text, boolean)',
    'public.project_opslaan(uuid, text, text, uuid, uuid, uuid, uuid, date, date, smallint)',
    'public.projectjaar_opslaan(uuid, uuid, smallint, text, numeric, text)',
    'public.inzet_opslaan(uuid, uuid, uuid, text, smallint, numeric, date, date)',
    'public.projectplan_verwijderen(text, uuid)',
    'public.jaarplan_verwijderen(smallint)',
    'public.jaarplan_importeren(smallint, jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
