# Editor protegido de la página

Se integra en `admin-estado.html`, pestaña **Página web**. No crea otra cuenta ni comparte permisos con todos los usuarios autenticados: usa la misma cuenta propietaria que ya administra el negocio.

## Uso sin código

1. Ingresa al panel y desbloquea **Página web** con tu contraseña.
2. Selecciona una sección o busca un campo. Los campos explican su propósito y limitan la longitud.
3. **Guardar borrador** conserva tu propuesta en Supabase, disponible también desde la otra computadora. Todavía no cambia la web pública.
4. **Vista previa** muestra la propuesta sin publicarla. Alterna entre celular y computadora. Los enlaces externos y las consultas no salen de esa vista, y no se registran métricas del catálogo.
5. **Publicar página** muestra qué campos cambian y exige confirmar otra vez la contraseña. Los visitantes ven los cambios al abrir o recargar la web.
6. Si algo no gusta, abre **Recuperar una versión**; prepara una anterior, compruébala y publícala. Se conservan las últimas 20 versiones anteriores.

Incluye identidad, títulos y descripciones, menús, portada, imágenes, tarjetas de servicios, introducción del catálogo, instrucciones de compatibilidad, dirección, mapa, teléfonos, horarios, colores y pie de página. Las imágenes nuevas se suben desde el dispositivo, no desde URLs de terceros. No se borran ni sobrescriben las imágenes anteriores.

Los productos (incluyendo su descripción, precio, cantidad y fotografías) siguen en **Productos**. La disponibilidad manual sigue en **Estado del taller**. No se editan código, claves, permisos, diseños arbitrarios ni integraciones desde esta pestaña.

## Instalación

- Publicar los archivos de este cambio en GitHub Pages junto con la página existente.
- Ejecutar una sola vez `supabase/pagina-web.sql` en SQL Editor del proyecto. Es repetible, no modifica las tablas anteriores ni el contenido publicado del negocio.
- Para comprobar seguridad y publicación sin dejar cambios, ejecutar `supabase/pagina-web-pruebas.sql`. Usa una transacción con `rollback`: no publica el texto de prueba ni conserva modificaciones.

## Protección y límites

- Borrador e historial privados por RLS; el visitante solo puede leer `pagina_publica`.
- Sin escrituras directas desde el navegador: las funciones comprueban la cuenta propietaria, validan una lista cerrada de campos y verifican la revisión del borrador.
- Publicar exige autenticación por contraseña en los últimos cinco minutos, comprobada en el servidor mediante el AMR firmado de Supabase. No es un segundo factor: MFA sería un refuerzo adicional que habría que habilitar por separado.
- Dos computadoras comparten la misma versión. Si una cambia el borrador mientras la otra está editando, se rechaza la sobreescritura; copia tu propuesta y desbloquea nuevamente para recargar.
- Texto se presenta como texto, no HTML. Fotografías JPG/PNG/WebP hasta 5 MB; no SVG, scripts ni enlaces externos. Las fotos del borrador permanecen privadas; las referencias publicadas pueden obtener enlaces temporales. No se usa una clave de servicio en el navegador.
- Sin conexión o configuración válida, se conserva la página original. Cambiar un dato no requiere recompilar la web ni ejecutar GitHub Actions.
- Los títulos y metadatos se actualizan en el navegador. Facebook, WhatsApp y algunos buscadores leen el HTML estático y pueden conservar los metadatos originales: estos campos no garantizan cambiar sus tarjetas. Para ello queda como mejora una sincronización del HTML estático en el despliegue; el aviso también figura dentro de la sección del editor.
- Las páginas estáticas históricas de `productos/` conservan sus propios metadatos y datos del producto. Reciben los cambios de teléfono, WhatsApp, nombre y logotipo desde el mismo contenido publicado.
- Fotos subidas y descartadas se conservan para no romper referencias. Su limpieza administrativa y una auditoría de almacenamiento quedan para mantenimiento; el panel no borra archivos automáticamente.

## Verificación

- `node --test tests/pagina-web.test.mjs`: formato, imágenes, contactos, coordenadas, horarios y correspondencia del esquema SQL.
- `node tests/pagina-web-servidor.mjs`: entorno visual aislado con Supabase simulado en memoria; nunca usa cuentas reales.
- `tests/pagina-web-browser.mjs`: prueba automatizada opcional si Playwright está disponible; admite `KEIKO_PLAYWRIGHT_PATH` y `KEIKO_BROWSER_CHANNEL` para usar una instalación existente.
