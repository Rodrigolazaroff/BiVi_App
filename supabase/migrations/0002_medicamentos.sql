-- BiVi — medicamentos
-- Correr pegando este archivo completo en el SQL Editor de Supabase.
--
-- Los medicamentos los carga SIEMPRE el cuidador desde el panel, nunca por voz:
-- un dato clinico no puede depender de una transcripcion. BiVi solo los
-- menciona y registra si se tomaron.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table if not exists public.medications (
  id         uuid        primary key default gen_random_uuid(),
  elder_id   uuid        not null references public.elders (id) on delete cascade,
  nombre     text        not null check (length(trim(nombre)) > 0),
  dosis      text        not null default '',
  horarios   time[]      not null default '{}',
  activo     boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.medications is 'Medicamentos cargados por el cuidador. BiVi los recuerda, nunca los indica.';
comment on column public.medications.horarios is 'Horas del dia en que corresponde tomarlo, en la zona horaria del adulto mayor.';

create index if not exists medications_elder_activo_idx
  on public.medications (elder_id, activo);

create table if not exists public.medication_intakes (
  id             uuid        primary key default gen_random_uuid(),
  medication_id  uuid        not null references public.medications (id) on delete cascade,
  previsto_para  timestamptz not null,
  registrado_en  timestamptz not null default now(),
  origen         text        not null default 'voz' check (origen in ('voz', 'manual')),
  unique (medication_id, previsto_para)
);

comment on table public.medication_intakes is 'Tomas confirmadas. El UNIQUE evita registrar dos veces la misma.';
comment on column public.medication_intakes.origen is 'voz = lo confirmo la persona conversando; manual = lo marco el cuidador.';

create index if not exists medication_intakes_medication_previsto_idx
  on public.medication_intakes (medication_id, previsto_para desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Mismo patron que sessions: el permiso se alcanza a traves del elder que
-- pertenece al cuidador autenticado.
-- ---------------------------------------------------------------------------

alter table public.medications       enable row level security;
alter table public.medication_intakes enable row level security;

drop policy if exists "medications_all_own" on public.medications;
create policy "medications_all_own" on public.medications
  for all using (
    exists (
      select 1 from public.elders e
      where e.id = medications.elder_id
        and e.profile_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.elders e
      where e.id = medications.elder_id
        and e.profile_id = (select auth.uid())
    )
  );

drop policy if exists "medication_intakes_all_own" on public.medication_intakes;
create policy "medication_intakes_all_own" on public.medication_intakes
  for all using (
    exists (
      select 1
      from public.medications m
      join public.elders e on e.id = m.elder_id
      where m.id = medication_intakes.medication_id
        and e.profile_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.medications m
      join public.elders e on e.id = m.elder_id
      where m.id = medication_intakes.medication_id
        and e.profile_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- updated_at automatico (reusa la funcion de la migracion 0001)
-- ---------------------------------------------------------------------------

drop trigger if exists medications_touch_updated_at on public.medications;
create trigger medications_touch_updated_at
  before update on public.medications
  for each row execute function public.touch_updated_at();
