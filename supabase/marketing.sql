-- Clics anónimos agregados. No se guardan IP, usuario ni datos personales.
create table if not exists public.catalogo_eventos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null check (char_length(codigo) between 1 and 80),
  evento text not null check (evento in ('ver_ficha', 'whatsapp', 'compartir')),
  creado timestamptz not null default now()
);
create index if not exists catalogo_eventos_creado_idx on public.catalogo_eventos (creado desc);
alter table public.catalogo_eventos enable row level security;
revoke all on public.catalogo_eventos from anon, authenticated;
grant insert (codigo, evento) on public.catalogo_eventos to anon;
grant select on public.catalogo_eventos to authenticated;
create policy "Visitantes registran clics" on public.catalogo_eventos
  for insert to anon with check (evento in ('ver_ficha', 'whatsapp', 'compartir') and char_length(codigo) between 1 and 80);
create policy "Administradora consulta clics" on public.catalogo_eventos
  for select to authenticated using ((select auth.uid()) = '60712cc3-ee1b-4ad5-9226-4f97d80a13d8'::uuid);

-- Agenda editorial manual: planificar no publica automáticamente en redes sociales.
create table if not exists public.plan_publicaciones (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 3 and 120),
  canal text not null check (canal in ('facebook', 'instagram', 'ambos', 'otro')),
  formato text not null check (formato in ('publicacion', 'historia', 'reel')),
  programado timestamptz not null,
  codigo_producto text not null default '' check (char_length(codigo_producto) <= 80),
  nota text not null default '' check (char_length(nota) <= 500),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'publicado')),
  creado timestamptz not null default now()
);
create index if not exists plan_publicaciones_programado_idx on public.plan_publicaciones (programado);
alter table public.plan_publicaciones enable row level security;
revoke all on public.plan_publicaciones from anon, authenticated;
grant select, insert, update, delete on public.plan_publicaciones to authenticated;
create policy "Administradora gestiona agenda" on public.plan_publicaciones
  for all to authenticated
  using ((select auth.uid()) = '60712cc3-ee1b-4ad5-9226-4f97d80a13d8'::uuid)
  with check ((select auth.uid()) = '60712cc3-ee1b-4ad5-9226-4f97d80a13d8'::uuid);
