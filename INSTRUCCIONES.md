# Tecnicentro Keiko — catálogo web

Esta carpeta contiene la página completa lista para GitHub Pages.

## Primera instalación

Sube a la raíz del repositorio todo lo que está aquí:

- `index.html`
- `assets`
- `catalogo`
- `servicios`
- `data`
- `scripts`
- `.github`

Mantén GitHub Pages publicado desde la rama `main` y la carpeta `/ (root)`.

## Trabajo habitual

- Para añadir fotos o videos a un repuesto existente, entra en su carpeta dentro de `catalogo` y súbelos allí.
- Para añadir fotos o videos de un trabajo, entra en la carpeta correspondiente dentro de `servicios` y súbelos allí.
- La foto principal debe llamarse `portada.jpg`, `portada.png` o `portada.webp`.
- El catálogo admite imágenes JPG, PNG, WebP y GIF; y videos MP4 o WebM.
- GitHub actualizará automáticamente el catálogo y las galerías de servicios después del cambio.
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

## Fotos y videos de los servicios

Usa estas carpetas ya creadas:

- `servicios/mecanica-general`
- `servicios/mecanica-rapida`
- `servicios/frenos`
- `servicios/reparacion-motor`
- `servicios/alineacion-computarizada`
- `servicios/balanceo`

Dentro de cada una, la primera imagen debe llamarse `portada.jpg`, `portada.png` o `portada.webp`. Puedes agregar más archivos, por ejemplo `02-trabajo.jpg`, `03-resultado.jpg` o `04-video.mp4`.

La tarjeta mostrará la portada y, al abrirla, aparecerá una galería con todas las fotos y videos. No edites `servicio.json` para añadir archivos.

## Cambiar el logo

Reemplaza `assets/marca/logo/logo.png` por el nuevo logo, conservando exactamente ese nombre. El logo actual ya está incluido.

## Añadir la mascota

Cuando tengas la figura final sin fondo, súbela como:

`assets/marca/mascota/mascota.png`

La página ya tiene reservado el espacio a la derecha de la portada. Puede ser solo el mecánico o el mecánico con el carro. Usa PNG transparente y evita texto dentro de la imagen.

## Si GitHub no deja subir carpetas

GitHub en el navegador puede resultar incómodo para subir una estructura completa. Abre el repositorio con GitHub Desktop, copia dentro todos los archivos y carpetas de este paquete, y después usa **Commit to main** y **Push origin**. Para cambios pequeños también puedes entrar en una carpeta desde GitHub y usar **Add file → Upload files**.
