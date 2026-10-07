# Archivo histórico del inventario

La operación diaria se hace exclusivamente en `admin-estado.html`, conectado a Supabase. Las computadoras comparten el mismo inventario; GitHub conserva el código de la página, no otra lista editable de existencias.

El Excel anterior se retiró a la Papelera de Windows con autorización del taller. También se retiraron su importador, investigador y dependencias. No hay que volver a subirlo ni ejecutar una importación: podría restaurar datos antiguos.

Se conservan esta carpeta, las fotos originales y los registros de `investigacion/` como respaldo y trazabilidad de las fuentes. No son instrucciones de operación vigentes. Los nombres históricos de algunos archivos pueden contener códigos corregidos posteriormente; la ficha vigente se consulta en el panel.

Para capturar, editar precios y cantidades, sustituir fotos o publicar, usa Productos. Para fotos del local y servicios, usa 🔒 Página web → Fotos reales del local y servicios. No se eliminan imágenes originales al retirar una referencia de un borrador.

El bot consulta fuentes asociadas a código, marca y categoría; conserva los resultados para revisión antes de publicar. Pruebas sin consumir IA: `pnpm test:fuentes`. Diagnóstico público de solo lectura: `pnpm test:live`.
