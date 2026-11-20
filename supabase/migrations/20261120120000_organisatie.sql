-- =============================================================================
-- Organisatie: afdelingen, functies en takken (projectplanner, fase 1)
--
-- * afdelingen: LDV, Programmering, Staf.
-- * functies: vaste lijst uit de functiestructuur, met een standaardafdeling.
--   De projectplanner plant inzet per functie.
-- * takken: indeling van projecten binnen een afdeling (Digitaal, HR, …).
-- * medewerkers krijgen een afdeling en een functie uit de lijst. Het oude
--   tekstveld functie blijft tot iedereen is ingedeeld; waar de tekst gelijk
--   is aan een functie of afkorting, deelt deze migratie al in.
-- * rol mt (management en directie) en de rechten projectplan.bekijken en
--   projectplan.beheren.
--
-- Lezen: iedereen met app.gebruiken. Wijzigen: projectplan.beheren, via
-- functies die 2FA en het recht eisen en de auditlog schrijven.
-- Zie docs/projectplanner.md.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Rol en rechten
-- -----------------------------------------------------------------------------
insert into public.permissions (id, omschrijving) values
  ('projectplan.bekijken', 'Het jaarplan en het dashboard van de projectplanner bekijken'),
  ('projectplan.beheren',  'Het jaarplan, de projecten en de organisatie (afdelingen, functies, takken) beheren');

-- MT komt direct na de beheerder in de lijst.
update public.roles set volgorde = volgorde + 1 where volgorde >= 2;
insert into public.roles (id, naam, omschrijving, volgorde) values
  ('mt', 'MT', 'Management en directie: beheert het jaarplan en ziet de werkbelasting van iedereen.', 2);

insert into public.role_permissions (role_id, permission_id) values
  ('mt',         'app.gebruiken'),
  ('mt',         'werkbelasting.bekijken'),
  ('mt',         'projectplan.bekijken'),
  ('mt',         'projectplan.beheren'),
  ('beheerder',  'projectplan.bekijken'),
  ('beheerder',  'projectplan.beheren'),
  ('teamleider', 'projectplan.bekijken');

-- -----------------------------------------------------------------------------
-- Tabellen
-- -----------------------------------------------------------------------------
create table public.afdelingen (
  id uuid primary key default gen_random_uuid(),
  naam text not null unique
    check (char_length(btrim(naam)) between 1 and 80),
  afkorting text not null default ''
    check (char_length(afkorting) <= 10),
  volgorde smallint not null default 0
);

create table public.functies (
  id uuid primary key default gen_random_uuid(),
  naam text not null unique
    check (char_length(btrim(naam)) between 1 and 100),
  afkorting text not null default ''
    check (char_length(afkorting) <= 10),
  -- De afdeling waar de functie normaal valt; een medewerker kan afwijken.
  afdeling_id uuid not null references public.afdelingen (id) on delete restrict,
  -- Extern of vrijwilliger: geen contract in de app, dus geen bekende capaciteit.
  extern boolean not null default false,
  actief boolean not null default true
);

-- Een afkorting is uniek, als hij er is.
create unique index functies_afkorting_uniek on public.functies (upper(afkorting)) where afkorting <> '';

create table public.takken (
  id uuid primary key default gen_random_uuid(),
  afdeling_id uuid not null references public.afdelingen (id) on delete restrict,
  naam text not null
    check (char_length(btrim(naam)) between 1 and 80),
  actief boolean not null default true,
  unique (afdeling_id, naam)
);

alter table public.medewerkers
  add column afdeling_id uuid references public.afdelingen (id) on delete restrict,
  add column functie_id uuid references public.functies (id) on delete restrict;

create index medewerkers_afdeling_idx on public.medewerkers (afdeling_id);
create index medewerkers_functie_idx on public.medewerkers (functie_id);

-- -----------------------------------------------------------------------------
-- Startgegevens
-- -----------------------------------------------------------------------------
insert into public.afdelingen (naam, afkorting, volgorde) values
  ('Lokale Dienstverlening', 'LDV',  1),
  ('Programmering',          'PROG', 2),
  ('Staf',                   'STAF', 3);

-- Functiestructuur (bijlage A, 2021), aangevuld met CL en BV uit de
-- projectplanner. De leesmediacoach valt tegenwoordig onder Programmering.
insert into public.functies (naam, afkorting, afdeling_id, extern)
select f.naam, f.afkorting, a.id, f.extern
  from (values
    ('Directeur-bestuurder',                 '',    'STAF', false),
    ('Adviseur Bedrijfsvoering',             '',    'STAF', false),
    ('Backoffice Bedrijfsvoering',           'BV',  'STAF', false),
    ('Adviseur Finance & Control',           '',    'STAF', true),
    ('Adviseur HRM',                         '',    'STAF', true),
    ('Medewerker HRM',                       '',    'STAF', false),
    ('Adviseur Marketing & Communicatie',    '',    'STAF', false),
    ('Medewerker Marketing & Communicatie',  '',    'STAF', false),
    ('Management Assistent',                 '',    'STAF', false),
    ('Manager Lokale Dienstverlening',       '',    'LDV',  false),
    ('Assistent Bibliotheekmedewerker',      '',    'LDV',  false),
    ('Bibliotheekmedewerker',                'BM',  'LDV',  false),
    ('Bibliotheekmedewerker Plus',           '',    'LDV',  false),
    ('Community Librarian',                  'CL',  'LDV',  false),
    ('Vrijwilliger',                         '',    'LDV',  true),
    ('Invalmedewerker',                      '',    'LDV',  true),
    ('Opruimmedewerker',                     '',    'LDV',  true),
    ('Manager Programmering',                '',    'PROG', false),
    ('Programmacoördinator',                 '',    'PROG', false),
    ('Specialist',                           '',    'PROG', false),
    ('Leesmediacoach',                       'LMC', 'PROG', false)
  ) as f (naam, afkorting, afdeling, extern)
  join public.afdelingen a on a.afkorting = f.afdeling;

-- Takken zoals in de projectplanner 2027.
insert into public.takken (afdeling_id, naam)
select a.id, t.naam
  from (values
    ('PROG', 'Doorgaande leeslijn'),
    ('PROG', 'Digitaal'),
    ('PROG', 'IDO'),
    ('PROG', 'Taal'),
    ('PROG', 'Jeugd'),
    ('PROG', 'Volwassenen'),
    ('STAF', 'HR'),
    ('STAF', 'Staf'),
    ('STAF', 'MT'),
    ('STAF', 'IT'),
    ('STAF', 'Projecten'),
    ('STAF', 'MarCom'),
    ('LDV',  'CL'),
    ('LDV',  'Locaties'),
    ('LDV',  'Intern')
  ) as t (afdeling, naam)
  join public.afdelingen a on a.afkorting = t.afdeling;

-- Medewerkers waarvan de functietekst gelijk is aan een functie of afkorting
-- alvast indelen, met de standaardafdeling van die functie.
update public.medewerkers m
   set functie_id = f.id,
       afdeling_id = f.afdeling_id
  from public.functies f
 where m.functie_id is null
   and btrim(m.functie) <> ''
   and (lower(btrim(m.functie)) = lower(f.naam)
        or (f.afkorting <> '' and upper(btrim(m.functie)) = upper(f.afkorting)));

-- -----------------------------------------------------------------------------
-- Rechten op de tabellen
-- -----------------------------------------------------------------------------
alter table public.afdelingen enable row level security;
alter table public.functies   enable row level security;
alter table public.takken     enable row level security;

revoke all on public.afdelingen, public.functies, public.takken from anon, authenticated;
grant select on public.afdelingen, public.functies, public.takken to authenticated;

create policy "Afdelingen lezen" on public.afdelingen for select to authenticated
  using ((select private.authorize('app.gebruiken')));
create policy "Functies lezen" on public.functies for select to authenticated
  using ((select private.authorize('app.gebruiken')));
create policy "Takken lezen" on public.takken for select to authenticated
  using ((select private.authorize('app.gebruiken')));

-- -----------------------------------------------------------------------------
-- Auditlog
--
-- De audittrigger van de werkbelasting krijgt een optioneel voorvoegsel als
-- argument, zodat deze tabellen als "organisatie.<tabel>.<actie>" in de
-- auditlog komen. Zonder argument blijft het "werkbelasting.".
-- -----------------------------------------------------------------------------
create or replace function private.audit_werkbelasting()
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
    coalesce(tg_argv[0], 'werkbelasting') || '.' || tg_table_name || '.' || lower(tg_op),
    null,
    v_details
  );
  return null;
end;
$$;

revoke all on function private.audit_werkbelasting() from public;

create trigger audit after insert or update or delete on public.afdelingen
  for each row execute function private.audit_werkbelasting('organisatie');
create trigger audit after insert or update or delete on public.functies
  for each row execute function private.audit_werkbelasting('organisatie');
create trigger audit after insert or update or delete on public.takken
  for each row execute function private.audit_werkbelasting('organisatie');

-- -----------------------------------------------------------------------------
-- Schrijffuncties (projectplan.beheren)
--
-- Fouten van constraints (23505 dubbel, 23514 ongeldig, 23503 in gebruik) gaan
-- ongewijzigd terug; de frontend vertaalt ze. Bij een id dat niet bestaat: P0002.
-- -----------------------------------------------------------------------------
create function private.vereis_projectplan_beheren()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.authorize('projectplan.beheren') then
    raise exception 'Geen recht om de projectplanner te beheren'
      using errcode = 'insufficient_privilege';
  end if;
end;
$$;

revoke all on function private.vereis_projectplan_beheren() from public;

create function public.afdeling_opslaan(p_id uuid, p_naam text, p_afkorting text)
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
    insert into public.afdelingen (naam, afkorting, volgorde)
    values (btrim(p_naam), coalesce(upper(btrim(p_afkorting)), ''),
            (select coalesce(max(volgorde), 0) + 1 from public.afdelingen))
    returning id into v_id;
  else
    update public.afdelingen
       set naam = btrim(p_naam), afkorting = coalesce(upper(btrim(p_afkorting)), '')
     where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end;
$$;

create function public.functie_opslaan(
  p_id uuid, p_naam text, p_afkorting text, p_afdeling_id uuid, p_extern boolean, p_actief boolean
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
    insert into public.functies (naam, afkorting, afdeling_id, extern, actief)
    values (btrim(p_naam), coalesce(upper(btrim(p_afkorting)), ''), p_afdeling_id,
            coalesce(p_extern, false), coalesce(p_actief, true))
    returning id into v_id;
  else
    update public.functies
       set naam = btrim(p_naam), afkorting = coalesce(upper(btrim(p_afkorting)), ''),
           afdeling_id = p_afdeling_id, extern = coalesce(p_extern, false),
           actief = coalesce(p_actief, true)
     where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end;
$$;

create function public.tak_opslaan(p_id uuid, p_afdeling_id uuid, p_naam text, p_actief boolean)
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
    insert into public.takken (afdeling_id, naam, actief)
    values (p_afdeling_id, btrim(p_naam), coalesce(p_actief, true))
    returning id into v_id;
  else
    update public.takken
       set afdeling_id = p_afdeling_id, naam = btrim(p_naam), actief = coalesce(p_actief, true)
     where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end;
$$;

-- Verwijderen kan alleen zolang niets ernaar verwijst (anders 23503); zet een
-- functie of tak die in gebruik is op inactief.
create function public.organisatie_verwijderen(p_tabel text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aantal integer;
begin
  perform private.vereis_projectplan_beheren();
  if p_tabel is null or p_tabel not in ('afdelingen', 'functies', 'takken') then
    raise exception 'Onbekende tabel' using errcode = 'invalid_parameter_value';
  end if;

  execute format('delete from public.%I where id = $1', p_tabel) using p_id;
  get diagnostics v_aantal = row_count;
  if v_aantal = 0 then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
end;
$$;

-- medewerker_opslaan: afdeling en functie uit de lijst in plaats van het
-- tekstveld. Dat tekstveld blijft ongewijzigd staan tot het verdwijnt.
drop function public.medewerker_opslaan(uuid, text, text, text, uuid, boolean, text);

create function public.medewerker_opslaan(
  p_id uuid, p_naam text, p_email text, p_afdeling_id uuid, p_functie_id uuid,
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
    insert into public.medewerkers (naam, email, afdeling_id, functie_id, user_id, actief, opmerking)
    values (btrim(p_naam), coalesce(lower(btrim(p_email)), ''), p_afdeling_id, p_functie_id,
            p_user_id, coalesce(p_actief, true), coalesce(p_opmerking, ''))
    returning id into v_id;
  else
    update public.medewerkers
       set naam = btrim(p_naam), email = coalesce(lower(btrim(p_email)), ''),
           afdeling_id = p_afdeling_id, functie_id = p_functie_id, user_id = p_user_id,
           actief = coalesce(p_actief, true), opmerking = coalesce(p_opmerking, '')
     where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'Niet gevonden' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.afdeling_opslaan(uuid, text, text)',
    'public.functie_opslaan(uuid, text, text, uuid, boolean, boolean)',
    'public.tak_opslaan(uuid, uuid, text, boolean)',
    'public.organisatie_verwijderen(text, uuid)',
    'public.medewerker_opslaan(uuid, text, text, uuid, uuid, uuid, boolean, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
