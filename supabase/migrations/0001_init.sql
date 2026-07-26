-- BiVi — esquema inicial
-- Correr pegando este archivo completo en el SQL Editor de Supabase.
--
-- Modelo segun la Declaracion de MVP (seccion 10):
--   profiles -> el cuidador que administra la cuenta
--   elders   -> el adulto mayor, sin auth propio (1 cuidador = 1 adulto)
--   sessions -> metadata de conversaciones, SIN transcripciones (decision de privacidad)

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  first_name text        not null default '',
  last_name  text        not null default '',
  email      text        not null,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Cuidador que administra la cuenta. Auth gestionado por Supabase.';

create table if not exists public.elders (
  id              uuid        primary key default gen_random_uuid(),
  profile_id      uuid        not null unique references public.profiles (id) on delete cascade,
  full_name       text        not null,
  age             int         not null check (age between 18 and 120),
  favorite_topics text[]      not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.elders is 'Adulto mayor. Hereda la sesion del cuidador en el dispositivo donde se instala la PWA.';
comment on column public.elders.profile_id is 'UNIQUE: en el MVP un cuidador administra exactamente un adulto mayor.';

create table if not exists public.sessions (
  id               uuid        primary key default gen_random_uuid(),
  elder_id         uuid        not null references public.elders (id) on delete cascade,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  duration_seconds int,
  status           text        not null default 'active'
                   check (status in ('active', 'completed', 'error', 'abandoned'))
);

comment on table public.sessions is 'Solo metadata de la conversacion. Nunca se almacena el contenido hablado.';

create index if not exists sessions_elder_id_started_at_idx
  on public.sessions (elder_id, started_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- La anon key es publica por diseno: RLS es lo unico que impide que cualquiera
-- lea la base entera. Sin estas policies los datos quedan expuestos.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.elders   enable row level security;
alter table public.sessions enable row level security;

-- profiles: cada uno ve y edita solo el suyo.
-- El INSERT lo hace el trigger handle_new_user() con security definer.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- elders: el cuidador manda sobre su propio adulto mayor.
drop policy if exists "elders_all_own" on public.elders;
create policy "elders_all_own" on public.elders
  for all using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- sessions: se llega al permiso a traves del elder.
drop policy if exists "sessions_all_own" on public.sessions;
create policy "sessions_all_own" on public.sessions
  for all using (
    exists (
      select 1 from public.elders e
      where e.id = sessions.elder_id
        and e.profile_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.elders e
      where e.id = sessions.elder_id
        and e.profile_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Trigger: crear el profile al registrarse
--
-- Cubre los dos caminos de alta. Con email/password el login manda first_name y
-- last_name en el metadata; con Google llega un unico full_name que hay que
-- partir. Sin esto, entrar con Google dejaria la cuenta sin profile.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta_full_name text := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    ''
  );
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'first_name', ''),
      nullif(split_part(meta_full_name, ' ', 1), ''),
      ''
    ),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'last_name', ''),
      nullif(substr(meta_full_name, strpos(meta_full_name, ' ') + 1), meta_full_name),
      ''
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Trigger: mantener updated_at en elders
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists elders_touch_updated_at on public.elders;
create trigger elders_touch_updated_at
  before update on public.elders
  for each row execute function public.touch_updated_at();
