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
pnpm inventario:importar
pnpm catalogo:generar
```

## Fotografías

Se admiten JPG, JPEG, PNG, WebP y GIF. La primera fotografía se convierte en portada. También se acepta una subcarpeta por código, por ejemplo `inventario/fotos/31911-2E000/`.

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
