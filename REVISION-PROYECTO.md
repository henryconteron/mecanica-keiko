# Revisión del proyecto — 21 de septiembre de 2026

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
