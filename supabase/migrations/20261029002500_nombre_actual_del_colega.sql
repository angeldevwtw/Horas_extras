-- Un colega es su cédula. Si escribe su nombre distinto en otro registro ("Angel Ramos" en vez de
-- "Angel Francisco Ramos Castillo"), las listas, las gráficas y el Excel muestran siempre el nombre
-- más reciente de esa cédula, que es el que guarda public.colegas. Cada registro conserva en
-- registros.nombre_completo lo que se escribió ese día.

create or replace function privado.registro_json(p_registro public.registros) returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'codigo', p_registro.codigo, 'identificacion', p_registro.identificacion,
    'nombre_completo', (select c.nombre_completo from public.colegas c where c.id = p_registro.colega_id),
    'cargo', p_registro.cargo,
    'nivel', p_registro.nivel, 'filial', p_registro.filial,
    'fecha_horas_extras', p_registro.fecha_horas_extras,
    'hora_inicio', p_registro.hora_inicio, 'hora_final', p_registro.hora_final,
    'minutos_totales', p_registro.minutos_totales, 'tipo_dia', p_registro.tipo_dia,
    'justificacion', p_registro.justificacion, 'estado', p_registro.estado,
    'motivo_anulacion', p_registro.motivo_anulacion, 'aprobacion', p_registro.aprobacion,
    'motivo_decision', p_registro.motivo_decision,
    'coordinador', (select j.nombre from public.jefes j where j.id = p_registro.coordinador_id),
    'director', (select j.nombre from public.jefes j where j.id = p_registro.director_id),
    'decidido_por', (select j.nombre from public.jefes j where j.id = p_registro.decidido_por)
  )
$$;

create or replace function public.registros_admin(p_clave text, p_mes date) returns jsonb
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
    select jsonb_agg(privado.registro_json(r)
                     order by r.fecha_horas_extras, c.nombre_completo, r.hora_inicio)
    from public.registros r
    join public.colegas c on c.id = r.colega_id
    where r.fecha_horas_extras >= v_desde
      and r.fecha_horas_extras < (v_desde + interval '1 month')::date
  ), '[]'::jsonb));
end
$$;

create or replace function public.descargar_registros(p_clave text, p_mes date) returns jsonb
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
    select jsonb_agg(privado.registro_json(r)
                     order by r.fecha_horas_extras, c.nombre_completo, r.hora_inicio)
    from public.registros r
    join public.colegas c on c.id = r.colega_id
    where r.estado = 'registrada' and r.aprobacion = 'aprobada'
      and r.fecha_horas_extras >= v_desde
      and r.fecha_horas_extras < (v_desde + interval '1 month')::date
  ), '[]'::jsonb));
end
$$;

create or replace function public.registros_equipo(p_mes date) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_jefe public.jefes := privado.jefe_actual();
  v_desde date := date_trunc('month', p_mes)::date;
begin
  if v_jefe.id is null then
    raise exception using message = 'Esta cuenta no es de un director ni de un coordinador activo.',
      detail = 'HE_SIN_PERMISO', errcode = '42501';
  end if;

  return jsonb_build_object(
    'registros', coalesce((
      select jsonb_agg(privado.registro_json(r)
                       order by r.fecha_horas_extras, c.nombre_completo, r.hora_inicio)
      from public.registros r
    join public.colegas c on c.id = r.colega_id
      where (r.coordinador_id = v_jefe.id or r.director_id = v_jefe.id)
        and r.fecha_horas_extras >= v_desde
        and r.fecha_horas_extras < (v_desde + interval '1 month')::date
    ), '[]'::jsonb),
    -- Los pendientes salen siempre, sean del mes que sean, para que ninguno quede sin decidir.
    'pendientes', coalesce((
      select jsonb_agg(privado.registro_json(r)
                       order by r.fecha_horas_extras, c.nombre_completo, r.hora_inicio)
      from public.registros r
    join public.colegas c on c.id = r.colega_id
      where (r.coordinador_id = v_jefe.id or r.director_id = v_jefe.id)
        and r.estado = 'registrada' and r.aprobacion = 'pendiente'
    ), '[]'::jsonb));
end
$$;
