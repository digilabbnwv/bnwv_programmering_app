-- =============================================================================
-- DUO: de telling van 1 oktober hoort bij het werkjaar erna
--
-- Werkjaar = peiljaar + 1: de telling van 1 oktober 2025 (gepubliceerd in
-- januari 2026) hoort bij werkjaar 2026. Zo is het aantal er aan het begin
-- van het werkjaar, en januari t/m juli vallen in het schooljaar van die
-- telling. Migratie duo_leerlingaantallen ging uit van peiljaar = werkjaar.
--
-- Al opgehaalde aantallen (van_duo) corrigeren zichzelf bij de volgende keer
-- ophalen: een DUO-aantal wordt bijgewerkt als de telling verschilt.
-- =============================================================================

-- Vult werkjaar = peiljaar + 1.
create or replace function private.duo_tellingen_verwerken(p_records jsonb)
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

-- Vraagt voor elk werkjaar de telling van het jaar ervoor op.
create or replace function private.duo_ophalen(p_door uuid)
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
