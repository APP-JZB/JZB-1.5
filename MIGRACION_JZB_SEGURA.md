# Migración de Hito ZB Arica a JZB

## Estado
Preparación de migración. No ejecutar borrados ni cambiar el proyecto Supabase activo hasta disponer de respaldo verificado y confirmar el proyecto destino.

## Hallazgos confirmados en el código fuente adjunto
- El acceso de integrantes usa un correo técnico derivado del teléfono (`<dígitos>@hito.app`) y PIN/contraseña.
- El acceso administrativo usa correo y contraseña.
- `supabase/schema.sql` define `public.members`, tareas, prórrogas, eventos, mural y `public.config`, con RLS habilitada.
- `public.link_new_user()` asocia al administrador mediante `config.admin_email` y `member_id`; para integrantes asocia por los dígitos telefónicos.
- La función `supabase/functions/usuarios-admin/index.ts` contiene un UUID de propietario fijo. Antes de reutilizarla en JZB hay que quitar esa dependencia y autorizar las acciones mediante rol verificado en la base de datos.
- `supabase/seed.sql` incluye nómina, correo administrativo, unidades, centros de costo y datos de Zona de Bienestar “Arica”. No deben cargarse en la nueva unidad.
- El esquema base `members` no declara un campo `email`; hay que diseñar una migración explícita si el correo de notificaciones se almacenará allí.
- El código usa más tablas y RPC creadas por scripts SQL adicionales; no es seguro borrar solamente las seis tablas del esquema base y declarar limpia la base.

## Configuración objetivo aprobada
- Correo de administrador institucional: `administradorjzb@gmail.com`.
- Perfil personal de Ignacio: teléfono `+56954269381`, correo de notificaciones `i.acuna.h15@gmail.com`, sección Logística.
- Nómina inicial: los 11 oficiales proporcionados por el responsable del proyecto.
- Los datos operativos y la nómina de la unidad anterior no deben importarse.
- RLS debe permanecer habilitada.
- Contraseña temporal inicial propuesta para los integrantes: últimos seis dígitos del teléfono; tratarla como débil y temporal, exigir cambio de contraseña en servidor antes de habilitar el resto de la app. No desplegar esta regla hasta que exista el flujo de cambio forzado.
- No guardar ni incluir contraseñas en SQL, seed, repositorio o APK.

## Secuencia segura pendiente
1. Confirmar el proyecto Supabase destino por referencia no secreta y generar una copia de seguridad verificable.
2. Inventariar tablas, vistas, funciones, triggers, políticas RLS, buckets Storage y usuarios Auth del proyecto activo.
3. Preparar un esquema limpio JZB y un seed exclusivo con los 11 oficiales; conservar IDs estables para referencias internas.
4. Implementar el acceso por teléfono y contraseña usando un identificador de Auth consistente, y almacenar el correo de notificaciones como dato separado.
5. Cambiar la función administrativa para autorizar por rol de base de datos, no por UUID fijo; mantener la clave de servicio solo en secretos de Edge Functions.
6. Añadir bandera de cambio obligatorio de contraseña y bloqueo de operaciones hasta completarlo.
7. Probar RLS con cuenta de administrador y cuenta de sección; probar también un usuario no vinculado y un integrante que intente modificar permisos.
8. Desplegar en el proyecto destino, verificar cuentas y solo entonces generar una APK candidata.

## Acciones que este archivo NO realiza
No conecta con Supabase, no crea cuentas Auth, no cambia permisos y no borra datos. Es una hoja de control para evitar una limpieza parcial o irreversible.
