# Auditoría técnica y siguiente etapa — 23 de octubre de 2026

## Alcance y estado

Web pública, catálogo, fichas permanentes, imágenes sociales, panel, editor, promociones, investigación, seguridad de entrada/salida, automatizaciones, pruebas y guías de operación. Correcciones preparadas en `codex/auditoria-2026-10-23`; pendientes de revisión humana antes de integrar y desplegar. No se modificaron datos de Supabase, credenciales, permisos, precios, existencias ni fotos originales. No se enviaron mensajes ni publicaciones a redes, no se compraron servicios y no se ejecutó investigación con IA real.

Las guías de revisión de código, seguridad y pruebas orientaron el trabajo: cada fallo funcional se reprodujo antes de corregirse, se revisaron límites de confianza y se preservaron los cambios compartidos entre computadoras. La guía de accesibilidad se aplicó a correcciones puntuales, no a un rediseño ni a una certificación WCAG completa.

## Estado de producción comprobado antes de los cambios

- 16 productos publicados: sin diferencias respecto del respaldo local en código, nombre, precio, stock, marca, categoría, descripciones, compatibilidad y referencias.
- 16 fichas permanentes disponibles y coincidentes con los archivos locales de partida; 15 imágenes sociales disponibles. La excepción intencional es DCPR7E, cuya foto asociada muestra BKR5E-11 y permanece excluida.
- Los 52 objetos originales de fotografías responden correctamente. Su disponibilidad no demuestra identidad o compatibilidad: la foto de DCPR7E sigue necesitando sustitución.
- Las lecturas anónimas de investigaciones, errores internos, consultas comerciales, agenda y métricas fueron denegadas. No se probaron escrituras contra producción ni acceso de otra cuenta autenticada en esta auditoría.
- Las ejecuciones recientes de investigación y sincronización en GitHub finalizaron correctamente. El historial observado muestra demoras de horas pese a la frecuencia programada: el cron de GitHub no es una cola con plazo garantizado. El disparo desde el panel sigue siendo el camino principal.
- Auditoría nativa de dependencias: sin avisos conocidos. Revisión de patrones de credenciales en 217 archivos versionados y 92 commits: sin coincidencias de claves privadas reconocidas. No es una certificación de ausencia de secretos o de vulnerabilidades desconocidas.

## Fallos corregidos

| Prioridad | Fallo reproducido | Corrección y protección |
| --- | --- | --- |
| P2 | El bot permitía propuestas listas con código fotográfico vacío o baja confianza | Exige código legible coincidente y confianza Alta/Media, sin sustituir la ficha publicada o el borrador humano cuando falta evidencia |
| P2 | Una web genérica que repetía el código podía pasar como fuente técnica | Solo acepta dominios acreditados o de la biblioteca revisada del taller; no descarga un dominio nuevo solo porque lo sugiera la IA |
| P2 | Dos subdominios del mismo fabricante podían elevar la confianza a Alta | Cuenta raíces técnicas acreditadas, no alias `www`/catálogo; sigue sin garantizar independencia empresarial |
| P2 | URLs de apariencia pública podían resolver hacia redes privadas | Verifica todos los registros DNS A/AAAA y las redirecciones, con rechazo de IP privadas/reservadas y presupuesto temporal |
| P2 | Consultas a Supabase o descarga de foto podían colgar el bot | Tiempo máximo de 20 segundos por solicitud y límite del trabajo de GitHub; los errores no autorizan una ficha |
| P2 | La agenda podía difundir precio, texto y fotos todavía en borrador | Promociona únicamente la fila publicada, sin mezclar `edicion_pendiente` |
| P2 | Productos sin existencias podían prepararse como promociones | Bloqueo en agenda, detalle, catálogo y ficha; se mantiene la consulta de reposición |
| P2 | Red o firma de foto colgada dejaba el catálogo sin terminar de cargar | Presupuesto de 8 segundos y respaldo ante fallos; una respuesta remota válida vacía no resucita productos retirados |
| P2 | Despublicar todos los productos dejaba fichas antiguas accesibles como inventario vigente | Un catálogo vacío válido retira las fichas generadas y vacía respaldo/sitemap; errores HTTP o de formato conservan el estado anterior |
| P2 | Las pruebas dependían de que DCPR7E existiera siempre | Pruebas para inventario vacío, otros códigos y retirada de productos; el caso de foto incorrecta sigue protegido |
| P2 | Enlaces permanentes no alimentaban las métricas del panel | Helper común de los tres eventos existentes: ficha, clic a WhatsApp y abrir compartir. Solo código/evento, sin datos personales; vista previa silenciada |
| P2 | Quitar logo, portada o imagen social no se reflejaba en la vista dinámica | Retirada y restauración explícitas de imágenes opcionales; originales preservados |
| P2 | Colores configurables podían dejar textos ilegibles | Contraste negro/blanco y consumo de variables en controles afectados, con pruebas de colores claros, oscuros y grises |
| P2 | Las comprobaciones automáticas no cubrían el bot ni las nuevas pruebas | CI amplía sintaxis, pruebas aisladas completas, instalación congelada y auditoría de dependencias; sin secretos de producción en el trabajo de calidad |
| P2 | La sincronización con escritura podía activarse al subir una rama de trabajo | Publicación automática restringida a `main`; las ramas de revisión solo pasan calidad, no solicitan despliegues |
| P2 | El arnés del editor rechazaba sus propios archivos en Windows | Contención mediante ruta relativa, sin el doble separador que causaba HTTP 403 |
| P3 | Las guías indicaban crear productos en un catálogo histórico y describían concurrencia como pendiente | Operación diaria desde el panel; documentación actualizada y respaldo histórico señalado como tal |
| P3 | Faltaban exclusiones para archivos locales de credenciales | `.gitignore` cubre `.env`, claves privadas y salidas de prueba; no se borraron archivos del usuario |

## Modelo de amenazas y límites

Los límites relevantes son visitante → API pública, propietario → panel/RPC/Storage, documento externo/IA → propuesta del bot y Supabase publicado → generador/GitHub Pages. Los activos a proteger son credenciales, edición autorizada, inventario correcto, borradores y consultas internas.

- Autorización real en Supabase/RPC y permisos mínimos; la clave publicable no es una contraseña ni concede por sí sola acceso privado. Los controles del navegador no sustituyen políticas del servidor.
- Se revisaron los SQL y la función existentes; no se aplicaron migraciones ni se consultaron ajustes privados actuales de Auth/Storage. Las pruebas SQL históricas no se presentan como ejecutadas de nuevo.
- DNS rebinding: la comprobación previa reduce SSRF, pero `fetch` vuelve a resolver. Fijar la IP en un transporte validado o aislar la salida de red es un endurecimiento pendiente; no se afirma aislamiento total.
- Una página que contiene un código no acredita todos sus vehículos, materiales o garantías. El extractor HTML no es un navegador completo y puede incluir contenido oculto. La revisión humana de pieza/vehículo continúa siendo obligatoria; no se activó publicación técnica automática.
- Dos dominios distintos pueden pertenecer a la misma empresa. El umbral de fuentes es un filtro, no una certificación de independencia.
- La sesión SPA está en `sessionStorage`; JavaScript del mismo origen puede leerla si hubiera XSS. Migrar a cookies HttpOnly/BFF o activar MFA requiere una decisión de arquitectura y configuración del dueño, no se cambió silenciosamente.
- GitHub Pages entrega HTTPS/HSTS, pero la respuesta revisada no trae CSP, X-Frame-Options, X-Content-Type-Options ni Referrer-Policy. Una etiqueta HTML no puede sustituir todos esos encabezados. Revisar un alojamiento/proxy compatible si se endurece el panel; no se cambió proveedor ni plan.
- Los eventos anónimos pueden ser enviados por bots y no prueban intención de compra. Consultas y ventas requieren registro real; no convertir clics o aperturas de compartir en ventas/publicaciones completadas.
- Navegador: pruebas aisladas de escritorio/celular con API simulada, no dispositivos físicos ni la hoja nativa de compartir de todas las aplicaciones. Chrome DevTools MCP no estaba configurado; se usó Playwright aislado con Edge, sin sesiones personales.

## Comprobaciones reproducibles

Resultado final local: **53/53 pruebas Node**, **11/11 escenarios de regresión de navegador**, editor aislado completo y arnés de galería/promociones/panel correctos. No se omitieron ni relajaron pruebas para obtener el resultado. Las comprobaciones de navegador utilizaron Edge aislado y API simulada; no certifican todos los teléfonos ni la ejecución futura de GitHub Actions.

- `pnpm test`: suite aislada de Node, sin IA pagada ni datos reales.
- `pnpm test:publicacion`: respaldo, fichas, metadatos, eventos y ciclo de despublicación mediante carpetas temporales y API local.
- `pnpm test:browser:editor`: acceso, borrador, vista previa segura, publicación simulada, historial, celular y conflictos entre computadoras.
- `pnpm test:browser:frontend`: catálogo lento/vacío, separación público/borrador, stock cero, métricas, imágenes opcionales y contraste, con capturas locales.
- `pnpm test:browser:web`: galería, publicación/historia y operación del panel con contratos simulados actuales.
- `pnpm test:live`: lectura de producción. Mientras esta rama difiera de lo desplegado, no sirve como afirmación de despliegue; se ejecutó contra el código base antes de los cambios.
- `pnpm audit --audit-level=high`, comprobación de sintaxis y `git diff --check`.
- Prueba de sensibilidad: desactivar temporalmente la guarda OCR hizo fallar la regresión correspondiente; se restauró inmediatamente. Las pruebas no se limitan a confirmar la implementación.
- En un pase paralelo de Windows, una carpeta de fixture en el temporal compartido desapareció entre su creación y escritura, antes de ejecutar la aplicación. No se identificó la causa externa y no se atribuye a un limpiador. Se aisló el arnés en una raíz privada ignorada del repositorio, con un directorio y marcador de propiedad por caso y sin reintentos que oculten el fallo; la evidencia original está en el registro local de pruebas.

## Qué potenciar ahora

El siguiente paso no es añadir más automatizaciones de publicación: es cerrar información comercial y comprobar demanda con una prueba pequeña.

### 1. Preparación del taller

- Sustituir la foto de DCPR7E por una real del código correcto. No promocionar ese producto hasta entonces.
- Hay 3 precios numéricos públicos y 13 productos con “Consultar”. Elegir 3–5 repuestos disponibles y confirmar precio por unidad/juego, costo, margen y cantidad real. No publicar costos internos ni inventar precios.
- Entre los productos con precio registrado están AFP-523 (USD 7, cinco unidades), Mobis 31911-2E000 (USD 30, tres) y SP1502 (USD 20, una). Son datos observados, no una predicción de demanda ni una reserva. Confirmarlos nuevamente antes de difundir; la unidad única SP1502 no es una campaña de volumen.
- Definir zona atendida, retiro/entrega, horarios y quién responderá consultas. No prometer envíos, instalación o garantías no confirmados.
- Subir fotos propias autorizadas del local/servicios cuando existan. El editor ya tiene espacio; no crear imágenes que aparenten trabajos reales del negocio.

### 2. Descubrimiento sin anuncios

Comprobar quién administra el Perfil de Empresa de Google y que nombre, teléfono, dirección, horarios y enlace sean correctos. Google documenta relevancia, distancia y prominencia como factores; completar el perfil y mantener datos precisos ayuda a que lo entienda, pero no garantiza posiciones. [Guía oficial](https://support.google.com/business/answer/7091?hl=es).

Pedir reseñas honestas a clientes reales, sin regalos ni descuentos y sin exigir que sean positivas. [Política y consejos de Google](https://support.google.com/business/answer/3474122?hl=es).

No añadir precios ficticios, reseñas inventadas o garantías a los datos estructurados para obtener tarjetas de Google. Los datos deben representar el contenido real visible. [Directrices oficiales](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).

### 3. Prueba de 14 días, propuesta no programada

- Días 1–2: completar ficha comercial y foto de los productos seleccionados; revisar el perfil de Google y el recorrido móvil hasta WhatsApp.
- Días 3–14: probar dos promociones de repuestos y una de servicio real por semana, reutilizadas como estados/historias. Grupos locales únicamente si admiten avisos. Es una cadencia inicial a evaluar, no un horario de máxima demanda demostrado.
- Cada consulta: registrar código y canal, pedir modelo/año/motor o referencia de la pieza, confirmar ajuste y presupuesto; actualizar la misma oportunidad si termina en conversación o venta. No guardar nombres, teléfonos ni placas en notas.
- Revisar a los siete y catorce días: consultas reales, aplicaciones confirmadas, ventas, margen y causas de no concretar. Comparar exposición semejante; no decidir una compra grande por uno o dos clics.
- Mantener lo que genere conversaciones útiles y ventas con margen. Solo entonces valorar automatizar contenidos repetitivos o anuncios, con autorización y límites explícitos.

Puedo ayudar a seleccionar piezas con información comprobada, resumir fichas, preparar textos e imágenes usando fotos reales y analizar resultados. El taller aporta precio/costo, inventario físico, ajuste final al vehículo y permiso de publicación. No sustituir esos datos por predicciones de IA.

## Mantenimiento posterior, no bloqueante para la prueba pequeña

- Separar el listado de oportunidades abiertas de los contadores de últimos 30 días: hoy las consultas antiguas quedan fuera de esa vista.
- Aplanar explícitamente sobre blanco las fotos transparentes cuando se desactiva el quita-fondos; verificar antes de reemplazar originales.
- Revisar el vencimiento del token de GitHub en su cuenta; no se leyó ni cambió su duración.
- Reducir firmas/transferencia inicial de fotos si aumenta el catálogo; medir antes de añadir cachés o más dependencias.
- Integrar el navegador aislado en CI con versión revisada de Playwright; por ahora las regresiones de navegador se ejecutan localmente y CI corre Node/sintaxis/auditoría.
- Revisar con el dueño la protección de `main` para exigir revisión y calidad antes de integrar. Esta auditoría no cambió permisos de GitHub ni reglas de acceso.

## Integración y recuperación

Revisar los commits de esta rama, ejecutar las comprobaciones, integrar con aprobación humana y verificar GitHub Pages y el bot. Las fichas generadas deben cargar el nuevo helper de eventos antes del controlador de ficha. Si se revierte, revertir los commits correspondientes y volver a desplegar; no hay migración de datos que deshacer. No usar `reset --hard` ni borrar fotos, fuentes o archivos históricos del negocio.
