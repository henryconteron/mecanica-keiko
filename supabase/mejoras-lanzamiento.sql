-- Mejoras aditivas del lanzamiento. No altera precios, existencias, textos ni fotografías.
begin;
alter table public.productos_admin add column if not exists version bigint not null default 1;
create or replace function public.producto_control_version()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.version is distinct from old.version + 1 then
    raise exception 'Otra computadora o el bot cambio este producto. Recarga antes de guardar; no se sobrescribio nada.' using errcode = '40001';
  end if;
  new.actualizado := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.producto_control_version() from public, anon, authenticated;
drop trigger if exists producto_control_version on public.productos_admin;
create trigger producto_control_version before update on public.productos_admin
for each row execute function public.producto_control_version();

create table if not exists public.consultas_taller (
  id uuid primary key default gen_random_uuid(),
  codigo text not null default '' check (char_length(codigo) <= 80),
  canal text not null check (canal in ('whatsapp','facebook','instagram','google','local','referido','otro')),
  etapa text not null default 'consulta' check (etapa in ('consulta','conversacion','venta','no_concretada')),
  importe numeric(12,2) check (importe is null or importe >= 0),
  nota text not null default '' check (char_length(nota) <= 300),
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index if not exists consultas_taller_creado on public.consultas_taller (creado desc);
alter table public.consultas_taller enable row level security;
revoke all on public.consultas_taller from anon, authenticated;
grant select, insert, update on public.consultas_taller to authenticated;
drop policy if exists "Consultas solo propietario" on public.consultas_taller;
create policy "Consultas solo propietario" on public.consultas_taller for all to authenticated
using (auth.uid() = '60712cc3-ee1b-4ad5-9226-4f97d80a13d8'::uuid)
with check (auth.uid() = '60712cc3-ee1b-4ad5-9226-4f97d80a13d8'::uuid);

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

commit;
