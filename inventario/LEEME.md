# Inventario de repuestos

El archivo `Inventario_Keiko.xlsx` es la fuente de captura masiva. Los productos que ya existen en la web aparecen con `Publicar = Mantener` para que una actualización de cantidad o precio no los oculte.

## Trabajo del día

1. Abre `Inventario_Keiko.xlsx` y añade una fila por código de repuesto.
2. Para la captura inicial basta con ID interno, código, nombre y cantidad. Marca `Revisión = Investigar`.
3. Toma las fotos y colócalas en `inventario/fotos`.
4. Nombra las fotos con el código y el orden: `CODIGO_01.jpg`, `CODIGO_02.jpg`. También se acepta el formato con dos guiones bajos.
5. Usa `Revisión = Investigar` si faltan compatibilidad, referencias o fuentes. El flujo de Groq leerá las fotos, consultará la web y abrirá una propuesta en **Pull requests** llamada `Investigación lista para revisar`.
6. Usa `Revisión = Aprobado` y `Publicar = Sí` solamente después de verificar la información.
7. Sube el Excel y las fotos a GitHub. La automatización valida, importa y actualiza la página.

También puedes validar localmente:

```powershell
pnpm install
pnpm inventario:validar
```

Para importar y regenerar la web:

```powershell
node scripts/importar-inventario.mjs --conservar-fotos
pnpm catalogo:generar
```

## Fotografías

Se admiten JPG, JPEG, PNG, WebP y GIF. La primera fotografía se convierte en portada. También se acepta una subcarpeta por código, por ejemplo `inventario/fotos/31911-2E000/`.

Las actualizaciones de GitHub conservan las fotos actuales salvo que cambien archivos de `inventario/fotos`. Para reimportarlas manualmente, activa `importar_fotos` al ejecutar el flujo de actualización. En una importación local, omite `--conservar-fotos` solo cuando quieras reemplazar las copias del catálogo con los originales.

## Revisión de fuentes del 30 de septiembre de 2026

El registro `investigacion/verificacion-manual-2026-09-30.json` contiene textos contrastados, fuentes y límites para los diez productos publicados del panel. Dos códigos del inventario sin confirmar permanecen pendientes y no se publican.

La revisión posterior del 1 de octubre confirmó en las seis fotos los códigos `AFE-1507` y `AF7864`. Con permiso del taller se corrigieron las filas del Excel antes capturadas como `AFE-15017` y `AFT-7864`, conservando cantidad 5, precio Consultar y los originales. `investigacion/propuestas-pendientes-2026-10-01.json` conserva las fuentes, textos y límites: siguen en `Revisar`, con `Publicar = No`. Las fuentes están en las filas para una próxima investigación; no equivalen a una aprobación de todas sus aplicaciones.

`correcciones-codigos.json` registra exclusivamente esas asociaciones autorizadas y los nombres exactos de las tres fotos de cada pieza. La importación mantiene los IDs de las carpetas anteriores para no duplicarlas ni perder fotos; puede completar un borrador sin imágenes incluso con `--conservar-fotos`, pero no sustituye sus imágenes existentes. El investigador acepta esa asociación explícita, sigue leyendo el código real en el empaque y bloquea una asociación parcial. Una corrección no se aplica a otra marca ni por parecido del código. Un Excel desactualizado que intente restablecer esos códigos antiguos se bloquea para revisión.

El 1 de octubre, con autorización del taller, se crearon las dos fichas en el panel de Supabase con sus textos, fuentes, cantidad 5 y precio Consultar. Tras habilitar el usuario el permiso de URL de archivo de Edge, se subieron y vincularon **tres fotos originales por pieza**, en orden 01, 02, 03. Ambas fichas quedaron **aprobadas, sin publicar**. Se comprobaron los seis objetos JPEG y sus tamaños; no se alteraron las diez fichas publicadas anteriores. Pueden revisarse y publicarse desde el panel; evita publicarlas también desde el Excel para no mantener dos fichas. El Excel y el panel no se sincronizan automáticamente. El registro completo es `investigacion/preparacion-panel-2026-10-01.json`.

Los datos del panel sí son compartidos: las dos computadoras consultan el mismo proyecto de Supabase. Al actualizar la lista ven los cambios guardados desde cualquiera de ellas. La protección contra sobrescrituras propuesta no crea inventarios distintos; impediría guardar una versión antigua sobre una más nueva. Todavía no está implementada. Las copias locales del código se actualizan desde GitHub con `git pull`, no mediante la sincronización del inventario.

Para las ocho fichas que también existen en este inventario, la importación aplica los textos revisados si la identidad y los datos técnicos del Excel siguen siendo los anteriores. Las cantidades y precios se toman del Excel sin alterarlos. Si editas la marca, el nombre, la categoría o los datos técnicos del Excel, prevalece tu nueva edición y deja de aplicarse esa corrección registrada. No se modifica el archivo Excel ni se bloquean las ediciones del panel.

## Biblioteca de fuentes para próximas búsquedas

`fuentes-verificadas.json` conserva 13 enlaces revisados para los diez productos, asociados a su código, marca y categoría. Los dos investigadores los consultan primero, leen el contenido actual y reciben las advertencias de la revisión. Si una ficha ya no abre o no muestra el código, no sirve como evidencia; el bot debe buscar otra fuente. Recordar un enlace no significa aprobar automáticamente sus datos ni publicarlos.

No hace falta ejecutar nuevamente todos los productos aprobados: la biblioteca se usará en la siguiente solicitud de investigación. En el panel, los cambios de una nueva verificación siguen siendo un borrador hasta que los revises y publiques. Las fotos, precios y cantidades no cambian por guardar estas fuentes. Más detalles en `BOT_INVESTIGACION.md`; pruebas locales con `pnpm test:fuentes`.

## Estados

- `Capturado`: conteo básico realizado.
- `Investigar`: el bot debe buscar datos técnicos.
- `Revisar`: la propuesta del bot necesita revisión humana.
- `Aprobado`: información verificada y lista para publicar.
- `Publicado`: artículo ya publicado.

El importador crea un borrador con esos cuatro datos básicos y usa `Por clasificar` como categoría temporal. Nunca publica una fila marcada `Investigar` o `Revisar`. Para publicar exige nombre, categoría confirmada, cantidad válida, descripción, compatibilidad, fuentes y al menos una fotografía.

Todas las fotos originales se guardan en `inventario/fotos` con el formato `CODIGO_01`, `CODIGO_02`, etc. El importador crea automáticamente las copias que necesita la página dentro de `catalogo`; no edites esas copias manualmente.

Los resultados se guardan en `reporte-validacion.json` y `pendientes-investigacion.csv`.

## Activar el investigador Groq

1. En GitHub abre **Settings → Secrets and variables → Actions**.
2. Crea un secreto de repositorio llamado `GROQ_API_KEY` y pega allí la clave. Nunca la escribas en el Excel ni la subas como archivo.
3. En **Settings → Actions → General**, activa **Allow GitHub Actions to create and approve pull requests**.
4. Sube el Excel y las fotografías. La pestaña **Actions** mostrará `Investigar repuestos pendientes`.
5. Cuando termine, abre **Pull requests → Investigación lista para revisar**. Allí verás qué productos quedaron `Revisar`, cuáles se bloquearon y por qué.
6. Descarga o abre el Excel propuesto, comprueba las fuentes y corrige cualquier dato necesario. Aceptar la propuesta no publica los productos.
7. Para dar el paso final, cambia `Revisión` a `Aprobado` y `Publicar` a `Sí`, y vuelve a subir el Excel.

El investigador usa visión para leer la foto principal y `groq/compound-mini` con búsqueda web básica. Nunca modifica cantidad, precio o ubicación, nunca corrige silenciosamente un código distinto al visible y nunca publica sin aprobación humana.
