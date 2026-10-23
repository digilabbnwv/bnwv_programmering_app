-- =============================================================================
-- Werkbelasting: scholen, staffel, medewerkers, contracten, toewijzingen,
-- projectgroepen en extra uren. Zie docs/werkbelasting.md.
--
-- Lezen: via RLS. Iedereen met app.gebruiken leest scholen, staffel en
-- projectgroepen, en de eigen werkbelasting (medewerker gekoppeld aan het
-- account). werkbelasting.bekijken ziet het hele team.
--
-- Schrijven: alleen via de functies onderaan (security definer). Die eisen het
-- recht werkbelasting.beheren (en dus AAL2). Triggers schrijven elke wijziging
-- naar de auditlog.
-- =============================================================================

create extension if not exists btree_gist with schema extensions;

-- -----------------------------------------------------------------------------
-- Rechten
-- -----------------------------------------------------------------------------
insert into public.permissions (id, omschrijving) values
  ('werkbelasting.bekijken', 'De werkbelasting van het hele team bekijken'),
  ('werkbelasting.beheren',  'Scholen, medewerkers, projectgroepen en staffel beheren');

insert into public.role_permissions (role_id, permission_id) values
  ('beheerder',  'werkbelasting.bekijken'),
  ('beheerder',  'werkbelasting.beheren'),
  ('teamleider', 'werkbelasting.bekijken'),
  ('teamleider', 'werkbelasting.beheren');

-- -----------------------------------------------------------------------------
-- Tabellen
-- -----------------------------------------------------------------------------
create table public.werkjaren (
  jaar smallint primary key
    check (jaar between 2000 and 2100),
  werkweken numeric(4,1) not null default 47
    check (werkweken > 0 and werkweken <= 53),
  mijmer_percentage numeric(5,2) not null default 20
    check (mijmer_percentage between 0 and 100)
);

create table public.programmas (
  id uuid primary key default gen_random_uuid(),
  naam text not null unique
    check (char_length(btrim(naam)) between 1 and 80),
  omschrijving text not null default ''
    check (char_length(omschrijving) <= 1000)
);

insert into public.programmas (naam, omschrijving)
values ('dBos', 'de Bibliotheek op school');

create table public.staffel_schijven (
  id uuid primary key default gen_random_uuid(),
  jaar smallint not null references public.werkjaren (jaar) on delete cascade,
  schoolsoort text not null
    check (schoolsoort in ('PO', 'VO', 'KDV')),
  min_leerlingen integer not null
    check (min_leerlingen >= 0),
  -- null: geen bovengrens
  max_leerlingen integer,
  uren numeric(6,1) not null
    check (uren >= 0),
  check (max_leerlingen >= min_leerlingen),
  -- Schijven binnen een jaar en soort overlappen niet.
  exclude using gist (
    jaar with =,
    schoolsoort with =,
    int4range(min_leerlingen, max_leerlingen, '[]') with &&
  )
);

create table public.scholen (
  id uuid primary key default gen_random_uuid(),
  naam text not null
    check (char_length(btrim(naam)) between 1 and 120),
  soort text not null
    check (soort in ('PO', 'VO', 'KDV')),
  programma_id uuid references public.programmas (id) on delete restrict,
  brin text
    check (brin ~ '^[0-9A-Z]{4}([0-9]{2})?$'),
  adres text not null default '' check (char_length(adres) <= 200),
  postcode text not null default '' check (postcode = '' or postcode ~ '^[1-9][0-9]{3} ?[A-Z]{2}$'),
  plaats text not null default '' check (char_length(plaats) <= 100),
  contactpersoon text not null default '' check (char_length(contactpersoon) <= 120),
  email text not null default '' check (email = '' or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefoon text not null default '' check (char_length(telefoon) <= 30),
  opmerking text not null default '' check (char_length(opmerking) <= 2000),
  actief boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.school_jaargegevens (
  school_id uuid not null references public.scholen (id) on delete cascade,
  jaar smallint not null references public.werkjaren (jaar) on delete cascade,
  leerlingaantal integer not null
    check (leerlingaantal >= 0),
  -- Bijv. +20 voor "inclusief PSZ". Mag negatief.
  uren_correctie numeric(6,1) not null default 0,
  correctie_reden text not null default ''
    check (char_length(correctie_reden) <= 300),
  primary key (school_id, jaar)
);

create table public.medewerkers (
  id uuid primary key default gen_random_uuid(),
  naam text not null
    check (char_length(btrim(naam)) between 1 and 100),
  email text not null default '' check (email = '' or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  functie text not null default '' check (char_length(functie) <= 100),
  -- Optioneel: het inlogaccount van deze medewerker (voor het eigen dashboard).
  user_id uuid unique references auth.users (id) on delete set null,
  actief boolean not null default true,
  opmerking text not null default '' check (char_length(opmerking) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Een contract geldt vanaf de ingangsdatum tot de ingangsdatum van het volgende.
create table public.contracten (
  id uuid primary key default gen_random_uuid(),
  medewerker_id uuid not null references public.medewerkers (id) on delete cascade,
  ingangsdatum date not null,
  uren_per_week numeric(4,1) not null
    check (uren_per_week >= 0 and uren_per_week <= 40),
  -- null: de waarde van het werkjaar
  werkweken numeric(4,1)
    check (werkweken > 0 and werkweken <= 53),
  mijmer_percentage numeric(5,2)
    check (mijmer_percentage between 0 and 100),
  unique (medewerker_id, ingangsdatum)
);

-- Per school één medewerker tegelijk. Einddatum is inclusief; null = lopend.
create table public.school_toewijzingen (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.scholen (id) on delete restrict,
  medewerker_id uuid not null references public.medewerkers (id) on delete restrict,
  startdatum date not null,
  einddatum date,
  check (einddatum >= startdatum),
  exclude using gist (
    school_id with =,
    daterange(startdatum, einddatum, '[]') with &&
  )
);

create index school_toewijzingen_medewerker_idx on public.school_toewijzingen (medewerker_id);

create table public.projectgroepen (
  id uuid primary key default gen_random_uuid(),
  naam text not null
    check (char_length(btrim(naam)) between 1 and 120),
  omschrijving text not null default '' check (char_length(omschrijving) <= 1000),
  startdatum date not null,
  einddatum date,
  check (einddatum >= startdatum),
  trekker_id uuid references public.medewerkers (id) on delete set null
);

create table public.projectgroep_deelnemers (
  id uuid primary key default gen_random_uuid(),
  projectgroep_id uuid not null references public.projectgroepen (id) on delete cascade,
  medewerker_id uuid not null references public.medewerkers (id) on delete restrict,
  uren_per_jaar numeric(6,1) not null
    check (uren_per_jaar >= 0),
  startdatum date not null,
  einddatum date,
  check (einddatum >= startdatum),
  exclude using gist (
    projectgroep_id with =,
    medewerker_id with =,
    daterange(startdatum, einddatum, '[]') with &&
  )
);

create index projectgroep_deelnemers_medewerker_idx on public.projectgroep_deelnemers (medewerker_id);

-- Uren buiten het contract, bijv. NPO-gelden die apart gefactureerd worden.
create table public.extra_uren (
  id uuid primary key default gen_random_uuid(),
  medewerker_id uuid not null references public.medewerkers (id) on delete cascade,
  jaar smallint not null references public.werkjaren (jaar) on delete restrict,
  omschrijving text not null
    check (char_length(btrim(omschrijving)) between 1 and 300),
  uren numeric(6,1) not null
    check (uren >= 0),
  financier text not null default '' check (char_length(financier) <= 120),
  school_id uuid references public.scholen (id) on delete set null
);

create index extra_uren_medewerker_idx on public.extra_uren (medewerker_id);

create table public.werkbelasting_toelichtingen (
  medewerker_id uuid not null references public.medewerkers (id) on delete cascade,
  jaar smallint not null references public.werkjaren (jaar) on delete restrict,
  toelichting text not null default ''
    check (char_length(toelichting) <= 4000),
  status text not null default 'concept'
    check (status in ('concept', 'vastgesteld')),
  vastgesteld_door uuid references auth.users (id) on delete set null,
  vastgesteld_op timestamptz,
  primary key (medewerker_id, jaar),
  check ((status = 'vastgesteld') = (vastgesteld_op is not null))
);

create trigger set_updated_at before update on public.scholen
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.medewerkers
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS en rechten: authenticated mag alleen lezen
-- -----------------------------------------------------------------------------
alter table public.werkjaren                   enable row level security;
alter table public.programmas                  enable row level security;
alter table public.staffel_schijven            enable row level security;
alter table public.scholen                     enable row level security;
alter table public.school_jaargegevens         enable row level security;
alter table public.medewerkers                 enable row level security;
alter table public.contracten                  enable row level security;
alter table public.school_toewijzingen         enable row level security;
alter table public.projectgroepen              enable row level security;
alter table public.projectgroep_deelnemers     enable row level security;
alter table public.extra_uren                  enable row level security;
alter table public.werkbelasting_toelichtingen enable row level security;

revoke all on public.werkjaren, public.programmas, public.staffel_schijven,
              public.scholen, public.school_jaargegevens, public.medewerkers,
              public.contracten, public.school_toewijzingen, public.projectgroepen,
              public.projectgroep_deelnemers, public.extra_uren,
              public.werkbelasting_toelichtingen
  from anon, authenticated;

grant select on public.werkjaren, public.programmas, public.staffel_schijven,
                public.scholen, public.school_jaargegevens, public.medewerkers,
                public.contracten, public.school_toewijzingen, public.projectgroepen,
                public.projectgroep_deelnemers, public.extra_uren,
                public.werkbelasting_toelichtingen
  to authenticated;

-- De medewerker die bij het ingelogde account hoort (of null).
create function private.eigen_medewerker_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id from public.medewerkers m where m.user_id = auth.uid()
$$;

revoke all on function private.eigen_medewerker_id() from public;
grant execute on function private.eigen_medewerker_id() to authenticated;

-- Algemene gegevens: iedereen met app.gebruiken.
create policy "Werkjaren lezen" on public.werkjaren for select to authenticated
  using ((select private.authorize('app.gebruiken')));
create policy "Programma's lezen" on public.programmas for select to authenticated
  using ((select private.authorize('app.gebruiken')));
create policy "Staffel lezen" on public.staffel_schijven for select to authenticated
  using ((select private.authorize('app.gebruiken')));
create policy "Scholen lezen" on public.scholen for select to authenticated
  using ((select private.authorize('app.gebruiken')));
create policy "Schoolgegevens per jaar lezen" on public.school_jaargegevens for select to authenticated
  using ((select private.authorize('app.gebruiken')));
create policy "Projectgroepen lezen" on public.projectgroepen for select to authenticated
  using ((select private.authorize('app.gebruiken')));

-- Persoonlijke gegevens: de eigen rij(en), of alles met werkbelasting.bekijken.
create policy "Eigen medewerker of alle met werkbelasting.bekijken"
  on public.medewerkers for select to authenticated
  using (
    (select private.authorize('werkbelasting.bekijken'))
    or (id = (select private.eigen_medewerker_id()) and (select private.authorize('app.gebruiken')))
  );

create policy "Eigen contracten of alle met werkbelasting.bekijken"
  on public.contracten for select to authenticated
  using (
    (select private.authorize('werkbelasting.bekijken'))
    or (medewerker_id = (select private.eigen_medewerker_id()) and (select private.authorize('app.gebruiken')))
  );

create policy "Eigen toewijzingen of alle met werkbelasting.bekijken"
  on public.school_toewijzingen for select to authenticated
  using (
    (select private.authorize('werkbelasting.bekijken'))
    or (medewerker_id = (select private.eigen_medewerker_id()) and (select private.authorize('app.gebruiken')))
  );

create policy "Eigen deelnames of alle met werkbelasting.bekijken"
  on public.projectgroep_deelnemers for select to authenticated
  using (
    (select private.authorize('werkbelasting.bekijken'))
    or (medewerker_id = (select private.eigen_medewerker_id()) and (select private.authorize('app.gebruiken')))
  );

create policy "Eigen extra uren of alle met werkbelasting.bekijken"
  on public.extra_uren for select to authenticated
  using (
    (select private.authorize('werkbelasting.bekijken'))
    or (medewerker_id = (select private.eigen_medewerker_id()) and (select private.authorize('app.gebruiken')))
  );

create policy "Eigen toelichting of alle met werkbelasting.bekijken"
  on public.werkbelasting_toelichtingen for select to authenticated
  using (
    (select private.authorize('werkbelasting.bekijken'))
    or (medewerker_id = (select private.eigen_medewerker_id()) and (select private.authorize('app.gebruiken')))
  );

-- -----------------------------------------------------------------------------
-- Auditlog: elke wijziging, ook via SQL in het dashboard
-- -----------------------------------------------------------------------------
create function private.audit_werkbelasting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_details jsonb;
begin
  if tg_op = 'DELETE' then
    v_details := jsonb_build_object('oud', to_jsonb(old));
  elsif tg_op = 'INSERT' then
    v_details := jsonb_build_object('nieuw', to_jsonb(new));
  else
    -- Alleen de gewijzigde velden, zodat de regel klein blijft.
    select jsonb_build_object('wijzigingen', coalesce(jsonb_object_agg(n.key, n.value), '{}'::jsonb))
      into v_details
      from jsonb_each(to_jsonb(new)) n
     where to_jsonb(old) -> n.key is distinct from n.value;
    v_details := v_details || jsonb_build_object(
      'sleutel', coalesce(to_jsonb(new) -> 'id', jsonb_build_object(
        'jaar', to_jsonb(new) -> 'jaar',
        'school_id', to_jsonb(new) -> 'school_id',
        'medewerker_id', to_jsonb(new) -> 'medewerker_id'))
    );
  end if;

  perform private.write_audit(
    auth.uid(),
    'werkbelasting.' || tg_table_name || '.' || lower(tg_op),
    null,
    v_details
  );
  return null;
end;
$$;

revoke all on function private.audit_werkbelasting() from public;

do $$
declare
  t text;
begin
  foreach t in array array[
    'werkjaren', 'programmas', 'staffel_schijven', 'scholen', 'school_jaargegevens',
    'medewerkers', 'contracten', 'school_toewijzingen', 'projectgroepen',
    'projectgroep_deelnemers', 'extra_uren', 'werkbelasting_toelichtingen'
  ] loop
    execute format(
      'create trigger audit after insert or update or delete on public.%I
         for each row execute function private.audit_werkbelasting()', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Schrijffuncties (werkbelasting.beheren)
--
-- Elke functie begint met private.vereis_werkbelasting_beheren(). Fouten van
-- constraints (23505 dubbel, 23P01 overlap, 23514 ongeldig, 23503 in gebruik)
-- gaan ongewijzigd terug; de frontend vertaalt ze naar vaste teksten.
-- Bij een id dat niet bestaat: P0002.
-- -----------------------------------------------------------------------------
create function private.vereis_werkbelasting_beheren()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.authorize('werkbelasting.beheren') then
    raise exception 'Geen recht om de werkbelasting te beheren'
      using errcode = 'insufficient_privilege';
  end if;
end;
$$;

revoke all on function private.vereis_werkbelasting_beheren() from public;

create function public.werkjaar_opslaan(p_jaar smallint, p_werkweken numeric, p_mijmer_percentage numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.vereis_werkbelasting_beheren();
  insert into public.werkjaren (jaar, werkweken, mijmer_percentage)
  values (p_jaar, p_werkweken, p_mijmer_percentage)
  on conflict (jaar) do update
    set werkweken = excluded.werkweken,
        mijmer_percentage = excluded.mijmer_percentage;
end;
$$;

create function public.programma_opslaan(p_id uuid, p_naam text, p_omschrijving text)
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
    insert into public.programmas (naam, omschrijving)
    values (btrim(p_naam), coalesce(p_omschrijving, ''))
    returning id into v_id;
  else
    update public.programmas
       set naam = btrim(p_naam), omschrijving = coalesce(p_omschrijving, '')
     where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end;
$$;

create function public.staffel_schijf_opslaan(
  p_id uuid, p_jaar smallint, p_schoolsoort text,
  p_min_leerlingen integer, p_max_leerlingen integer, p_uren numeric
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
    insert into public.staffel_schijven (jaar, schoolsoort, min_leerlingen, max_leerlingen, uren)
    values (p_jaar, p_schoolsoort, p_min_leerlingen, p_max_leerlingen, p_uren)
    returning id into v_id;
  else
    update public.staffel_schijven
       set jaar = p_jaar, schoolsoort = p_schoolsoort, min_leerlingen = p_min_leerlingen,
           max_leerlingen = p_max_leerlingen, uren = p_uren
     where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end;
$$;

create function public.school_opslaan(
  p_id uuid, p_naam text, p_soort text, p_programma_id uuid, p_brin text,
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
      naam, soort, programma_id, brin, adres, postcode, plaats,
      contactpersoon, email, telefoon, opmerking, actief
    ) values (
      btrim(p_naam), p_soort, p_programma_id, nullif(upper(btrim(p_brin)), ''),
      coalesce(btrim(p_adres), ''), coalesce(upper(btrim(p_postcode)), ''), coalesce(btrim(p_plaats), ''),
      coalesce(btrim(p_contactpersoon), ''), coalesce(lower(btrim(p_email)), ''),
      coalesce(btrim(p_telefoon), ''), coalesce(p_opmerking, ''), coalesce(p_actief, true)
    )
    returning id into v_id;
  else
    update public.scholen
       set naam = btrim(p_naam), soort = p_soort, programma_id = p_programma_id,
           brin = nullif(upper(btrim(p_brin)), ''),
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

create function public.school_jaargegevens_opslaan(
  p_school_id uuid, p_jaar smallint, p_leerlingaantal integer,
  p_uren_correctie numeric, p_correctie_reden text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.vereis_werkbelasting_beheren();
  insert into public.school_jaargegevens (school_id, jaar, leerlingaantal, uren_correctie, correctie_reden)
  values (p_school_id, p_jaar, p_leerlingaantal, coalesce(p_uren_correctie, 0), coalesce(btrim(p_correctie_reden), ''))
  on conflict (school_id, jaar) do update
    set leerlingaantal = excluded.leerlingaantal,
        uren_correctie = excluded.uren_correctie,
        correctie_reden = excluded.correctie_reden;
end;
$$;

create function public.medewerker_opslaan(
  p_id uuid, p_naam text, p_email text, p_functie text,
  p_user_id uuid, p_actief boolean, p_opmerking text
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
    insert into public.medewerkers (naam, email, functie, user_id, actief, opmerking)
    values (btrim(p_naam), coalesce(lower(btrim(p_email)), ''), coalesce(btrim(p_functie), ''),
            p_user_id, coalesce(p_actief, true), coalesce(p_opmerking, ''))
    returning id into v_id;
  else
    update public.medewerkers
       set naam = btrim(p_naam), email = coalesce(lower(btrim(p_email)), ''),
           functie = coalesce(btrim(p_functie), ''), user_id = p_user_id,
           actief = coalesce(p_actief, true), opmerking = coalesce(p_opmerking, '')
     where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end;
$$;

create function public.contract_opslaan(
  p_id uuid, p_medewerker_id uuid, p_ingangsdatum date, p_uren_per_week numeric,
  p_werkweken numeric, p_mijmer_percentage numeric
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
    insert into public.contracten (medewerker_id, ingangsdatum, uren_per_week, werkweken, mijmer_percentage)
    values (p_medewerker_id, p_ingangsdatum, p_uren_per_week, p_werkweken, p_mijmer_percentage)
    returning id into v_id;
  else
    update public.contracten
       set ingangsdatum = p_ingangsdatum, uren_per_week = p_uren_per_week,
           werkweken = p_werkweken, mijmer_percentage = p_mijmer_percentage
     where id = p_id and medewerker_id = p_medewerker_id
    returning id into v_id;
    if v_id is null then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end;
$$;

-- Wijst een school vanaf p_startdatum toe aan een medewerker. Een lopende
-- toewijzing eindigt de dag ervoor. Met p_medewerker_id null wordt de school
-- alleen losgekoppeld (geen nieuwe toewijzing).
create function public.school_toewijzen(p_school_id uuid, p_medewerker_id uuid, p_startdatum date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.vereis_werkbelasting_beheren();
  if p_startdatum is null then
    raise exception 'Startdatum ontbreekt' using errcode = 'not_null_violation';
  end if;

  update public.school_toewijzingen
     set einddatum = p_startdatum - 1
   where school_id = p_school_id
     and startdatum < p_startdatum
     and (einddatum is null or einddatum >= p_startdatum);

  if p_medewerker_id is not null then
    insert into public.school_toewijzingen (school_id, medewerker_id, startdatum)
    values (p_school_id, p_medewerker_id, p_startdatum)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- Corrigeert de periode van een bestaande toewijzing.
create function public.toewijzing_wijzigen(p_id uuid, p_startdatum date, p_einddatum date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.vereis_werkbelasting_beheren();
  update public.school_toewijzingen
     set startdatum = p_startdatum, einddatum = p_einddatum
   where id = p_id;
  if not found then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
end;
$$;

create function public.projectgroep_opslaan(
  p_id uuid, p_naam text, p_omschrijving text, p_startdatum date,
  p_einddatum date, p_trekker_id uuid
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
    insert into public.projectgroepen (naam, omschrijving, startdatum, einddatum, trekker_id)
    values (btrim(p_naam), coalesce(p_omschrijving, ''), p_startdatum, p_einddatum, p_trekker_id)
    returning id into v_id;
  else
    update public.projectgroepen
       set naam = btrim(p_naam), omschrijving = coalesce(p_omschrijving, ''),
           startdatum = p_startdatum, einddatum = p_einddatum, trekker_id = p_trekker_id
     where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end;
$$;

create function public.deelnemer_opslaan(
  p_id uuid, p_projectgroep_id uuid, p_medewerker_id uuid, p_uren_per_jaar numeric,
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
    insert into public.projectgroep_deelnemers (projectgroep_id, medewerker_id, uren_per_jaar, startdatum, einddatum)
    values (p_projectgroep_id, p_medewerker_id, p_uren_per_jaar, p_startdatum, p_einddatum)
    returning id into v_id;
  else
    update public.projectgroep_deelnemers
       set medewerker_id = p_medewerker_id, uren_per_jaar = p_uren_per_jaar,
           startdatum = p_startdatum, einddatum = p_einddatum
     where id = p_id and projectgroep_id = p_projectgroep_id
    returning id into v_id;
    if v_id is null then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end;
$$;

create function public.extra_uren_opslaan(
  p_id uuid, p_medewerker_id uuid, p_jaar smallint, p_omschrijving text,
  p_uren numeric, p_financier text, p_school_id uuid
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
    insert into public.extra_uren (medewerker_id, jaar, omschrijving, uren, financier, school_id)
    values (p_medewerker_id, p_jaar, btrim(p_omschrijving), p_uren, coalesce(btrim(p_financier), ''), p_school_id)
    returning id into v_id;
  else
    update public.extra_uren
       set jaar = p_jaar, omschrijving = btrim(p_omschrijving), uren = p_uren,
           financier = coalesce(btrim(p_financier), ''), school_id = p_school_id
     where id = p_id and medewerker_id = p_medewerker_id
    returning id into v_id;
    if v_id is null then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end;
$$;

create function public.toelichting_opslaan(
  p_medewerker_id uuid, p_jaar smallint, p_toelichting text, p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.vereis_werkbelasting_beheren();
  insert into public.werkbelasting_toelichtingen as t (
    medewerker_id, jaar, toelichting, status, vastgesteld_door, vastgesteld_op
  ) values (
    p_medewerker_id, p_jaar, coalesce(p_toelichting, ''), p_status,
    case when p_status = 'vastgesteld' then auth.uid() end,
    case when p_status = 'vastgesteld' then now() end
  )
  on conflict (medewerker_id, jaar) do update
    set toelichting = excluded.toelichting,
        status = excluded.status,
        -- Bij opnieuw vaststellen blijven wie en wanneer van de eerste keer staan.
        vastgesteld_door = case
          when excluded.status = 'concept' then null
          when t.status = 'vastgesteld'
            then t.vastgesteld_door
          else excluded.vastgesteld_door end,
        vastgesteld_op = case
          when excluded.status = 'concept' then null
          when t.status = 'vastgesteld'
            then t.vastgesteld_op
          else excluded.vastgesteld_op end;
end;
$$;

-- Verwijdert één rij uit een van de werkbelastingtabellen met een id-kolom.
create function public.werkbelasting_verwijderen(p_tabel text, p_id uuid)
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
    'school_toewijzingen', 'projectgroepen', 'projectgroep_deelnemers', 'extra_uren'
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
    'public.werkjaar_opslaan(smallint, numeric, numeric)',
    'public.programma_opslaan(uuid, text, text)',
    'public.staffel_schijf_opslaan(uuid, smallint, text, integer, integer, numeric)',
    'public.school_opslaan(uuid, text, text, uuid, text, text, text, text, text, text, text, text, boolean)',
    'public.school_jaargegevens_opslaan(uuid, smallint, integer, numeric, text)',
    'public.medewerker_opslaan(uuid, text, text, text, uuid, boolean, text)',
    'public.contract_opslaan(uuid, uuid, date, numeric, numeric, numeric)',
    'public.school_toewijzen(uuid, uuid, date)',
    'public.toewijzing_wijzigen(uuid, date, date)',
    'public.projectgroep_opslaan(uuid, text, text, date, date, uuid)',
    'public.deelnemer_opslaan(uuid, uuid, uuid, numeric, date, date)',
    'public.extra_uren_opslaan(uuid, uuid, smallint, text, numeric, text, uuid)',
    'public.toelichting_opslaan(uuid, smallint, text, text)',
    'public.werkbelasting_verwijderen(text, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
