# Estado visible del taller

La tarjeta de la página lee `estado-taller.json`. En `estado` puedes usar:

- `automatico`: muestra abierto o cerrado según el horario.
- `disponible`: disponible.
- `limitado`: quedan pocos espacios.
- `ocupado`: taller ocupado.
- `cerrado`: cerrado.

También puedes escribir un `mensaje` personalizado. Actualiza `actualizado` con fecha y hora en formato ISO. `automatico` sigue el horario; cualquier otro estado es manual y tiene prioridad incluso fuera del horario.

Después de cambiar el archivo hay que hacer commit y push. Una segunda etapa puede conectar esta misma tarjeta con un panel privado para cambiarla desde el celular sin usar GitHub.
