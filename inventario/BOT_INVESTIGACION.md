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

## Comprobación del código fotografiado

Tanto el investigador del Excel como el del panel requieren un código legible en la fotografía que coincida con el capturado. Una lectura vacía, sin letras ni números, distinta o fallida no permite aceptar la propuesta, aunque la búsqueda textual devuelva información. En el Excel también se exige que el resultado confirme `codigo_coincide: true` como booleano.

En esos casos se solicita una foto nítida de la etiqueta. La fila del Excel permanece en `Investigar`, sin modificar sus datos; el producto nuevo del panel queda en `revisar` con el aviso de atención. Una reverificación de un producto publicado conserva su ficha pública y cualquier borrador humano existente.

Este control comprueba el código leído; la compatibilidad, las equivalencias y las fuentes siguen requiriendo revisión humana.

## Fuentes y evidencia de aplicaciones

Ambos investigadores descargan las fuentes y comprueban el código exacto en el texto de páginas HTML. Se usan únicamente dominios técnicos reconocidos en `scripts/verificar-fuentes.mjs`; los distribuidores de esa lista tienen URL documentada en el reporte de investigación del repositorio. Una fuente legítima que no esté en la lista requiere revisión humana antes de incorporarla. No se reconoce un dominio por contener el nombre de un fabricante como parte de otro dominio.

Cada compatibilidad y referencia propuesta requiere una evidencia con `campo`, `valor`, `url` y `cita`. La cita debe aparecer literalmente en la fuente comprobada y contener tanto el código consultado como el valor propuesto. Una URL, el código aislado o una cita inventada no bastan. Las redirecciones se validan antes de consultar cada destino. Los subdominios de un fabricante cuentan como un único dominio.

Se conservan las evidencias comprobadas en el resultado interno del panel y en el reporte del Excel, sin guardar páginas completas. El panel las muestra bajo “Evidencia de la última investigación” para que la persona revisora pueda abrir la fuente y confirmar la aplicación. No demuestran por sí solas el significado técnico de la cita, las afirmaciones de las descripciones ni los cambios manuales: estos siguen requiriendo revisión humana.

Este control puede dejar bloqueadas páginas que requieren JavaScript, documentos PDF o aplicaciones expresadas como tablas cuyo texto no conserve el código y el dato juntos. No se deduce la compatibilidad en esos casos.

Las pruebas se ejecutan con `pnpm test:investigacion` o `node --test tests/investigacion.test.mjs tests/verificar-fuentes.test.mjs`. Usan inventarios temporales y sustituyen todas las solicitudes externas; no necesitan credenciales reales ni modifican producción.
