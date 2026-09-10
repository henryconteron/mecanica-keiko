# Protocolo del bot de investigación

El bot trabaja únicamente con las filas incluidas en `pendientes-investigacion.csv` y con las fotografías correspondientes de `inventario/fotos`. La captura inicial puede contener solo ID interno, código, nombre y cantidad.

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
