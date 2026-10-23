# Hito JZB

App de tareas, plazos y avisos de la Zona de Bienestar "Arica".

- **App móvil**: Expo / React Native (`App.js`, `src/`).
- **Base de datos**: Supabase (`supabase/schema.sql` y `supabase/seed.sql`).
- **Compilación**: GitHub Actions genera el `.apk` en cada cambio (pestaña *Actions* o *Releases*).

## Cómo funciona el acceso
- **Integrantes**: entran con su número de celular registrado en el encuadramiento y un PIN de 6 dígitos que eligen la primera vez ("Crear mi acceso").
- **Comandante**: entra con su correo (configurado en `config.admin_email`).

## Reglas principales
- La prórroga solo se pide antes del vencimiento. Una tarea vencida obliga a presentarse en la oficina del Comandante y le crea a él la tarea "Resolver vencida".
- Nota = 1,0 + 6,0 × % de tareas cumplidas a tiempo.
- Las reglas de seguridad (quién ve y cambia qué) están en la base de datos (RLS), no en la app.

## Instalar el APK
Descargar `Hito-ZB-Arica.apk` desde *Releases*, abrirlo en el celular y permitir "instalar apps de esta fuente".
