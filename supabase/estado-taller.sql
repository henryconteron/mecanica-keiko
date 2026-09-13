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
using (true)
with check (true);

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
  revision text not null default 'borrador' check (revision in ('borrador', 'investigar', 'revisar', 'aprobado', 'publicado')),
  fotos text[] not null default '{}',
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

alter table public.productos_admin enable row level security;
drop policy if exists "Administradores gestionan productos" on public.productos_admin;
create policy "Administradores gestionan productos"
on public.productos_admin for all to authenticated
using (true) with check (true);
revoke all on public.productos_admin from anon;
grant select, insert, update, delete on public.productos_admin to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inventario', 'inventario', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists "Administradores gestionan fotos" on storage.objects;
create policy "Administradores gestionan fotos"
on storage.objects for all to authenticated
using (bucket_id = 'inventario')
with check (bucket_id = 'inventario');
