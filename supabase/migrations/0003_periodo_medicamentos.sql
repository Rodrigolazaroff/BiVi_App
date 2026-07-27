-- BiVi — periodo de tratamiento
-- Correr pegando este archivo completo en el SQL Editor de Supabase.
--
-- Sin fechas, un tratamiento corto se recordaba para siempre: un diclofenac por
-- 5 dias por una torcedura seguiria apareciendo meses despues. Al mismo tiempo
-- hay medicacion que si es de por vida (la insulina en una diabetes), asi que
-- el modelo tiene que poder expresar las dos cosas.

alter table public.medications
  add column if not exists desde date not null default current_date,
  add column if not exists hasta date;

comment on column public.medications.desde is 'Primer dia del tratamiento.';
comment on column public.medications.hasta is
  'Ultimo dia inclusive. NULL = permanente, sin fecha de fin (insulina, presion, etc).';

-- Una fecha de fin anterior al inicio seria un tratamiento imposible.
alter table public.medications
  drop constraint if exists medications_periodo_valido;
alter table public.medications
  add constraint medications_periodo_valido
  check (hasta is null or hasta >= desde);

-- Se consulta por "los vigentes hoy", asi que el indice acompania ese filtro.
create index if not exists medications_vigencia_idx
  on public.medications (elder_id, activo, desde, hasta);
