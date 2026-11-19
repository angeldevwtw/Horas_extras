-- El director asigna la contraseña de sus coordinadores desde "Mi equipo". La cuenta la crea o la
-- cambia la función de Vercel web/api/contrasena-coordinador.ts con la service_role; la base solo
-- decide quién puede: coordinadores activos de la línea del director con sesión. Las cuentas de
-- los directores las sigue creando el super admin en Authentication → Users.

-- Con la sesión del director: dice el correo del coordinador y su cuenta, si ya la tiene.
create function public.autorizar_contrasena_coordinador(p_id uuid) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_director public.jefes := privado.director_actual();
  v_coordinador public.jefes;
begin
  select * into v_coordinador from public.jefes c
  where c.id = p_id and c.director_id = v_director.id and c.rol = 'coordinador';
  if v_coordinador.id is null then
    raise exception using message = 'Ese coordinador no es de su línea.',
      detail = 'HE_SIN_PERMISO', errcode = '42501';
  end if;
  if not v_coordinador.activo then
    return jsonb_build_object('ok', false, 'codigo', 'HE_JEFE',
      'mensaje', 'Active al coordinador antes de asignarle la contraseña.');
  end if;

  return jsonb_build_object('ok', true, 'correo', v_coordinador.correo,
    'usuario_id', (select u.id from auth.users u where lower(u.email) = v_coordinador.correo));
end
$$;

-- Solo para la service_role: la API de administración no cierra sesiones por usuario.
create function public.cerrar_sesiones(p_usuario uuid) returns void
language sql security definer
set search_path = ''
as $$
  delete from auth.sessions where user_id = p_usuario
$$;

revoke all on function public.autorizar_contrasena_coordinador, public.cerrar_sesiones
  from public, anon, authenticated;
grant execute on function public.autorizar_contrasena_coordinador to authenticated;
grant execute on function public.cerrar_sesiones to service_role;
