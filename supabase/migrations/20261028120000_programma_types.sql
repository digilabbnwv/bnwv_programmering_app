-- =============================================================================
-- Soorten programma's
--
-- Een programma werkt óf met scholen (dBos, BoekStart: uren volgens de
-- staffel), óf met vaste uitvoerders (bijv. Digilabs: een ureninschatting per
-- uitvoerder per jaar, zoals bij overige taken). Nooit allebei.
--
-- Het type wordt afgedwongen met samengestelde foreign keys op (id, type):
-- een school verwijst naar een programma van het type 'scholen', een
-- uitvoerder naar een van het type 'uitvoerders'. Zo kan het type ook pas
-- wijzigen als er geen scholen of uitvoerders meer aan hangen (23503).
--
-- Elke school valt voortaan onder een programma.
-- =============================================================================

do $$
begin
  if exists (select 1 from public.scholen where programma_id is null) then
    raise exception 'Er zijn scholen zonder programma. Kies eerst bij elke school een programma.';
  end if;
end;
$$;

alter table public.programmas
  add column type text not null default 'scholen'
    check (type in ('scholen', 'uitvoerders')),
  add constraint programmas_id_type_key unique (id, type);

alter table public.scholen
  alter column programma_id set not null,
  add column programma_type text not null default 'scholen'
    check (programma_type = 'scholen'),
  drop constraint scholen_programma_id_fkey,
  add constraint scholen_programma_fkey foreign key (programma_id, programma_type)
    references public.programmas (id, type) on delete restrict;

create table public.programma_uitvoerders (
  id uuid primary key default gen_random_uuid(),
  programma_id uuid not null,
  programma_type text not null default 'uitvoerders'
    check (programma_type = 'uitvoerders'),
  medewerker_id uuid not null references public.medewerkers (id) on delete restrict,
  uren_per_jaar numeric(6,1) not null
    check (uren_per_jaar >= 0),
  startdatum date not null,
  einddatum date,
  check (einddatum >= startdatum),
  foreign key (programma_id, programma_type)
    references public.programmas (id, type) on delete cascade,
  exclude using gist (
    programma_id with =,
    medewerker_id with =,
    daterange(startdatum, einddatum, '[]') with &&
  )
);

create index programma_uitvoerders_medewerker_idx on public.programma_uitvoerders (medewerker_id);

alter table public.programma_uitvoerders enable row level security;

revoke all on public.programma_uitvoerders from anon, authenticated;
grant select on public.programma_uitvoerders to authenticated;

create policy "Eigen programma-uitvoering of alle met werkbelasting.bekijken"
  on public.programma_uitvoerders for select to authenticated
  using (
    (select private.authorize('werkbelasting.bekijken'))
    or (medewerker_id = (select private.eigen_medewerker_id()) and (select private.authorize('app.gebruiken')))
  );

create trigger audit after insert or update or delete on public.programma_uitvoerders
  for each row execute function private.audit_werkbelasting();

-- -----------------------------------------------------------------------------
-- Schrijffuncties (werkbelasting.beheren)
-- -----------------------------------------------------------------------------
drop function public.programma_opslaan(uuid, text, text);

create function public.programma_opslaan(p_id uuid, p_naam text, p_omschrijving text, p_type text)
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
    insert into public.programmas (naam, omschrijving, type)
    values (btrim(p_naam), coalesce(p_omschrijving, ''), p_type)
    returning id into v_id;
  else
    update public.programmas
       set naam = btrim(p_naam), omschrijving = coalesce(p_omschrijving, ''), type = p_type
     where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end;
$$;

create function public.programma_uitvoerder_opslaan(
  p_id uuid, p_programma_id uuid, p_medewerker_id uuid, p_uren_per_jaar numeric,
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
    insert into public.programma_uitvoerders (programma_id, medewerker_id, uren_per_jaar, startdatum, einddatum)
    values (p_programma_id, p_medewerker_id, p_uren_per_jaar, p_startdatum, p_einddatum)
    returning id into v_id;
  else
    update public.programma_uitvoerders
       set medewerker_id = p_medewerker_id, uren_per_jaar = p_uren_per_jaar,
           startdatum = p_startdatum, einddatum = p_einddatum
     where id = p_id and programma_id = p_programma_id
    returning id into v_id;
    if v_id is null then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end;
$$;

-- Zoals taak_overdragen: de huidige uitvoerder stopt de dag vóór p_datum, de
-- collega neemt dezelfde uren over, met een eventuele einddatum.
create function public.programma_overdragen(p_uitvoerder_id uuid, p_naar_medewerker_id uuid, p_datum date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_oud public.programma_uitvoerders;
  v_id uuid;
begin
  perform private.vereis_werkbelasting_beheren();
  select * into v_oud from public.programma_uitvoerders where id = p_uitvoerder_id for update;
  if not found then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
  if p_datum is null or p_datum <= v_oud.startdatum
     or (v_oud.einddatum is not null and p_datum > v_oud.einddatum) then
    raise exception 'De overdrachtsdatum valt niet binnen de periode van de uitvoerder'
      using errcode = 'check_violation';
  end if;
  if p_naar_medewerker_id = v_oud.medewerker_id then
    raise exception 'Overdragen aan dezelfde medewerker' using errcode = 'check_violation';
  end if;

  update public.programma_uitvoerders set einddatum = p_datum - 1 where id = v_oud.id;

  insert into public.programma_uitvoerders (programma_id, medewerker_id, uren_per_jaar, startdatum, einddatum)
  values (v_oud.programma_id, p_naar_medewerker_id, v_oud.uren_per_jaar, p_datum, v_oud.einddatum)
  returning id into v_id;
  return v_id;
end;
$$;

-- Verwijderen: dezelfde functie, met de nieuwe tabel erbij.
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
    'taken', 'taak_uitvoerders', 'programma_uitvoerders'
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
    'public.programma_opslaan(uuid, text, text, text)',
    'public.programma_uitvoerder_opslaan(uuid, uuid, uuid, numeric, date, date)',
    'public.programma_overdragen(uuid, uuid, date)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
