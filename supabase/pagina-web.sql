-- Instalación independiente y repetible. No modifica productos, fotos ni estado del taller.
begin;

create table if not exists public.pagina_publica (
  id smallint primary key default 1 check (id = 1),
  contenido jsonb not null default '{"version":1,"fields":{}}',
  actualizado timestamptz not null default now()
);
create table if not exists public.pagina_borrador (
  id smallint primary key default 1 check (id = 1),
  contenido jsonb not null default '{"version":1,"fields":{}}',
  revision bigint not null default 0,
  actualizado timestamptz not null default now()
);
create table if not exists public.pagina_historial (
  id bigint generated always as identity primary key,
  contenido jsonb not null,
  creado timestamptz not null default now()
);
alter table public.pagina_publica enable row level security;
alter table public.pagina_borrador enable row level security;
alter table public.pagina_historial enable row level security;
revoke all on public.pagina_publica, public.pagina_borrador, public.pagina_historial from anon, authenticated;
grant select on public.pagina_publica to anon, authenticated;
grant select on public.pagina_borrador, public.pagina_historial to authenticated;

drop policy if exists "Pagina publicada visible" on public.pagina_publica;
create policy "Pagina publicada visible" on public.pagina_publica for select to anon, authenticated using (true);
drop policy if exists "Pagina borrador solo propietario" on public.pagina_borrador;
create policy "Pagina borrador solo propietario" on public.pagina_borrador for select to authenticated using (auth.uid() = '60712cc3-ee1b-4ad5-9226-4f97d80a13d8'::uuid);
drop policy if exists "Pagina historial solo propietario" on public.pagina_historial;
create policy "Pagina historial solo propietario" on public.pagina_historial for select to authenticated using (auth.uid() = '60712cc3-ee1b-4ad5-9226-4f97d80a13d8'::uuid);
insert into public.pagina_publica (id) values (1) on conflict do nothing;
insert into public.pagina_borrador (id) values (1) on conflict do nothing;

-- Se comprueba en el servidor: no basta con ocultar la pestaña del panel.
-- Misma lista cerrada de campos que assets/pagina-modelo.js.
create or replace function public.pagina_validar(p_contenido jsonb)
returns void language plpgsql immutable set search_path = '' as $$
declare
  v_spec constant jsonb := '{"nombre":{"type":"text","max":45,"required":true},"subtitulo":{"type":"text","max":65,"required":false},"tituloSeo":{"type":"text","max":100,"required":true},"descripcionSeo":{"type":"text","max":250,"required":false},"tituloSocial":{"type":"text","max":100,"required":false},"descripcionSocial":{"type":"text","max":250,"required":false},"logo":{"type":"image","max":350,"required":false},"imagenSocial":{"type":"image","max":350,"required":false},"menu0":{"type":"text","max":35,"required":true},"menu1":{"type":"text","max":35,"required":true},"menu2":{"type":"text","max":35,"required":true},"menu3":{"type":"text","max":35,"required":true},"portadaEtiqueta":{"type":"text","max":85,"required":false},"portadaTitulo":{"type":"text","max":100,"required":true},"portadaTexto":{"type":"text","max":420,"required":false},"portadaLlamar":{"type":"text","max":65,"required":true},"portadaCatalogo":{"type":"text","max":45,"required":true},"portadaImagen":{"type":"image","max":350,"required":false},"portadaImagenAlt":{"type":"text","max":180,"required":false},"dato0":{"type":"text","max":65,"required":false},"dato1":{"type":"text","max":65,"required":false},"dato2":{"type":"text","max":65,"required":false},"dato3":{"type":"text","max":65,"required":false},"serviciosEtiqueta":{"type":"text","max":75,"required":false},"serviciosTitulo":{"type":"text","max":110,"required":true},"serviciosTexto":{"type":"text","max":500,"required":false},"repuestosEtiqueta":{"type":"text","max":75,"required":false},"repuestosTitulo":{"type":"text","max":110,"required":true},"repuestosTexto":{"type":"text","max":500,"required":false},"servicio0Nombre":{"type":"text","max":70,"required":true},"servicio0Texto":{"type":"text","max":500,"required":false},"servicio0Imagen":{"type":"image","max":350,"required":false},"servicio1Nombre":{"type":"text","max":70,"required":true},"servicio1Texto":{"type":"text","max":500,"required":false},"servicio1Imagen":{"type":"image","max":350,"required":false},"servicio2Nombre":{"type":"text","max":70,"required":true},"servicio2Texto":{"type":"text","max":500,"required":false},"servicio2Imagen":{"type":"image","max":350,"required":false},"servicio3Nombre":{"type":"text","max":70,"required":true},"servicio3Texto":{"type":"text","max":500,"required":false},"servicio3Imagen":{"type":"image","max":350,"required":false},"servicio4Nombre":{"type":"text","max":70,"required":true},"servicio4Texto":{"type":"text","max":500,"required":false},"servicio4Imagen":{"type":"image","max":350,"required":false},"servicio5Nombre":{"type":"text","max":70,"required":true},"servicio5Texto":{"type":"text","max":500,"required":false},"servicio5Imagen":{"type":"image","max":350,"required":false},"buscador":{"type":"text","max":100,"required":false},"avisoRepuestos":{"type":"text","max":650,"required":false},"compatEtiqueta":{"type":"text","max":80,"required":false},"compatTitulo":{"type":"text","max":110,"required":true},"compatTexto":{"type":"text","max":500,"required":false},"compatBoton":{"type":"text","max":45,"required":true},"compatDato0":{"type":"text","max":150,"required":false},"compatDato1":{"type":"text","max":150,"required":false},"compatDato2":{"type":"text","max":150,"required":false},"compatDato3":{"type":"text","max":150,"required":false},"contactoEtiqueta":{"type":"text","max":75,"required":false},"contactoTitulo":{"type":"text","max":100,"required":true},"direccion":{"type":"text","max":220,"required":true},"telefono":{"type":"phone","max":180,"required":false},"whatsapp":{"type":"phone","max":180,"required":false},"facebook":{"type":"facebook","max":500,"required":false},"latitud":{"type":"latitude","max":180,"required":false},"longitud":{"type":"longitude","max":180,"required":false},"semanaAbre":{"type":"time","max":180,"required":false},"semanaCierra":{"type":"time","max":180,"required":false},"sabadoAbre":{"type":"time","max":180,"required":false},"sabadoCierra":{"type":"time","max":180,"required":false},"sabadoAbierto":{"type":"boolean","max":180,"required":false},"domingoAbierto":{"type":"boolean","max":180,"required":false},"colorRojo":{"type":"color","max":180,"required":false},"colorDorado":{"type":"color","max":180,"required":false},"pieNombre":{"type":"text","max":150,"required":false},"pieTexto":{"type":"prefix","max":100,"required":false},"pieBoton":{"type":"text","max":50,"required":true},"servicio0Foto0":{"type":"image","max":350,"required":false},"servicio0Foto1":{"type":"image","max":350,"required":false},"servicio0Foto2":{"type":"image","max":350,"required":false},"servicio0Foto3":{"type":"image","max":350,"required":false},"servicio0Foto4":{"type":"image","max":350,"required":false},"localFoto0":{"type":"image","max":350,"required":false},"servicio1Foto0":{"type":"image","max":350,"required":false},"servicio1Foto1":{"type":"image","max":350,"required":false},"servicio1Foto2":{"type":"image","max":350,"required":false},"servicio1Foto3":{"type":"image","max":350,"required":false},"servicio1Foto4":{"type":"image","max":350,"required":false},"localFoto1":{"type":"image","max":350,"required":false},"servicio2Foto0":{"type":"image","max":350,"required":false},"servicio2Foto1":{"type":"image","max":350,"required":false},"servicio2Foto2":{"type":"image","max":350,"required":false},"servicio2Foto3":{"type":"image","max":350,"required":false},"servicio2Foto4":{"type":"image","max":350,"required":false},"localFoto2":{"type":"image","max":350,"required":false},"servicio3Foto0":{"type":"image","max":350,"required":false},"servicio3Foto1":{"type":"image","max":350,"required":false},"servicio3Foto2":{"type":"image","max":350,"required":false},"servicio3Foto3":{"type":"image","max":350,"required":false},"servicio3Foto4":{"type":"image","max":350,"required":false},"localFoto3":{"type":"image","max":350,"required":false},"servicio4Foto0":{"type":"image","max":350,"required":false},"servicio4Foto1":{"type":"image","max":350,"required":false},"servicio4Foto2":{"type":"image","max":350,"required":false},"servicio4Foto3":{"type":"image","max":350,"required":false},"servicio4Foto4":{"type":"image","max":350,"required":false},"localFoto4":{"type":"image","max":350,"required":false},"servicio5Foto0":{"type":"image","max":350,"required":false},"servicio5Foto1":{"type":"image","max":350,"required":false},"servicio5Foto2":{"type":"image","max":350,"required":false},"servicio5Foto3":{"type":"image","max":350,"required":false},"servicio5Foto4":{"type":"image","max":350,"required":false},"localFoto5":{"type":"image","max":350,"required":false}}'::jsonb;
  v_item record;
  v_rule jsonb;
  v_text text;
  v_kind text;
begin
  if p_contenido is null or jsonb_typeof(p_contenido) <> 'object'
     or p_contenido->'version' is distinct from '1'::jsonb
     or jsonb_typeof(p_contenido->'fields') is distinct from 'object'
     or octet_length(p_contenido::text) > 65536
     or (select count(*) from jsonb_object_keys(p_contenido)) <> 2 then
    raise exception 'Formato de contenido no valido.';
  end if;
  for v_item in select * from jsonb_each(p_contenido->'fields') loop
    v_rule := v_spec->v_item.key;
    v_text := v_item.value #>> '{}';
    v_kind := v_rule->>'type';
    if v_rule is null or jsonb_typeof(v_item.value) <> 'string'
       or char_length(v_text) > (v_rule->>'max')::integer
       or (coalesce((v_rule->>'required')::boolean,false) and btrim(v_text) = '') then
      raise exception 'Campo no valido: %', v_item.key;
    end if;
    if (v_kind = 'image' and v_text <> '' and not (
        v_text ~ '^media:[a-f0-9-]{36}\.(jpg|png|webp)$'
        or (v_text ~* '^assets/[a-z0-9_./-]+\.(png|jpe?g|webp)$' and position('..' in v_text) = 0)))
      or (v_kind = 'phone' and v_text !~ '^[1-9][0-9]{7,14}$')
      or (v_kind = 'facebook' and v_text <> '' and v_text !~ '^https://(www\.|m\.)?facebook\.com(/[^[:space:]]*)?$')
      or (v_kind = 'time' and v_text !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
      or (v_kind = 'boolean' and v_text not in ('true','false'))
      or (v_kind = 'color' and v_text !~* '^#[a-f0-9]{6}$') then
      raise exception 'Valor no valido: %', v_item.key;
    end if;
    if v_kind in ('latitude','longitude') then
      if v_text !~ '^-?[0-9]+(\.[0-9]+)?$' then raise exception 'Coordenada no valida.'; end if;
      if abs(v_text::numeric) > (case when v_kind = 'latitude' then 90 else 180 end) then raise exception 'Coordenada fuera de rango.'; end if;
    end if;
  end loop;
  if coalesce(p_contenido->'fields'->>'semanaAbre','08:00') >= coalesce(p_contenido->'fields'->>'semanaCierra','17:00')
     or coalesce(p_contenido->'fields'->>'sabadoAbre','08:00') >= coalesce(p_contenido->'fields'->>'sabadoCierra','13:00') then
    raise exception 'La hora de cierre debe ser posterior a la apertura.';
  end if;
end;
$$;
revoke all on function public.pagina_validar(jsonb) from public, anon, authenticated;
create or replace function public.pagina_guardar(p_contenido jsonb, p_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_revision bigint;
begin
  if auth.uid() is distinct from '60712cc3-ee1b-4ad5-9226-4f97d80a13d8'::uuid then
    raise exception 'Solo la cuenta propietaria puede editar la pagina.' using errcode = '42501';
  end if;
  perform public.pagina_validar(p_contenido);
  if p_contenido is null or jsonb_typeof(p_contenido) <> 'object' or p_contenido->>'version' is distinct from '1'
     or jsonb_typeof(p_contenido->'fields') is distinct from 'object' or octet_length(p_contenido::text) > 65536
     or (select count(*) from jsonb_object_keys(p_contenido)) <> 2 then
    raise exception 'Contenido no valido.';
  end if;
  if exists (select 1 from jsonb_each(p_contenido->'fields') e where jsonb_typeof(e.value) <> 'string'
      or char_length(e.value #>> '{}') > 1200 or e.key !~ '^[A-Za-z][A-Za-z0-9]{0,60}$')
     or (select count(*) from jsonb_each(p_contenido->'fields')) > 150 then
    raise exception 'Campos no validos.';
  end if;
  update public.pagina_borrador set contenido = p_contenido, revision = revision + 1, actualizado = now()
    where id = 1 and revision = p_revision returning revision into v_revision;
  if not found then
    raise exception 'Otra computadora cambio el borrador. Copia tus textos y vuelve a desbloquear para cargar la version actual; no se sobrescribio nada.' using errcode = '40001';
  end if;
  return jsonb_build_object('revision', v_revision);
end;
$$;

create or replace function public.pagina_publicar(p_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_draft public.pagina_borrador%rowtype;
begin
  if auth.uid() is distinct from '60712cc3-ee1b-4ad5-9226-4f97d80a13d8'::uuid then
    raise exception 'Solo la cuenta propietaria puede publicar la pagina.' using errcode = '42501';
  end if;
  -- El AMR conserva el momento de autenticar la contraseña, incluso tras refrescar el JWT.
  if not exists (select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) m
      where m->>'method' = 'password' and (m->>'timestamp') ~ '^[0-9]{1,12}$'
      and (m->>'timestamp')::bigint between extract(epoch from now())::bigint - 300 and extract(epoch from now())::bigint + 30) then
    raise exception 'Confirma nuevamente tu contraseña antes de publicar.' using errcode = '42501';
  end if;
  select * into v_draft from public.pagina_borrador where id = 1 for update;
  if not found or v_draft.revision <> p_revision then
    raise exception 'Otra computadora cambio el borrador. Recarga el editor antes de publicar.' using errcode = '40001';
  end if;
  if (select contenido from public.pagina_publica where id = 1) = v_draft.contenido then
    return jsonb_build_object('revision', v_draft.revision);
  end if;
  insert into public.pagina_historial (contenido) select contenido from public.pagina_publica where id = 1;
  perform public.pagina_validar(v_draft.contenido);
  update public.pagina_publica set contenido = v_draft.contenido, actualizado = now() where id = 1;
  update public.pagina_borrador set revision = revision + 1, actualizado = now() where id = 1 returning revision into v_draft.revision;
  -- Retención limitada: las últimas veinte publicaciones anteriores.
  delete from public.pagina_historial where id not in (select id from public.pagina_historial order by id desc limit 20);
  return jsonb_build_object('revision', v_draft.revision);
end;
$$;
revoke all on function public.pagina_guardar(jsonb,bigint), public.pagina_publicar(bigint) from public, anon;
grant execute on function public.pagina_guardar(jsonb,bigint), public.pagina_publicar(bigint) to authenticated;

-- Las imágenes del borrador permanecen privadas. No se elimina ni sobrescribe una foto.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('pagina-media','pagina-media',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists "Pagina fotos propietario lectura" on storage.objects;
create policy "Pagina fotos propietario lectura" on storage.objects for select to authenticated
using (bucket_id = 'pagina-media' and auth.uid() = '60712cc3-ee1b-4ad5-9226-4f97d80a13d8'::uuid);
drop policy if exists "Pagina fotos propietario sube" on storage.objects;
create policy "Pagina fotos propietario sube" on storage.objects for insert to authenticated
with check (bucket_id = 'pagina-media' and auth.uid() = '60712cc3-ee1b-4ad5-9226-4f97d80a13d8'::uuid and name ~ '^[a-f0-9-]{36}\.(jpg|png|webp)$');
drop policy if exists "Pagina fotos publicadas lectura" on storage.objects;
create policy "Pagina fotos publicadas lectura" on storage.objects for select to anon
using (bucket_id = 'pagina-media' and exists (
  select 1 from public.pagina_publica p, jsonb_each_text(p.contenido->'fields') field
  where p.id = 1 and field.value = 'media:' || name
));
commit;
