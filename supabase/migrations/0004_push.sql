-- BiVi — notificaciones push
-- Correr pegando este archivo completo en el SQL Editor de Supabase.

-- ---------------------------------------------------------------------------
-- Suscripciones push
--
-- Una fila por navegador/dispositivo donde se activaron las notificaciones
-- (tipicamente el celular del adulto mayor con la PWA instalada). El endpoint
-- es unico: si el navegador renueva la suscripcion, se pisa la anterior.
-- ---------------------------------------------------------------------------

create table if not exists public.push_subscriptions (
  id         uuid        primary key default gen_random_uuid(),
  elder_id   uuid        not null references public.elders (id) on delete cascade,
  endpoint   text        not null unique,
  p256dh     text        not null,
  auth       text        not null,
  created_at timestamptz not null default now()
);

comment on table public.push_subscriptions is
  'Dispositivos suscriptos a los recordatorios. Las claves p256dh/auth cifran cada envio.';

create index if not exists push_subscriptions_elder_idx
  on public.push_subscriptions (elder_id);

alter table public.push_subscriptions enable row level security;

-- Mismo patron que sessions: el permiso llega a traves del elder del cuidador.
drop policy if exists "push_subscriptions_all_own" on public.push_subscriptions;
create policy "push_subscriptions_all_own" on public.push_subscriptions
  for all using (
    exists (
      select 1 from public.elders e
      where e.id = push_subscriptions.elder_id
        and e.profile_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.elders e
      where e.id = push_subscriptions.elder_id
        and e.profile_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Registro de avisos enviados
--
-- El cron corre cada 10 minutos: sin esta tabla, una toma sin confirmar
-- recibiria un aviso en cada pasada. El UNIQUE garantiza un solo aviso por
-- toma. Solo escribe el servidor (con la secret key); RLS sin policies deja
-- afuera a los clientes.
-- ---------------------------------------------------------------------------

create table if not exists public.push_avisos (
  id            uuid        primary key default gen_random_uuid(),
  medication_id uuid        not null references public.medications (id) on delete cascade,
  previsto_para timestamptz not null,
  enviado_en    timestamptz not null default now(),
  unique (medication_id, previsto_para)
);

alter table public.push_avisos enable row level security;

-- ---------------------------------------------------------------------------
-- Correccion: el default de medications.desde corria en UTC
--
-- current_date en el servidor de Supabase es la fecha UTC: una fila creada
-- despues de las 21:00 de Argentina caia en "maniana". El formulario siempre
-- manda la fecha explicita, pero el default tiene que ser coherente.
-- ---------------------------------------------------------------------------

alter table public.medications
  alter column desde set default (now() at time zone 'America/Argentina/Buenos_Aires')::date;
