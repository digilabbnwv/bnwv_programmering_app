-- =============================================================================
-- Leerlingaantallen uit de open onderwijsdata van DUO
--
-- Bron: onderwijsdata.duo.nl (CKAN, open API zonder sleutel, licentie CC-BY,
-- vermeld "Bron: DUO").
-- - Leerlingen po per vestiging: telling op 1 oktober per BRIN6 en peiljaar,
--   jaarlijks gepubliceerd in januari. Bevat ook (V)SO. Aantallen 1 t/m 4
--   staan er als -1 in (AVG); die slaan we op als onbekend (null).
-- - Vestigingen bo en so (maandelijks bijgewerkt): naam en adres, om bij
--   scholen zonder BRIN een BRIN voor te stellen.
--
-- Afspraken:
-- - Werkjaar = peiljaar + 1: de telling van 1 oktober 2025 (gepubliceerd in
--   januari 2026) hoort bij werkjaar 2026. Zo is het aantal er aan het begin
--   van het werkjaar, en het kalenderjaar valt grotendeels (januari t/m juli)
--   in het schooljaar van die telling.
-- - DUO vult alleen lege of 'overgenomen' aantallen in, en werkt eerder van
--   DUO gekomen aantallen bij. Met de hand ingevoerde aantallen blijven staan;
--   de app toont dan het verschil met DUO.
-- - Een BRIN van 4 tekens is de hoofdvestiging (BRIN + 00).
-- - Ophalen gebeurt in de database (extensie http): met de knop in de app en
--   elke maand automatisch (pg_cron). Daar zijn geen sleutels voor nodig.
-- =============================================================================

create extension if not exists http with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- -----------------------------------------------------------------------------
-- Tabellen
-- -----------------------------------------------------------------------------
create table public.duo_leerlingaantallen (
  vestigingscode text not null check (vestigingscode ~ '^[0-9A-Z]{4}[0-9]{2}$'),
  peiljaar smallint not null check (peiljaar between 2000 and 2100),
  type_po text not null default '',
  -- null: 1 t/m 4 leerlingen (door DUO afgeschermd)
  aantal integer check (aantal >= 0),
  opgehaald_op timestamptz not null default now(),
  primary key (vestigingscode, peiljaar)
);

create table public.duo_vestigingen (
  vestigingscode text primary key check (vestigingscode ~ '^[0-9A-Z]{4}[0-9]{2}$'),
  naam text not null,
  adres text not null default '',
  postcode text not null default '',
  plaats text not null default '',
  gemeente text not null default '',
  opgehaald_op timestamptz not null default now()
);

-- Logboek van elke keer ophalen, met de knop (door) of automatisch (door null).
create table public.duo_ophaalrondes (
  id bigint generated always as identity primary key,
  gestart_op timestamptz not null default now(),
  door uuid references auth.users (id) on delete set null,
  gelukt boolean not null,
  tellingen integer not null default 0,
  vestigingen integer not null default 0,
  ingevuld integer not null default 0,
  melding text not null default '' check (char_length(melding) <= 500)
);

create index duo_ophaalrondes_gestart_op_idx on public.duo_ophaalrondes (gestart_op desc);

alter table public.duo_leerlingaantallen enable row level security;
alter table public.duo_vestigingen       enable row level security;
alter table public.duo_ophaalrondes      enable row level security;

revoke all on public.duo_leerlingaantallen, public.duo_vestigingen, public.duo_ophaalrondes
  from anon, authenticated;
grant select on public.duo_leerlingaantallen, public.duo_vestigingen, public.duo_ophaalrondes
  to authenticated;

create policy "DUO-leerlingaantallen lezen" on public.duo_leerlingaantallen for select to authenticated
  using ((select private.authorize('app.gebruiken')));
create policy "DUO-vestigingen lezen" on public.duo_vestigingen for select to authenticated
  using ((select private.authorize('app.gebruiken')));
create policy "DUO-ophaalrondes lezen" on public.duo_ophaalrondes for select to authenticated
  using ((select private.authorize('app.gebruiken')));

-- Een aantal dat van DUO komt, houdt die markering tot iemand het aantal met
-- de hand verandert.
alter table public.school_jaargegevens
  add column van_duo boolean not null default false;

-- Met de hand opslaan haalt 'overgenomen' weg, en 'van_duo' alleen als het
-- aantal verandert (een andere urencorrectie maakt het aantal niet handmatig).
create or replace function public.school_jaargegevens_opslaan(
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
  insert into public.school_jaargegevens as j (school_id, jaar, leerlingaantal, uren_correctie, correctie_reden)
  values (p_school_id, p_jaar, p_leerlingaantal, coalesce(p_uren_correctie, 0), coalesce(btrim(p_correctie_reden), ''))
  on conflict (school_id, jaar) do update
    set leerlingaantal = excluded.leerlingaantal,
        uren_correctie = excluded.uren_correctie,
        correctie_reden = excluded.correctie_reden,
        overgenomen = false,
        van_duo = j.van_duo and j.leerlingaantal = excluded.leerlingaantal;
end;
$$;

-- -----------------------------------------------------------------------------
-- Hulpfuncties (private)
-- -----------------------------------------------------------------------------

-- BRIN uit de app naar de vestigingscode van DUO: 4 tekens = hoofdvestiging.
create function private.duo_code(p_brin text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when char_length(p_brin) = 4 then p_brin || '00' else p_brin end
$$;

-- Kern van een schoolnaam: zonder voorvoegsels (CBS, PCB, basisschool, ...),
-- lidwoord en hoofdletters. 'CBS De Triangel' en 'de Triangel' → 'triangel'.
create function private.naam_kern(p_naam text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(regexp_replace(regexp_replace(btrim(p_naam), '\s+', ' ', 'g'),
    '^(((rk|pc|c|o|az|i|g|h)bs|pcb|cns|bmdb|smdb|ikc|kbs|obs|prot\.? ?chr\.? ?basisschool|chr\.? ?basisschool|'
    '(christelijke |openbare |reformatorische |islamitische |gereformeerde |hervormde )?basisschool|school) )+', '', 'i'),
    '^(de|het|''t) ', '', 'i'))
$$;

-- Eén verzoek aan de datastore van DUO. Geeft de records terug, of een fout.
create function private.duo_records(p_resource text, p_params jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_antwoord extensions.http_response;
  v_inhoud jsonb;
begin
  v_url := 'https://onderwijsdata.duo.nl/api/3/action/datastore_search?'
    || extensions.urlencode(jsonb_build_object('resource_id', p_resource, 'limit', '10000') || p_params);

  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '30');
  select * into v_antwoord
    from extensions.http((
      'GET', v_url,
      array[extensions.http_header('User-Agent', 'bnwv-intern (open onderwijsdata)'),
            extensions.http_header('Accept', 'application/json')],
      null, null
    )::extensions.http_request);

  if v_antwoord.status <> 200 then
    raise exception 'DUO antwoordde met status %', v_antwoord.status;
  end if;
  begin
    v_inhoud := v_antwoord.content::jsonb;
  exception when others then
    raise exception 'DUO gaf geen geldig antwoord';
  end;
  if (v_inhoud ->> 'success') is distinct from 'true' then
    raise exception 'DUO weigerde het verzoek';
  end if;
  if (v_inhoud #>> '{result,total}')::integer > jsonb_array_length(v_inhoud #> '{result,records}') then
    raise exception 'DUO gaf meer rijen dan in één keer op te halen zijn';
  end if;
  return v_inhoud #> '{result,records}';
end;
$$;

-- Slaat de tellingen van DUO op en vult daarmee de leerlingaantallen van
-- actieve scholen. Geeft het aantal ingevulde of bijgewerkte aantallen terug.
create function private.duo_tellingen_verwerken(p_records jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ingevuld integer;
begin
  insert into public.duo_leerlingaantallen (vestigingscode, peiljaar, type_po, aantal, opgehaald_op)
  select t.code, t.peiljaar,
         string_agg(distinct t.type_po, '/'),
         case when bool_or(t.aantal < 0) then null else sum(t.aantal)::integer end,
         now()
    from (
      select case when char_length(r ->> 'VESTIGINGSCODE') = 2
                  then (r ->> 'INSTELLINGSCODE') || (r ->> 'VESTIGINGSCODE')
                  else r ->> 'VESTIGINGSCODE' end as code,
             (r ->> 'PEILJAAR')::numeric::smallint as peiljaar,
             coalesce(r ->> 'TYPE_PO', '') as type_po,
             (r ->> 'AANTAL_LEERLINGEN')::numeric::integer as aantal
        from jsonb_array_elements(coalesce(p_records, '[]'::jsonb)) r
    ) t
   group by t.code, t.peiljaar
  on conflict (vestigingscode, peiljaar) do update
    set type_po = excluded.type_po,
        aantal = excluded.aantal,
        opgehaald_op = excluded.opgehaald_op;

  -- Alleen lege of overgenomen aantallen, en eerdere DUO-aantallen die
  -- veranderd zijn. Ongewijzigde rijen worden niet aangeraakt (geen auditregels).
  insert into public.school_jaargegevens as j (school_id, jaar, leerlingaantal, van_duo)
  select s.id, w.jaar, d.aantal, true
    from public.scholen s
    join public.duo_leerlingaantallen d on d.vestigingscode = private.duo_code(s.brin)
    join public.werkjaren w on w.jaar = d.peiljaar + 1
   where s.actief and d.aantal is not null
  on conflict (school_id, jaar) do update
    set leerlingaantal = excluded.leerlingaantal,
        overgenomen = false,
        van_duo = true
    where j.overgenomen or (j.van_duo and j.leerlingaantal <> excluded.leerlingaantal);

  get diagnostics v_ingevuld = row_count;
  return v_ingevuld;
end;
$$;

-- Vervangt de lijst met vestigingen. Een lege lijst wordt geweigerd, zodat
-- een storing bij DUO de voorstellen niet wist.
create function private.duo_vestigingen_verwerken(p_records jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aantal integer;
begin
  if coalesce(jsonb_array_length(p_records), 0) = 0 then
    raise exception 'DUO gaf geen vestigingen terug';
  end if;

  delete from public.duo_vestigingen where true;
  insert into public.duo_vestigingen (vestigingscode, naam, adres, postcode, plaats, gemeente, opgehaald_op)
  select distinct on (r ->> 'VESTIGINGSCODE')
         r ->> 'VESTIGINGSCODE',
         coalesce(r ->> 'VESTIGINGSNAAM', ''),
         btrim(coalesce(r ->> 'STRAATNAAM', '') || ' ' || coalesce(r ->> 'HUISNUMMER-TOEVOEGING', '')),
         coalesce(r ->> 'POSTCODE', ''),
         coalesce(r ->> 'PLAATSNAAM', ''),
         coalesce(r ->> 'GEMEENTENAAM', ''),
         now()
    from jsonb_array_elements(p_records) r
   where r ->> 'VESTIGINGSCODE' ~ '^[0-9A-Z]{4}[0-9]{2}$';

  get diagnostics v_aantal = row_count;
  return v_aantal;
end;
$$;

-- Haalt alles op bij DUO en legt de ronde vast. Een fout breekt de ronde af
-- (niets half verwerkt) en komt als melding in het logboek.
create function private.duo_ophalen(p_door uuid)
returns public.duo_ophaalrondes
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Resources op onderwijsdata.duo.nl. Wijzigt DUO een id, dan meldt het
  -- logboek een fout; zoek het nieuwe id op met package_show.
  c_tellingen constant text := '9278ae97-4014-49f4-91fc-8cc255c2595d';       -- poleerlingen-v1
  c_vestigingen_bo constant text := 'dcc9c9a5-6d01-410b-967f-810557588ba4';  -- adressen_bo
  c_vestigingen_so constant text := '8f0f1639-712d-4adb-bb59-cabd43730dc8';  -- adressen_so
  c_velden constant text :=
    'VESTIGINGSCODE,VESTIGINGSNAAM,STRAATNAAM,HUISNUMMER-TOEVOEGING,POSTCODE,PLAATSNAAM,GEMEENTENAAM';
  v_instellingen text[];
  v_jaren integer[];
  v_records jsonb;
  v_ronde public.duo_ophaalrondes;
  v_tellingen integer := 0;
  v_vestigingen integer := 0;
  v_ingevuld integer := 0;
begin
  begin
    select array_agg(distinct left(brin, 4) order by left(brin, 4)) into v_instellingen
      from public.scholen where brin is not null and actief;
    -- Werkjaar = peiljaar + 1.
    select array_agg(jaar - 1 order by jaar) into v_jaren from public.werkjaren;

    if v_instellingen is not null and v_jaren is not null then
      v_records := private.duo_records(c_tellingen, jsonb_build_object(
        'filters', jsonb_build_object('INSTELLINGSCODE', to_jsonb(v_instellingen), 'PEILJAAR', to_jsonb(v_jaren))::text));
      v_tellingen := jsonb_array_length(v_records);
      v_ingevuld := private.duo_tellingen_verwerken(v_records);
    end if;

    v_records := private.duo_records(c_vestigingen_bo, jsonb_build_object(
        'filters', '{"PROVINCIE":"Gelderland"}', 'fields', c_velden))
      || private.duo_records(c_vestigingen_so, jsonb_build_object(
        'filters', '{"PROVINCIE":"Gelderland"}', 'fields', c_velden));
    v_vestigingen := private.duo_vestigingen_verwerken(v_records);

    insert into public.duo_ophaalrondes (door, gelukt, tellingen, vestigingen, ingevuld)
    values (p_door, true, v_tellingen, v_vestigingen, v_ingevuld)
    returning * into v_ronde;
  exception when others then
    insert into public.duo_ophaalrondes (door, gelukt, melding)
    values (p_door, false, left(sqlerrm, 500))
    returning * into v_ronde;
  end;
  return v_ronde;
end;
$$;

revoke all on function private.duo_code(text) from public;
revoke all on function private.naam_kern(text) from public;
revoke all on function private.duo_records(text, jsonb) from public;
revoke all on function private.duo_tellingen_verwerken(jsonb) from public;
revoke all on function private.duo_vestigingen_verwerken(jsonb) from public;
revoke all on function private.duo_ophalen(uuid) from public;

-- -----------------------------------------------------------------------------
-- Functies voor de app (werkbelasting.beheren)
-- -----------------------------------------------------------------------------

-- De knop "Ophalen bij DUO". Geeft de vastgelegde ronde terug.
create function public.duo_ophalen()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.vereis_werkbelasting_beheren();
  return to_jsonb(private.duo_ophalen(auth.uid()));
end;
$$;

-- Per actieve school zonder BRIN de drie best passende vestigingen van DUO,
-- op naam (trigrammen), postcode en plaats. Vestigingen die al aan een
-- school gekoppeld zijn, vallen af.
create function public.duo_brin_voorstellen()
returns table (
  school_id uuid, vestigingscode text, naam text, adres text, postcode text, plaats text, score real
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.vereis_werkbelasting_beheren();
  return query
  select k.school_id, k.vestigingscode, k.naam, k.adres, k.postcode, k.plaats, k.score
    from (
      select s.id as school_id, v.vestigingscode, v.naam, v.adres, v.postcode, v.plaats, m.score,
             row_number() over (partition by s.id order by m.score desc, v.vestigingscode) as rang
        from public.scholen s
        cross join public.duo_vestigingen v
        cross join lateral (
          select (extensions.similarity(private.naam_kern(s.naam), private.naam_kern(v.naam))
                  + case when s.postcode <> '' and upper(replace(s.postcode, ' ', '')) = v.postcode then 0.5 else 0 end
                  + case when s.plaats <> '' and upper(btrim(s.plaats)) = v.plaats then 0.2 else 0 end)::real as score
        ) m
       where s.actief and s.brin is null and s.soort <> 'KDV'
         and not exists (
           select 1 from public.scholen a where private.duo_code(a.brin) = v.vestigingscode)
    ) k
   where k.rang <= 3 and k.score >= 0.4
   order by k.school_id, k.rang;
end;
$$;

-- Koppelt BRIN-nummers aan scholen die er nog geen hebben:
-- [{"school_id": "...", "brin": "12AB00"}, ...]. Geeft het aantal terug.
create function public.school_brin_koppelen(p_koppelingen jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aantal integer;
begin
  perform private.vereis_werkbelasting_beheren();
  update public.scholen s
     set brin = upper(btrim(k.brin)), updated_at = now()
    from jsonb_to_recordset(coalesce(p_koppelingen, '[]'::jsonb)) as k (school_id uuid, brin text)
   where s.id = k.school_id and s.brin is null and btrim(coalesce(k.brin, '')) <> '';
  get diagnostics v_aantal = row_count;
  return v_aantal;
end;
$$;

revoke all on function public.duo_ophalen() from public, anon, authenticated, service_role;
revoke all on function public.duo_brin_voorstellen() from public, anon, authenticated, service_role;
revoke all on function public.school_brin_koppelen(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.duo_ophalen() to authenticated;
grant execute on function public.duo_brin_voorstellen() to authenticated;
grant execute on function public.school_brin_koppelen(jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Elke maand automatisch: de 5e om 05:00 UTC. DUO publiceert de telling van
-- 1 oktober in januari; maandelijks ophalen vangt ook latere correcties op.
-- -----------------------------------------------------------------------------
select cron.schedule('duo-leerlingaantallen', '0 5 5 * *', $$select private.duo_ophalen(null)$$);
