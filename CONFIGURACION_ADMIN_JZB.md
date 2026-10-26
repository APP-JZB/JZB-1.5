# Portal de administración JZB — etapa inicial

Proyecto Supabase: `JZB`
- Project ref: `zuqvoutmydvwrykoklgq`
- Región: `sa-east-1` (São Paulo, Brasil)
- API URL: `https://zuqvoutmydvwrykoklgq.supabase.co`

## Alcance actual
La base de datos tiene la tabla `public.profiles`, vinculada a `auth.users`, con RLS habilitada. Los perfiles nacen con rol `user`; el rol administrador debe asignarse de forma controlada. No se cargan oficiales ni datos operativos en esta etapa.

## Crear la cuenta de administrador
1. Entra al panel de Supabase y abre el proyecto JZB.
2. Ve a **Authentication → Users → Add user**.
3. Crea la cuenta para `administradorjzb@gmail.com` con una contraseña fuerte y única. Si aparece la opción, confirma la cuenta.
4. Copia el UUID de esa cuenta desde la lista de usuarios.
5. En SQL Editor, ejecuta el siguiente SQL reemplazando `<UUID_DE_LA_CUENTA>` por el UUID real que copiaste:

```sql
update public.profiles
set role = 'admin',
    email = 'administradorjzb@gmail.com',
    display_name = 'Administrador general JZB',
    updated_at = now()
where id = '<UUID_DE_LA_CUENTA>'::uuid;
```

6. Confirma que se actualizó exactamente una fila:

```sql
select id, email, display_name, role
from public.profiles
where email = 'administradorjzb@gmail.com';
```

No compartas la contraseña en chats, repositorios ni archivos SQL. Si la cuenta aún no aparece en `public.profiles`, verifica primero que el usuario exista en Authentication y que el trigger `on_auth_user_created` esté activo; no crees un perfil con un UUID inventado.

## Seguridad
- No colocar claves secretas ni `service_role` en el cliente web o en el APK.
- No habilitar el registro público como mecanismo para crear administradores.
- La app debe comprobar el rol desde `public.profiles` y las políticas RLS deben seguir aplicándose en la base de datos.
- Antes de habilitar módulos de gestión, validar el acceso con una cuenta normal y confirmar que no puede modificar su propio rol.

## Pendiente
La cuenta Auth no se crea mediante el conector disponible en esta sesión. Debe crearse en Authentication y luego asignarse el rol siguiendo los pasos anteriores.