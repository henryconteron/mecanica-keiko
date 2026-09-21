create table if not exists public.estado_taller (
  id smallint primary key default 1 check (id = 1),
  estado text not null default 'automatico' check (estado in ('automatico', 'disponible', 'limitado', 'ocupado', 'cerrado')),
  mensaje text not null default '' check (char_length(mensaje) <= 180),
  actualizado timestamptz not null default now()
);

alter table public.estado_taller enable row level security;

drop policy if exists "Estado visible para todos" on public.estado_taller;
create policy "Estado visible para todos"
on public.estado_taller for select
to anon, authenticated
using (true);

drop policy if exists "Solo usuarios autenticados actualizan" on public.estado_taller;
create policy "Solo usuarios autenticados actualizan"
on public.estado_taller for update
to authenticated
using (auth.uid() = '60712cc3-ee1b-4ad5-9226-4f97d80a13d8'::uuid)
with check (auth.uid() = '60712cc3-ee1b-4ad5-9226-4f97d80a13d8'::uuid);

revoke insert, delete on public.estado_taller from anon, authenticated;
grant select on public.estado_taller to anon, authenticated;
grant update (estado, mensaje, actualizado) on public.estado_taller to authenticated;

insert into public.estado_taller (id, estado, mensaje)
values (1, 'automatico', '')
on conflict (id) do nothing;

create table if not exists public.productos_admin (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  cantidad integer not null default 1 check (cantidad >= 0),
  precio numeric(10,2),
  marca text not null default '',
  observaciones text not null default '',
  categoria text not null default '',
  descripcion_corta text not null default '',
  descripcion text not null default '',
  compatibilidad text[] not null default '{}',
  referencias text[] not null default '{}',
  fuentes jsonb not null default '[]'::jsonb,
  confianza text not null default '',
  resultado_bot jsonb,
  error_investigacion text not null default '',
  revision text not null default 'borrador' check (revision in ('borrador', 'investigar', 'revisar', 'aprobado', 'publicado')),
  fotos text[] not null default '{}',
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

alter table public.productos_admin
  add column if not exists categoria text not null default '',
  add column if not exists descripcion_corta text not null default '',
  add column if not exists descripcion text not null default '',
  add column if not exists compatibilidad text[] not null default '{}',
  add column if not exists referencias text[] not null default '{}',
  add column if not exists fuentes jsonb not null default '[]'::jsonb,
  add column if not exists confianza text not null default '',
  add column if not exists resultado_bot jsonb,
  add column if not exists error_investigacion text not null default '';

alter table public.productos_admin enable row level security;
drop policy if exists "Administradores gestionan productos" on public.productos_admin;
create policy "Administradores gestionan productos"
on public.productos_admin for all to authenticated
using (auth.uid() = '60712cc3-ee1b-4ad5-9226-4f97d80a13d8'::uuid)
with check (auth.uid() = '60712cc3-ee1b-4ad5-9226-4f97d80a13d8'::uuid);
revoke all on public.productos_admin from anon;
grant select, insert, update, delete on public.productos_admin to authenticated;

drop policy if exists "Productos publicados visibles" on public.productos_admin;
create policy "Productos publicados visibles"
on public.productos_admin for select to anon
using (revision = 'publicado');
-- Los borradores, notas y resultados internos nunca son públicos.
revoke select on public.productos_admin from anon;
grant select (id,codigo,nombre,cantidad,precio,marca,categoria,descripcion_corta,descripcion,compatibilidad,referencias,fotos,revision,actualizado) on public.productos_admin to anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inventario', 'inventario', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists "Administradores gestionan fotos" on storage.objects;
create policy "Administradores gestionan fotos"
on storage.objects for all to authenticated
using (bucket_id = 'inventario' and auth.uid() = '60712cc3-ee1b-4ad5-9226-4f97d80a13d8'::uuid)
with check (bucket_id = 'inventario' and auth.uid() = '60712cc3-ee1b-4ad5-9226-4f97d80a13d8'::uuid);

drop policy if exists "Fotos publicadas visibles" on storage.objects;
create policy "Fotos publicadas visibles"
on storage.objects for select to anon
using (
  bucket_id = 'inventario'
  and exists (
    select 1 from public.productos_admin
    where revision = 'publicado' and name = any(fotos)
  )
);
