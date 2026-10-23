-- =============================================================================
-- Overige taken
--
-- Taken buiten scholen en projectgroepen (bijv. coördinatie, BHV), met per
-- uitvoerder een ureninschatting en een periode. Een taak kan meerdere
-- uitvoerders tegelijk hebben, net als een projectgroep. Overdragen = de ene
-- uitvoerder laten stoppen en een ander laten beginnen (taak_overdragen).
--
-- Rechten en audit zoals de rest van de werkbelasting.
-- =============================================================================

create table public.taken (
  id uuid primary key default gen_random_uuid(),
  naam text not null
    check (char_length(btrim(naam)) between 1 and 120),
  omschrijving text not null default '' check (char_length(omschrijving) <= 1000),
  startdatum date not null,
  einddatum date,
  check (einddatum >= startdatum)
);

create table public.taak_uitvoerders (
  id uuid primary key default gen_random_uuid(),
  taak_id uuid not null references public.taken (id) on delete cascade,
  medewerker_id uuid not null references public.medewerkers (id) on delete restrict,
  uren_per_jaar numeric(6,1) not null
    check (uren_per_jaar >= 0),
  startdatum date not null,
  einddatum date,
  check (einddatum >= startdatum),
  exclude using gist (
    taak_id with =,
    medewerker_id with =,
    daterange(startdatum, einddatum, '[]') with &&
  )
);

create index taak_uitvoerders_medewerker_idx on public.taak_uitvoerders (medewerker_id);

alter table public.taken            enable row level security;
alter table public.taak_uitvoerders enable row level security;

revoke all on public.taken, public.taak_uitvoerders from anon, authenticated;
grant select on public.taken, public.taak_uitvoerders to authenticated;

create policy "Taken lezen" on public.taken for select to authenticated
  using ((select private.authorize('app.gebruiken')));

create policy "Eigen taken of alle met werkbelasting.bekijken"
  on public.taak_uitvoerders for select to authenticated
  using (
    (select private.authorize('werkbelasting.bekijken'))
    or (medewerker_id = (select private.eigen_medewerker_id()) and (select private.authorize('app.gebruiken')))
  );

create trigger audit after insert or update or delete on public.taken
  for each row execute function private.audit_werkbelasting();
create trigger audit after insert or update or delete on public.taak_uitvoerders
  for each row execute function private.audit_werkbelasting();

-- -----------------------------------------------------------------------------
-- Schrijffuncties (werkbelasting.beheren)
-- -----------------------------------------------------------------------------
create function public.taak_opslaan(
  p_id uuid, p_naam text, p_omschrijving text, p_startdatum date, p_einddatum date
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
    insert into public.taken (naam, omschrijving, startdatum, einddatum)
    values (btrim(p_naam), coalesce(p_omschrijving, ''), p_startdatum, p_einddatum)
    returning id into v_id;
  else
    update public.taken
       set naam = btrim(p_naam), omschrijving = coalesce(p_omschrijving, ''),
           startdatum = p_startdatum, einddatum = p_einddatum
     where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end;
$$;

create function public.uitvoerder_opslaan(
  p_id uuid, p_taak_id uuid, p_medewerker_id uuid, p_uren_per_jaar numeric,
  p_startdatum date, p_einddatum date
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
    insert into public.taak_uitvoerders (taak_id, medewerker_id, uren_per_jaar, startdatum, einddatum)
    values (p_taak_id, p_medewerker_id, p_uren_per_jaar, p_startdatum, p_einddatum)
    returning id into v_id;
  else
    update public.taak_uitvoerders
       set medewerker_id = p_medewerker_id, uren_per_jaar = p_uren_per_jaar,
           startdatum = p_startdatum, einddatum = p_einddatum
     where id = p_id and taak_id = p_taak_id
    returning id into v_id;
    if v_id is null then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end;
$$;

-- Draagt het deel van één uitvoerder vanaf p_datum over aan een collega, met
-- dezelfde uren. De huidige uitvoerder stopt de dag ervoor. Een eventuele
-- einddatum gaat mee naar de nieuwe uitvoerder.
create function public.taak_overdragen(p_uitvoerder_id uuid, p_naar_medewerker_id uuid, p_datum date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_oud public.taak_uitvoerders;
  v_id uuid;
begin
  perform private.vereis_werkbelasting_beheren();
  select * into v_oud from public.taak_uitvoerders where id = p_uitvoerder_id for update;
  if not found then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
  if p_datum is null or p_datum <= v_oud.startdatum
     or (v_oud.einddatum is not null and p_datum > v_oud.einddatum) then
    raise exception 'De overdrachtsdatum valt niet binnen de periode van de uitvoerder'
      using errcode = 'check_violation';
  end if;
  if p_naar_medewerker_id = v_oud.medewerker_id then
    raise exception 'Overdragen aan dezelfde medewerker' using errcode = 'check_violation';
  end if;

  update public.taak_uitvoerders set einddatum = p_datum - 1 where id = v_oud.id;

  insert into public.taak_uitvoerders (taak_id, medewerker_id, uren_per_jaar, startdatum, einddatum)
  values (v_oud.taak_id, p_naar_medewerker_id, v_oud.uren_per_jaar, p_datum, v_oud.einddatum)
  returning id into v_id;
  return v_id;
end;
$$;

-- Verwijderen: dezelfde functie, met de twee nieuwe tabellen erbij.
create or replace function public.werkbelasting_verwijderen(p_tabel text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aantal integer;
begin
  perform private.vereis_werkbelasting_beheren();
  if p_tabel is null or p_tabel not in (
    'programmas', 'staffel_schijven', 'scholen', 'medewerkers', 'contracten',
    'school_toewijzingen', 'projectgroepen', 'projectgroep_deelnemers', 'extra_uren',
    'taken', 'taak_uitvoerders'
  ) then
    raise exception 'Onbekende tabel' using errcode = 'invalid_parameter_value';
  end if;

  execute format('delete from public.%I where id = $1', p_tabel) using p_id;
  get diagnostics v_aantal = row_count;
  if v_aantal = 0 then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.taak_opslaan(uuid, text, text, date, date)',
    'public.uitvoerder_opslaan(uuid, uuid, uuid, numeric, date, date)',
    'public.taak_overdragen(uuid, uuid, date)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
