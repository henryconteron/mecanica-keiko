-- Prueba transaccional: al final revierte TODOS los cambios de esta consulta.
begin;
do $$
declare p public.productos_admin%rowtype; v bigint; n integer;
begin
  select * into p from public.productos_admin order by creado limit 1;
  if p.id is null then raise exception 'Falta un producto real para comprobar versiones.'; end if;
  update public.productos_admin set version = p.version + 1 where id = p.id and version = p.version;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'El guardado con version vigente fallo.'; end if;
  update public.productos_admin set version = p.version + 1 where id = p.id and version = p.version;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'La version antigua pudo guardar.'; end if;
  begin
    update public.productos_admin set nombre = 'NO DEBE GUARDARSE' where id = p.id;
    raise exception 'No se rechazo una escritura sin version.';
  exception when serialization_failure then null;
  end;
  if exists(select 1 from public.productos_admin where id=p.id and (nombre <> p.nombre or fotos <> p.fotos or cantidad <> p.cantidad or precio is distinct from p.precio)) then raise exception 'Se alteraron datos del producto.'; end if;
  if has_table_privilege('anon','public.consultas_taller','select') or has_table_privilege('anon','public.consultas_taller','insert') then raise exception 'Consultas accesibles sin autenticar.'; end if;
  perform public.pagina_validar('{"version":1,"fields":{"localFoto0":"media:12345678-1234-1234-1234-123456789012.jpg","servicio0Foto0":""}}'::jsonb);
  begin
    perform public.pagina_validar('{"version":1,"fields":{"localFoto0":"https://externo.example/foto.jpg"}}'::jsonb);
    raise exception 'Se acepto una imagen externa.';
  exception when raise_exception then
    if sqlerrm='Se acepto una imagen externa.' then raise; end if;
  end;
end;
$$;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
do $$ begin
  if exists(select 1 from public.consultas_taller) then raise exception 'Otro usuario vio consultas.'; end if;
  begin
    insert into public.consultas_taller(canal) values('otro');
    raise exception 'Otro usuario registro consultas.';
  exception when insufficient_privilege then null;
  end;
end; $$;
rollback;
select 'OK: concurrencia, galerias y privacidad; prueba revertida, sin cambiar productos.' as resultado;
