-- =============================================================================
-- Leerlingaantallen overnemen naar een nieuw jaar
--
-- In één keer voor alle actieve scholen het leerlingaantal (en desgewenst de
-- urencorrectie) van een jaar overnemen naar een ander jaar. Scholen die in
-- dat jaar al gegevens hebben, blijven zoals ze zijn. Een overgenomen rij
-- krijgt de markering 'overgenomen' tot iemand hem met de hand opslaat.
-- =============================================================================

alter table public.school_jaargegevens
  add column overgenomen boolean not null default false;

-- Met de hand opslaan haalt de markering weg.
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
  insert into public.school_jaargegevens (school_id, jaar, leerlingaantal, uren_correctie, correctie_reden)
  values (p_school_id, p_jaar, p_leerlingaantal, coalesce(p_uren_correctie, 0), coalesce(btrim(p_correctie_reden), ''))
  on conflict (school_id, jaar) do update
    set leerlingaantal = excluded.leerlingaantal,
        uren_correctie = excluded.uren_correctie,
        correctie_reden = excluded.correctie_reden,
        overgenomen = false;
end;
$$;

-- Geeft het aantal scholen terug dat gegevens heeft gekregen. Het doeljaar
-- moet bestaan (anders 23503).
create function public.school_jaargegevens_overnemen(p_van smallint, p_naar smallint, p_met_correctie boolean)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aantal integer;
begin
  perform private.vereis_werkbelasting_beheren();
  if p_van is null or p_naar is null or p_van = p_naar then
    raise exception 'Kies twee verschillende jaren' using errcode = 'check_violation';
  end if;

  insert into public.school_jaargegevens (school_id, jaar, leerlingaantal, uren_correctie, correctie_reden, overgenomen)
  select j.school_id, p_naar, j.leerlingaantal,
         case when coalesce(p_met_correctie, true) then j.uren_correctie else 0 end,
         case when coalesce(p_met_correctie, true) then j.correctie_reden else '' end,
         true
    from public.school_jaargegevens j
    join public.scholen s on s.id = j.school_id
   where j.jaar = p_van and s.actief
  on conflict (school_id, jaar) do nothing;

  get diagnostics v_aantal = row_count;
  return v_aantal;
end;
$$;

revoke all on function public.school_jaargegevens_overnemen(smallint, smallint, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.school_jaargegevens_overnemen(smallint, smallint, boolean) to authenticated;
