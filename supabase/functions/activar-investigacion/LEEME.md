# Disparo inmediato de investigación

Esta función recibe la solicitud desde el Panel Keiko y activa el flujo de GitHub sin exponer ningún token en la página pública.

Configuración única en Supabase:

1. Publicar la función `activar-investigacion`.
2. Crear el secreto `GITHUB_WORKFLOW_TOKEN` con un token fino de GitHub limitado al repositorio `henryconteron/mecanica-keiko` y permiso **Actions: Read and write**.
3. Mantener la verificación de JWT activada. La función también valida el identificador de la administradora antes de llamar a GitHub.

Después de eso, guardar un producto o pulsar “Verificar información de nuevo” inicia el bot inmediatamente. El horario de GitHub queda como respaldo.
