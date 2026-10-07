# Revisión del proyecto — 7 de octubre de 2026

## Cambios aplicados

- Supabase: versión por producto. Una edición atrasada del panel o del bot no puede sobrescribir cambios de otra computadora. Pruebas SQL de concurrencia, privacidad y galerías ejecutadas con `rollback`, sin alterar existencias, precios ni fotos.
- Editor protegido: seis espacios para fotos propias/autorizadas del local y seis por servicio, con vista previa, borrador y retirada individual. Las galerías vacías siguen ocultas; no se generan trabajos ficticios.
- Inventario único del panel: 16 fichas públicas con enlaces permanentes, respaldo de columnas públicas y metadatos sociales. Los ocho enlaces heredados redirigen a la ficha vigente. Sincronización al publicar y ciclo de respaldo cada 30 minutos, sujeto a demoras de GitHub.
- Promociones: fondo blanco, producto completo y formatos de publicación e historia. Las apps disponibles dependen del teléfono y navegador; el escritorio permite descargar y copiar, no publicar directamente en Instagram.
- Hallazgo visual: la única foto de DCPR7E muestra BKR5E-11. El original se conserva, pero se excluye del catálogo y las promociones de DCPR7E. El producto no cambia de código, cantidad o precio. Hace falta una foto real del código correcto.
- Publicaciones: registro privado de consultas, conversaciones, ventas e importes, separado de clics; preparación de texto verificable para difusión orgánica. No se enviaron mensajes ni publicaciones externas.
- Limpieza: retirados el importador/investigador del Excel, sus pruebas, controles antiguos y dependencias `exceljs` y `xlsx`. Se conservan originales, fuentes y registros históricos. El Excel anterior está en la Papelera local y los commits previos permiten recuperarlo; su historial público no fue reescrito.
- La función existente `activar-investigacion` también solicita la sincronización de fichas al publicar. Se actualizó sin ampliar permisos ni consultar su secreto de GitHub.

## Comprobaciones y límites

- `pnpm test:pagina`: seis pruebas de formato, contactos, galerías y correspondencia con SQL.
- `pnpm test:fuentes`: dieciséis pruebas, incluida la edición durante una investigación; no consumen IA de pago.
- `pnpm test:publicacion`: tres pruebas de respaldo público, aislamiento de foto incorrecta y metadatos/imagenes sociales blancas.
- Pruebas visuales en un servidor aislado en memoria, sin introducir clientes ni productos ficticios en producción.
- `pnpm test:live`: diagnóstico de solo lectura de página, panel, catálogo, privacidad y disponibilidad de los 52 objetos originales. Que un archivo responda no demuestra que su referencia sea correcta; por eso también se hizo revisión visual de las portadas.
- Contraseñas filtradas: Supabase limita esa protección a planes Pro o superiores. No se cambió el plan gratuito. Permanecen autenticación, permisos exclusivos y confirmación de contraseña del editor. Esto no equivale a MFA.
- Cada fuente debe respaldar la afirmación y la versión del vehículo, no solamente contener un código. Las búsquedas fallidas dejan una propuesta para revisión; no se certifica ajuste por similitud.
- Botones y formatos se probaron en navegador; la hoja nativa de compartir de cada teléfono y las cachés de Facebook/Instagram dependen de esas plataformas.

## Antes de promocionar

1. Subir una foto correcta de DCPR7E desde Productos → Editar producto; retirar la asociación errónea, guardar y publicar tras revisar.
2. Cuando existan, subir fotos reales autorizadas del local y servicios en 🔒 Página web → Fotos reales del local y servicios.
3. Confirmar precios, existencias y horarios; mantener vigente el token de GitHub de 90 días. No se cambió su vencimiento.
4. Revisar el Perfil de Empresa en Google y preparar una promoción de un producto disponible. Pedir reseñas honestas sin incentivos. Registrar consultas reales para medir qué genera ventas.

Guías: `EDITOR-PAGINA.md`, `LANZAMIENTO.md`, `BOT_INVESTIGACION.md`. Las revisiones anteriores se conservan en el historial Git; no son instrucciones vigentes de importación.
