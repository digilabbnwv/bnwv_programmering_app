-- =============================================================================
-- Basis: standaard alles dicht, rollen, rechten, profielen en auditlog.
--
-- Uitgangspunten
--   * RLS staat aan op elke tabel. Policies openen alleen wat nodig is.
--   * anon krijgt nergens rechten. authenticated krijgt alleen SELECT;
--     alle wijzigingen lopen via functies die alleen de service role
--     (de Edge Function) mag uitvoeren.
--   * Alle data-toegang vereist AAL2 (2FA voltooid).
-- =============================================================================

-- Nieuwe tabellen en functies in public krijgen niet automatisch rechten voor
-- anon/authenticated (Supabase geeft die standaard wel). Zo is "vergeten" altijd
-- dicht in plaats van open.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- Hulpfuncties die niet via de API (PostgREST) bereikbaar moeten zijn.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Rollen en rechten
-- -----------------------------------------------------------------------------
create table public.roles (
  id text primary key
    check (id ~ '^[a-z][a-z0-9-]{1,39}$'),
  naam text not null
    check (char_length(btrim(naam)) between 1 and 80),
  omschrijving text not null default ''
    check (char_length(omschrijving) <= 500),
  volgorde smallint not null default 0
);

create table public.permissions (
  id text primary key
    check (id ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  omschrijving text not null
    check (char_length(btrim(omschrijving)) between 1 and 500)
);

create table public.role_permissions (
  role_id text not null references public.roles (id) on update cascade on delete cascade,
  permission_id text not null references public.permissions (id) on update cascade on delete cascade,
  primary key (role_id, permission_id)
);

insert into public.roles (id, naam, omschrijving, volgorde) values
  ('beheerder',    'Beheerder',    'Beheert gebruikers en rollen en leest de auditlog.', 1),
  ('teamleider',   'Teamleider',   'Ziet het gebruikersoverzicht.',                       2),
  ('medewerker',   'Medewerker',   'Gebruikt de applicatie.',                             3),
  ('alleen-lezen', 'Alleen lezen', 'Kan alleen gegevens bekijken.',                       4);

insert into public.permissions (id, omschrijving) values
  ('app.gebruiken',       'De applicatie gebruiken'),
  ('gebruikers.bekijken', 'Het gebruikersoverzicht bekijken'),
  ('gebruikers.beheren',  'Gebruikers aanmaken, wijzigen, deactiveren en resetten'),
  ('auditlog.lezen',      'De auditlog lezen');

insert into public.role_permissions (role_id, permission_id) values
  ('beheerder',    'app.gebruiken'),
  ('beheerder',    'gebruikers.bekijken'),
  ('beheerder',    'gebruikers.beheren'),
  ('beheerder',    'auditlog.lezen'),
  ('teamleider',   'app.gebruiken'),
  ('teamleider',   'gebruikers.bekijken'),
  ('medewerker',   'app.gebruiken'),
  ('alleen-lezen', 'app.gebruiken');

-- -----------------------------------------------------------------------------
-- Profielen en rolkoppeling (precies één rol per gebruiker)
-- -----------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  weergavenaam text not null
    check (char_length(btrim(weergavenaam)) between 1 and 100),
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role_id text not null references public.roles (id) on update cascade on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create index user_roles_role_id_idx on public.user_roles (role_id);

-- -----------------------------------------------------------------------------
-- Auditlog: alleen toevoegen, nooit wijzigen of verwijderen
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  -- Geen foreign keys: de log moet blijven bestaan als een gebruiker verdwijnt.
  actor_id uuid,
  action text not null
    check (action ~ '^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$'),
  target_user_id uuid,
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 8192)
);

create index audit_log_created_at_idx on public.audit_log (created_at desc);
create index audit_log_target_user_id_idx on public.audit_log (target_user_id);

create function private.audit_log_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'De auditlog kan niet worden gewijzigd of verwijderd'
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger audit_log_no_update_delete
  before update or delete on public.audit_log
  for each row execute function private.audit_log_immutable();

create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function private.audit_log_immutable();

-- -----------------------------------------------------------------------------
-- RLS aan op alle tabellen, rechten expliciet
-- -----------------------------------------------------------------------------
alter table public.roles            enable row level security;
alter table public.permissions      enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles         enable row level security;
alter table public.user_roles       enable row level security;
alter table public.audit_log        enable row level security;

revoke all on public.roles, public.permissions, public.role_permissions,
              public.profiles, public.user_roles, public.audit_log
  from anon, authenticated;
revoke all on sequence public.audit_log_id_seq from anon, authenticated;

-- authenticated mag alleen lezen; RLS bepaalt welke rijen.
grant select on public.roles, public.permissions, public.role_permissions,
                public.profiles, public.user_roles, public.audit_log
  to authenticated;
