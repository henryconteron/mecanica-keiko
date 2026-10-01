# Revisión del proyecto — 21 de septiembre de 2026

## Actualización comprobada — 1 de octubre de 2026

Esta actualización sustituye los pendientes antiguos que ya se resolvieron; las notas del 21 de septiembre se conservan debajo como historial, no como estado actual.

### Comprobaciones actuales

- Producción y copia local coinciden en página principal, panel, catálogo y promociones.
- El catálogo público devuelve 10 productos. Los 33 archivos de imagen, incluidas todas las portadas, responden correctamente. Se comprobaron acceso y tipo de archivo, no una inspección visual píxel por píxel de las 33 imágenes.
- Como visitante se puede leer el catálogo, pero no `resultado_bot`, `error_investigacion`, los eventos de interés ni la agenda. Se verificó con la clave pública de la página, sin usar claves privilegiadas.
- La función `activar-investigacion` está ACTIVE, versión 3, con verificación JWT. La API pública de GitHub confirma ejecuciones programadas exitosas. No se disparó una investigación nueva ni se accedió a su token; el estado ACTIVE por sí solo no prueba el recorrido autenticado completo.
- Galería y cierre de ficha: pruebas con servicios simulados en 360×640, 390×844, 844×390 y 1440×900. Promociones para publicación e historia, buscador del panel, eliminación individual de fotos y agenda: correctos.
- Las pruebas del importador y de preservación de datos revisados pasan. Las 15 pruebas de fuentes recordadas pasan sin usar consultas de IA de pago.
- Fuentes: 13 enlaces aprobados para 10 códigos, asociados a marca y categoría. En la prueba de acceso 10 fichas se pudieron leer automáticamente; tres no sirven como evidencia automática en esa ejecución por bloqueo de acceso o ausencia de código en el texto entregado. Se registran las limitaciones y no se aprueba información por el mero hecho de guardar un enlace.
- Fotos existentes: ya se pueden ver y retirar individualmente en el editor. No se aplicó limpieza masiva ni se modificó inventario o fotos durante esta revisión.

### Qué sigue pendiente

1. **Corregir dos identificadores con confirmación del taller.** Las fotografías dicen AFE-1507 y AF7864; el Excel captura AFE-15017 y AFT-7864. Hay fichas de distribuidor para los códigos leídos y propuestas en `inventario/investigacion/propuestas-pendientes-2026-10-01.json`. No se editaron los códigos ni se publicaron esas piezas.
2. **Edición desde dos computadoras.** Sigue pendiente control de versiones para evitar que un guardado o bot atrasado sobrescriba cambios más nuevos. Mientras tanto, no editar el mismo producto a la vez en dos equipos.
3. **Páginas específicas para todos los productos del panel.** El catálogo dinámico incluye 10 productos; las páginas estáticas generadas cubren el inventario anterior. Los enlaces con `?producto=` abren la ficha, pero no garantizan una vista previa social individual. Las imágenes descargables de promoción resuelven otra necesidad; no sustituyen esos metadatos.
4. **Prueba autenticada de punta a punta.** Alta real, publicación, disparo inmediato y actualización del bot deben comprobarse en una operación legítima del taller. No se introdujo un producto ficticio ni se ejecutó una consulta de pago para fingir esa prueba. Mantener vigente el token de GitHub de 90 días; no se consultó su valor ni se cambió su vencimiento.
5. **Evidencia por afirmación.** La fuente debe respaldar cada aplicación, no solo contener el código. Actualmente se comprueba el código y se instruye al investigador para asociar los datos y respetar marca/alcance; una prueba de código no es una certificación de compatibilidad.
6. **Material comercial real.** Las seis galerías de servicios del catálogo están vacías. Hacen falta fotos autorizadas de trabajos reales, sin placas, rostros ni datos personales identificables, además de confirmar precios de las piezas mostradas como Consultar.
7. **Medición de resultados.** En la consulta del 1 de octubre había una apertura de ficha y un clic en compartir registrados en los últimos siete días, sin clics a WhatsApp registrados. Es insuficiente para identificar los productos más demandados. Los eventos no son personas únicas, conversaciones, publicaciones efectivas ni ventas; pueden incluir pruebas del taller.

Para repetir el diagnóstico de producción sin cambiar datos: `pnpm test:live`. Comprueba archivos publicados, catálogo, acceso privado y disponibilidad de fotos; no reproduce todo el comportamiento visual ni la sesión autenticada.

Propuesta de primer lanzamiento: `LANZAMIENTO.md`. Es un borrador orgánico para revisión, no publicaciones enviadas ni anuncios pagados.

## Correcciones aplicadas

- Acceso público limitado a las columnas del catálogo. Los resultados internos, notas y borradores de productos publicados ya no pueden consultarse anónimamente. Aplicado y comprobado también en Supabase.
- Las fotos de tarjetas y galerías tienen un contenedor con dimensiones independientes de la imagen; se conserva el producto completo incluso al girar el teléfono.
- El catálogo puede cargar los productos del panel aunque falle el archivo del catálogo anterior, y avisa cuando la carga es parcial.
- El panel actualiza el progreso cada 15 segundos mientras se consulta el inventario, sin reemplazar formularios abiertos.
- Los productos nuevos entran a investigación después de terminar la subida de fotos; un doble clic no duplica el guardado.
- Una nueva investigación conserva un borrador existente. Las búsquedas fallidas quedan para revisión en vez de repetirse indefinidamente cada ciclo.
- Se puede solicitar otra investigación de un producto que requiere revisión, además de los publicados.
- Renovación de sesiones expiradas y cierre de sesión remoto. Las sesiones anteriores necesitan ingresar nuevamente para obtener un token de renovación.
- Corrección de controles bloqueados al cancelar el procesamiento local de fotos y de las etiquetas para cambiar entre original y foto limpia.
- Caché limitada a los archivos del panel; ya no almacena indefinidamente consultas con parámetros de fecha ni borra cachés ajenas.
- Formularios adaptados a pantallas pequeñas y videos detenidos al cerrar los detalles.

## Comprobaciones

- Prueba de navegador con datos locales y servicios externos simulados: 360×640, 390×844, 844×390 y 1440×900. Galería dentro de su contenedor, imagen completa, botón de consulta, cierre y restauración del desplazamiento.
- Pruebas existentes del importador: alta válida, sustitución de fotos y bloqueo de duplicados.
- Validación de sintaxis de los scripts modificados.
- Consulta real como visitante en Supabase y comprobación de privilegios: catálogo accesible, resultado_bot privado.
- Asesor de seguridad de Supabase: solo advierte que la protección de contraseñas filtradas está desactivada. No se cambió el plan contratado.

## Pendientes y mejoras recomendadas

1. **Activación inmediata del bot:** la lista real de funciones de Supabase está vacía. El código activar-investigacion existe en el repositorio pero falta desplegarlo y configurar GITHUB_WORKFLOW_TOKEN. Actualmente queda el ciclo programado de GitHub, sin garantía de inicio inmediato. No se creó ninguna credencial.
2. **Ficha única por producto:** las páginas estáticas antiguas y el panel son dos fuentes de datos. Conviene unificar la ficha y generar metadatos para redes sociales de los productos nuevos. Compartir una imagen con un enlace no garantiza que Facebook cree una vista previa específica del producto.
3. **Información pegada:** el organizador actual usa reglas de texto, no un modelo de IA. Puede perder secciones de un formato diferente. Recomendado reemplazarlo por extracción estructurada, conservando el texto original y la aprobación humana.
4. **Verificación técnica:** encontrar el código exacto en una página no demuestra cada afirmación sobre compatibilidad, garantía o material. Recomendado guardar evidencia por afirmación y separar datos del empaque de equivalencias técnicas.
5. **Concurrencia:** incorporar control de versiones en guardado/publicación y en el bot para impedir sobrescrituras si dos dispositivos editan simultáneamente.
6. **Fotos:** permitir ordenar y retirar fotos existentes; conservar originales y limpiar archivos huérfanos solo después de comprobar que no se usan. Una subida interrumpida puede dejar archivos sin producto asociado.
7. **Pruebas de producción:** no se subieron productos ficticios ni se ejecutó una investigación pagada. Las pruebas autenticadas completas de alta, publicación e investigación siguen pendientes; la prueba de navegador automatizada usa servicios simulados.

## Repetir las pruebas

`pnpm test:inventario`

`node tests/web-audit.mjs` requiere Playwright y Edge instalado. Puede usarse PLAYWRIGHT_MODULE con la ruta del paquete y BROWSER_CHANNEL para otro navegador compatible.

La operación diaria se realiza en admin-estado.html. El Excel permanece como catálogo anterior/respaldo; no se sincroniza automáticamente con los productos del panel.
