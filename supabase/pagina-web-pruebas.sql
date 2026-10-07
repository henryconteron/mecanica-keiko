-- Pruebas transaccionales. TODOS los cambios de prueba se revierten al final.
-- Ejecutar únicamente con la cuenta administradora en SQL Editor.
begin;
select set_config('request.jwt.claims', jsonb_build_object('sub','60712cc3-ee1b-4ad5-9226-4f97d80a13d8','role','authenticated','amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',extract(epoch from now())::bigint)))::text, true);
set local role authenticated;
do $$
declare v_revision bigint; v_result jsonb;
begin
  select revision into v_revision from public.pagina_borrador where id = 1;
  if v_revision is null then raise exception 'Fallo: el propietario no puede leer su borrador.'; end if;
  v_result := public.pagina_guardar('{"version":1,"fields":{"portadaTitulo":"Prueba transaccional, no publicar"}}',v_revision);
  begin
    perform public.pagina_guardar('{"version":1,"fields":{}}',v_revision);
    raise exception 'Fallo: permitio sobrescribir otra revision.';
  exception when serialization_failure then null; end;
  begin
    perform public.pagina_guardar('{"version":1,"fields":{"logo":"javascript:alert(1)"}}',(v_result->>'revision')::bigint);
    raise exception 'Fallo: acepto imagen peligrosa.';
  exception when raise_exception then
    if sqlerrm like 'Fallo:%' then raise; end if;
  end;
  begin
    perform public.pagina_guardar('{"version":1,"fields":{"campoDesconocido":"x"}}',(v_result->>'revision')::bigint);
    raise exception 'Fallo: acepto campo desconocido.';
  exception when raise_exception then
    if sqlerrm like 'Fallo:%' then raise; end if;
  end;
  perform set_config('request.jwt.claims','{"sub":"60712cc3-ee1b-4ad5-9226-4f97d80a13d8","role":"authenticated","amr":[{"method":"password","timestamp":1}]}',true);
  begin
    perform public.pagina_publicar((v_result->>'revision')::bigint);
    raise exception 'Fallo: publico con una autenticacion antigua.';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub','60712cc3-ee1b-4ad5-9226-4f97d80a13d8','role','authenticated','amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',extract(epoch from now())::bigint)))::text,true);
  perform public.pagina_publicar((v_result->>'revision')::bigint);
  if (select contenido->'fields'->>'portadaTitulo' from public.pagina_publica where id = 1) is distinct from 'Prueba transaccional, no publicar' then raise exception 'Fallo: publicacion no aplicada.'; end if;
  if not exists(select 1 from public.pagina_historial) then raise exception 'Fallo: historial vacio.'; end if;
  perform set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
  if exists(select 1 from public.pagina_borrador) then raise exception 'Fallo: otro usuario pudo leer el borrador.'; end if;
  begin
    perform public.pagina_guardar('{"version":1,"fields":{}}',0);
    raise exception 'Fallo: otro usuario pudo guardar.';
  exception when insufficient_privilege then null; end;
  if has_table_privilege('anon','public.pagina_borrador','select') or has_table_privilege('authenticated','public.pagina_publica','update') then raise exception 'Fallo: acceso directo demasiado amplio.'; end if;
  if has_function_privilege('anon','public.pagina_guardar(jsonb,bigint)','execute') then raise exception 'Fallo: anon puede guardar.'; end if;
end;
$$;
rollback;
select 'OK: permisos, validacion, concurrencia, contraseña reciente, publicacion e historial; cambios de prueba revertidos' as resultado;
