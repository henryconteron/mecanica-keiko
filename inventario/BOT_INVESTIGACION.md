# Protocolo del bot de investigación

El bot trabaja únicamente con las filas del Excel cuyo estado sea `Investigar` y con las fotografías correspondientes de `inventario/fotos`. La captura inicial puede contener solo ID interno, código, nombre y cantidad. El resultado se entrega como un Pull Request llamado `Investigación lista para revisar`; no se publica directamente.

## Objetivo

Preparar una propuesta verificable para cada repuesto sin publicarlo automáticamente.

## Procedimiento obligatorio

1. Leer literalmente el código, la marca y cualquier referencia visible en las fotografías.
2. Buscar primero el catálogo oficial del fabricante.
3. Contrastar la aplicación con una segunda fuente técnica cuando exista.
4. No deducir compatibilidad solo por parecido físico, nombre comercial o una publicación de venta.
5. Guardar en `Fuentes` los enlaces directos usados, separados con `|`.
6. Separar cada aplicación o referencia con `|`.
7. Escribir descripciones breves, claras y sin afirmar más de lo que respaldan las fuentes.
8. Asignar confianza `Alta`, `Media` o `Baja`:
   - Alta: fabricante y código exacto coinciden.
   - Media: dos catálogos técnicos coinciden, pero no se encontró el fabricante.
   - Baja: información incompleta o contradictoria.
9. Completar marca, categoría, descripción corta, descripción, compatibilidad, referencias, fuentes y confianza.
10. Cambiar `Revisión` a `Revisar` y mantener `Publicar` en `No`.
11. Dejar una explicación concreta en `Observaciones` cuando falten año, motor, versión, medidas o evidencia.

## Límites

- El bot no inventa códigos equivalentes.
- El bot no convierte una compatibilidad probable en confirmada.
- El bot no modifica cantidad, precio o ubicación física.
- El bot no cambia `Publicar` a `Sí`.
- Si el código no se lee con certeza, conserva la fila en `Investigar` y solicita una fotografía mejor.

La aprobación final corresponde a la persona que controla el inventario.

## Fuentes recordadas y revisadas por el taller

`inventario/fuentes-verificadas.json` conserva 13 enlaces para los 10 productos revisados el 30 de septiembre y aprobados por el taller el 1 de octubre de 2026. Registra código, alias de marca, categoría, código consultable y limitaciones; no almacena claves, precios, existencias ni textos comerciales para copiarlos como evidencia.

Los investigadores del panel y del Excel consultan primero los enlaces correspondientes al código y marca actuales, además de las fuentes ya guardadas en esa ficha. El helper `scripts/fuentes-recordadas.mjs` abre hasta cinco fichas HTML, comprueba nuevamente el código en su texto y entrega al investigador un extracto actual con las advertencias. No basta con que el código aparezca en la URL, un atributo o un script. La aparición del código no demuestra por sí sola cada aplicación: el investigador debe asociar el dato a esa pieza, no a otra fila del catálogo.

Una fuente caída, bloqueada, que cambió de código o que redirige a otro dominio no se considera evidencia actual. El bot puede buscar otras fuentes; tener un enlace en la biblioteca no desbloquea una publicación. Se excluyen redes sociales, recopilaciones de documentos y marketplaces. No se envían credenciales de Supabase ni de IA a esos sitios.

Para `D831C`, la ficha guardada corresponde únicamente a la referencia base `D831`. En el panel se consulta esa base solo si la fotografía confirma el código de venta y la palabra `CERAMIC`. No se trasladan fabricante, prestaciones, garantía ni ajuste exacto desde la pieza equivalente de otra marca. Esta excepción no se aplica a todos los códigos terminados en C.

El panel registra el resultado de esta consulta en `resultado_bot.fuentes_recordadas` y los registros de ejecución muestran cuántos enlaces se pudieron comprobar. No guarda el HTML completo ni reemplaza automáticamente la versión pública: los cambios siguen pendientes de revisión y publicación humana. Guardar la biblioteca no reenvía a investigar todas las fichas aprobadas.

Para añadir fuentes a la biblioteca, comprueba primero el código, marca y alcance, conserva el enlace directo y anota sus límites. No añadas dominios completos como si acreditaran todos sus productos.

Pruebas locales sin consultas de IA ni cambios en Supabase: `pnpm test:fuentes`. Incluyen enlace caído, código parecido, redirecciones, variante cerámica y preservación de fichas publicadas y borradores.
