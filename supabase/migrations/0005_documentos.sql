-- BiVi — documentos medicos
-- Correr pegando este archivo completo en el SQL Editor de Supabase.
--
-- Los archivos NO van en tablas: van al Storage de Supabase (bucket privado).
-- La tabla documents guarda la referencia y lo que Gemini extrajo del archivo,
-- que es lo que despues alimenta la historia clinica.

-- ---------------------------------------------------------------------------
-- Bucket privado, con limite y tipos permitidos aplicados por el propio Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos',
  'documentos',
  false,
  10485760, -- 10 MB: tope comodo para el envio inline a Gemini
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Cada archivo vive en una carpeta cuyo nombre es el uid del cuidador:
--   {auth.uid()}/{uuid}.pdf
-- y las policies solo dejan tocar la carpeta propia.

drop policy if exists "documentos_select_own" on storage.objects;
create policy "documentos_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "documentos_insert_own" on storage.objects;
create policy "documentos_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "documentos_delete_own" on storage.objects;
create policy "documentos_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- Metadata + extraccion
-- ---------------------------------------------------------------------------

create table if not exists public.documents (
  id           uuid        primary key default gen_random_uuid(),
  elder_id     uuid        not null references public.elders (id) on delete cascade,
  nombre       text        not null,
  storage_path text        not null unique,
  mime_type    text        not null,
  tamano       integer     not null default 0,
  -- Lo que Gemini extrajo. Guardarlo evita reprocesar el archivo en cada uso.
  resumen      text,
  datos        jsonb,
  procesado_en timestamptz,
  created_at   timestamptz not null default now()
);

comment on column public.documents.resumen is
  'Resumen del documento extraido por Gemini al subirlo. NULL = aun sin procesar.';
comment on column public.documents.datos is
  'Extraccion estructurada: tipo_documento, fecha_documento, valores_relevantes.';

create index if not exists documents_elder_idx
  on public.documents (elder_id, created_at desc);

alter table public.documents enable row level security;

drop policy if exists "documents_all_own" on public.documents;
create policy "documents_all_own" on public.documents
  for all using (
    exists (select 1 from public.elders e
            where e.id = documents.elder_id and e.profile_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.elders e
            where e.id = documents.elder_id and e.profile_id = (select auth.uid()))
  );
