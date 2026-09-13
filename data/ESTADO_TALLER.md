# Estado visible del taller

La tarjeta de la página lee `estado-taller.json`. En `estado` puedes usar:

- `automatico`: muestra abierto o cerrado según el horario.
- `disponible`: disponible.
- `limitado`: quedan pocos espacios.
- `ocupado`: taller ocupado.
- `cerrado`: cerrado.

También puedes escribir un `mensaje` personalizado. Actualiza `actualizado` con fecha y hora en formato ISO. `automatico` sigue el horario; cualquier otro estado es manual y tiene prioridad incluso fuera del horario.

Mientras Supabase no esté conectado, después de cambiar el archivo hay que hacer commit y push. Al completar la configuración remota podrás entrar a `admin-estado.html` desde el celular y actualizar la página sin tocar GitHub.

## Conectar el panel privado

1. Crea un proyecto gratuito en Supabase.
2. Abre **SQL Editor**, copia el contenido de `supabase/estado-taller.sql` y ejecútalo.
3. En **Authentication → Users**, crea el usuario administrador con tu correo y una contraseña segura. Mantén desactivado el registro público.
4. En **Project Settings → API**, copia la URL del proyecto y la clave pública `anon`.
5. Escríbelas en `assets/config.js`. La clave `anon` puede estar en una web pública; las políticas SQL impiden que visitantes modifiquen el estado.
6. Haz commit y push. Después abre `https://henryconteron.github.io/mecanica-keiko/admin-estado.html` e inicia sesión.

Nunca coloques en el proyecto la clave `service_role`, la contraseña del administrador ni un token de sesión.
