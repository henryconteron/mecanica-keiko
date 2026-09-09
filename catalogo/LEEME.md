# Cómo añadir fotos, videos y productos

## Añadir fotos o videos a un producto existente

1. En GitHub, abre `catalogo` y luego la carpeta del producto.
2. Pulsa **Add file > Upload files**.
3. Sube fotos JPG, PNG o WebP; o videos MP4/WebM.
4. Si quieres elegir la imagen principal, llámala `portada.jpg` o `portada.png`.
5. Confirma con **Commit changes**.

El catálogo se actualiza automáticamente. No hace falta editar `index.html`.

## Añadir un producto nuevo

1. Copia el contenido de `_PLANTILLA/producto.json`.
2. Crea `catalogo/codigo-del-producto/producto.json`.
3. Completa los datos y cambia `publicado` a `true` únicamente cuando la compatibilidad y el estado estén confirmados.
4. Sube las fotos y videos a esa misma carpeta.

Usa nombres de carpeta en minúsculas, sin espacios ni tildes. Ejemplo: `catalogo/31911-2e000/`.

## Reglas prácticas

- Una carpeta representa un solo producto o código.
- No borres `producto.json`.
- Evita videos MOV; conviértelos a MP4 antes de subirlos.
- Para quitar temporalmente un producto, cambia `publicado` a `false`.
- Cuando se venda, cambia `stock` a `0` y `publicado` a `false`.
