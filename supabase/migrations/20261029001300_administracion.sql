-- Página de administración: con la clave de descarga se ven todos los registros del mes
-- (también los anulados), se descarga el Excel y se anula cualquier registro, aunque la
-- ventana donde se hizo ya esté cerrada.

-- Devuelve null si la clave es correcta, o el {ok: false, ...} que se le responde a la página.
-- Los intentos fallidos se anotan, así que quien la llame no debe lanzar error después.
create function privado.revisar_clave_admin(p_clave text) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_origen text := coalesce(
    split_part(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ',', 1),
    'desconocido');
  v_guardada privado.clave_descarga%rowtype;
begin
  select * into v_guardada from privado.clave_descarga;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'HE_DESCARGA_SIN_CLAVE',
      'mensaje', 'La administración aún no está habilitada: falta definir la clave.');
  end if;

  if (select count(*) from privado.intentos_descarga
      where origen = v_origen and fecha > now() - interval '15 minutes') >= 10 then
    return jsonb_build_object('ok', false, 'codigo', 'HE_DEMASIADOS_INTENTOS',
      'mensaje', 'Demasiados intentos con clave equivocada. Espere 15 minutos.');
  end if;

  if privado.hash_con_sal(coalesce(p_clave, ''), v_guardada.sal) <> v_guardada.hash then
    insert into privado.intentos_descarga (origen) values (v_origen);
    return jsonb_build_object('ok', false, 'codigo', 'HE_CLAVE_DESCARGA',
      'mensaje', 'La clave no es correcta.');
  end if;

  return null;
end
$$;

create function public.registros_admin(p_clave text, p_mes date) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_rechazo jsonb := privado.revisar_clave_admin(p_clave);
  v_desde date := date_trunc('month', p_mes)::date;
begin
  if v_rechazo is not null then
    return v_rechazo;
  end if;

  return jsonb_build_object('ok', true, 'registros', coalesce((
    select jsonb_agg(jsonb_build_object(
      'codigo', r.codigo, 'identificacion', r.identificacion,
      'nombre_completo', r.nombre_completo, 'cargo', r.cargo, 'nivel', r.nivel,
      'filial', r.filial, 'fecha_horas_extras', r.fecha_horas_extras,
      'hora_inicio', r.hora_inicio, 'hora_final', r.hora_final,
      'minutos_totales', r.minutos_totales, 'tipo_dia', r.tipo_dia,
      'justificacion', r.justificacion, 'estado', r.estado,
      'motivo_anulacion', r.motivo_anulacion
    ) order by r.fecha_horas_extras, r.nombre_completo, r.hora_inicio)
    from public.registros r
    where r.fecha_horas_extras >= v_desde
      and r.fecha_horas_extras < (v_desde + interval '1 month')::date
  ), '[]'::jsonb));
end
$$;

create function public.anular_con_clave(p_clave text, p_codigo text, p_motivo text) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_rechazo jsonb := privado.revisar_clave_admin(p_clave);
begin
  if v_rechazo is not null then
    return v_rechazo;
  end if;

  begin
    perform privado.anular_registro_admin(p_codigo, p_motivo);
  exception when others then
    return jsonb_build_object('ok', false, 'codigo', 'HE_ANULACION', 'mensaje', sqlerrm);
  end;
  return jsonb_build_object('ok', true);
end
$$;

revoke all on function privado.revisar_clave_admin from public, anon, authenticated;
revoke all on function public.registros_admin, public.anular_con_clave from public;
grant execute on function public.registros_admin, public.anular_con_clave to anon, authenticated;
