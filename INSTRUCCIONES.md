# Tecnicentro Keiko — catálogo web

Esta carpeta contiene la página completa lista para GitHub Pages.

## Primera instalación

Sube a la raíz del repositorio todo lo que está aquí:

- `index.html`
- `assets`
- `catalogo`
- `data`
- `scripts`
- `.github`

Mantén GitHub Pages publicado desde la rama `main` y la carpeta `/ (root)`.

## Trabajo habitual

- Para añadir fotos o videos a un repuesto existente, entra en su carpeta dentro de `catalogo` y súbelos allí.
- La foto principal debe llamarse `portada.jpg`, `portada.png` o `portada.webp`.
- El catálogo admite imágenes JPG, PNG, WebP y GIF; y videos MP4 o WebM.
- GitHub actualizará automáticamente `data/catalogo.json` después del cambio.
- No es necesario editar `index.html` cada vez.

## Añadir un producto nuevo

Copia la estructura de `catalogo/_PLANTILLA`, ponle como nombre de carpeta un código corto sin espacios y completa `producto.json`. Luego sube las fotos o videos a esa misma carpeta.

Los campos esenciales son:

- `codigo`
- `nombre`
- `categoria`
- `precio`
- `stock`
- `descripcion`
- `compatibilidad`
- `publicado`

Usa `publicado: false` mientras los datos no estén confirmados. Cámbialo a `true` cuando el producto esté listo para mostrarse.

## Compartir un repuesto

En la web, abre el producto y pulsa **Compartir enlace** o **Compartir en Facebook**. Cada producto tiene su propia página y su propio enlace. Al compartirlo, Facebook podrá mostrar el nombre, precio y foto principal de esa pieza.

La carpeta `productos` es generada automáticamente. No la edites manualmente.
