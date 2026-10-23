# Tecnicentro Keiko — catálogo web

Esta carpeta contiene la página completa lista para GitHub Pages.

## Operación actual — octubre de 2026

El trabajo diario se hace en `admin-estado.html`: productos, fotos, existencias, precios, revisión, publicación e investigación. El panel en Supabase es la fuente compartida entre computadoras. La pestaña Publicaciones muestra clics del catálogo y una agenda de ideas; la agenda no envía publicaciones automáticamente a las redes.

El archivo Excel antiguo fue retirado: ya no es la fuente del inventario. Los productos se administran desde el panel. La investigación periódica vigente consulta Supabase; la importación y la investigación basadas en Excel quedaron desactivadas. `catalogo/` se conserva como respaldo histórico, no como otro inventario activo. El generador sincroniza los productos publicados de Supabase y las galerías de `servicios/`.

Las computadoras comparten los mismos datos. Si otra sesión o el bot modifica un producto mientras lo editas, el control de versión rechaza la sobreescritura: conserva tu propuesta y recarga antes de volver a guardarla.

Para los pasos pendientes y comprobaciones vigentes, consultar `REVISION-PROYECTO.md`. Los textos de la primera prueba comercial están en `LANZAMIENTO.md`, como borradores para revisar, no anuncios ya publicados.

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

- Para registrar o actualizar repuestos, entra en `admin-estado.html`. Guarda el producto y revisa la información antes de publicarla.
- No vuelvas a subir el Excel antiguo al repositorio: el panel es la fuente compartida y el archivo contenía existencias y precios de operación.
- Para añadir, sustituir o retirar una foto de un repuesto, usa **Productos → Editar producto**. Quitar una foto no debe afectar a las demás.
- Para fotos propias/autorizadas del local o servicios, usa **🔒 Página web → Fotos reales del local y servicios**. Guarda el borrador, revisa y publica.
- No añadas repuestos nuevos en `catalogo/`: no se incorporan al inventario vigente del panel.
- El catálogo admite fotos JPG, PNG y WebP. Las galerías de servicios conservan soporte técnico para videos MP4/WebM desde `servicios/`; la carga sin código del editor es de fotografías.
- Al publicar, se solicita la sincronización de fichas y metadatos. El ciclo programado es un respaldo, no una garantía de ejecución puntual de GitHub.
- No es necesario editar `index.html` cada vez.

## Añadir un producto nuevo

Entra en **Productos → + Nuevo**, captura código exacto, nombre, marca, cantidad, precio si está confirmado y fotos legibles. Guarda para investigar. Revisa la descripción, compatibilidades, referencias y fuentes antes de publicar. Una propuesta del bot no acredita por sí sola la aplicación al vehículo.

Si una búsqueda requiere atención, corrige desde **Editar producto** con información comprobada; no cambies el código para hacerlo coincidir con un resultado parecido. Los cambios de un producto publicado quedan pendientes hasta que pulses **Publicar cambios**.

## Compartir un repuesto

En la web o en el panel, abre el producto y pulsa **Compartir promoción**. Puedes preparar una imagen para publicación o historia y descargarla; en dispositivos compatibles también se abre el menú para compartir del sistema. Las aplicaciones que aparezcan dependen del dispositivo, navegador y apps instaladas: la web no puede obligar a que Facebook o Instagram aparezcan ni elegir por ellas publicación, historia o mensaje.

Cada producto publicado tiene una ficha permanente en `productos/panel-UUID/`, con vista previa social. Un producto recién publicado puede usar temporalmente `?producto=` mientras se genera su ficha. Para usar exactamente la promoción preparada, sube la imagen descargada y acompáñala con el texto/enlace del panel. Revisa foto, precio y existencias antes de publicar; una imagen ya descargada no se actualiza después de una venta.

La carpeta `productos` es generada automáticamente. No la edites manualmente.

## Fotos y videos de los servicios

Para cargar fotos sin código, usa preferentemente el editor protegido. Cada servicio tiene seis espacios y el local otros seis; los grupos vacíos no se muestran.

Para mantenimiento técnico de videos y material anterior se conservan estas carpetas:

- `servicios/mecanica-general`
- `servicios/mecanica-rapida`
- `servicios/frenos`
- `servicios/reparacion-motor`
- `servicios/alineacion-computarizada`
- `servicios/balanceo`

Dentro de cada una, la primera imagen debe llamarse `portada.jpg`, `portada.png` o `portada.webp`. Puedes agregar más archivos, por ejemplo `02-trabajo.jpg`, `03-resultado.jpg` o `04-video.mp4`.

La tarjeta mostrará la portada y, al abrirla, aparecerá una galería con todas las fotos y videos. No edites `servicio.json` para añadir archivos.

## Cambiar el logo

Usa **🔒 Página web → Identidad** para cambiar el logo, guarda el borrador, revisa y publica. El archivo `assets/marca/logo/logo.png` es el valor original de respaldo, no hace falta sustituirlo para el trabajo habitual.

## Añadir la mascota

Cuando tengas la figura final sin fondo, súbela como:

`assets/marca/mascota/mascota.png`

La página ya tiene reservado el espacio a la derecha de la portada. Puede ser solo el mecánico o el mecánico con el carro. Usa PNG transparente y evita texto dentro de la imagen.

## Si GitHub no deja subir carpetas

GitHub en el navegador puede resultar incómodo para subir una estructura completa. Abre el repositorio con GitHub Desktop, copia dentro todos los archivos y carpetas de este paquete, y después usa **Commit to main** y **Push origin**. Para cambios pequeños también puedes entrar en una carpeta desde GitHub y usar **Add file → Upload files**.

## Comprobación técnica antes de publicar código

Usa Node.js 22 o superior y pnpm 11.19.0, la versión fijada en `package.json` y CI. Instala con `pnpm install --frozen-lockfile`; no regeneres el lockfile con otro gestor. `pnpm-workspace.yaml` rechaza scripts de dependencias no revisados. Sharp usa los binarios opcionales del lockfile sin ejecutar su script de compilación.

- `pnpm test`: pruebas aisladas de formato, fuentes, bot y publicación; no consultan IA de pago ni escriben a producción.
- `pnpm audit --audit-level=high`: avisos conocidos de dependencias; no equivale a una garantía de seguridad.
- `pnpm test:browser:editor` y `pnpm test:browser:frontend`: navegador aislado con Supabase simulado. Requieren una instalación existente de Playwright (`KEIKO_PLAYWRIGHT_PATH`) y, opcionalmente, `KEIKO_BROWSER_CHANNEL=msedge`. No usan sesiones personales.
- `pnpm test:live`: diagnóstico externo de solo lectura. Compara el código local con lo publicado; puede fallar intencionalmente mientras haya cambios locales aún sin desplegar.

No subas `.env`, tokens ni claves privadas. El código contiene únicamente la clave publicable; los permisos reales se aplican en Supabase. Las modificaciones de acceso, MFA o credenciales se revisan por separado con el dueño.
