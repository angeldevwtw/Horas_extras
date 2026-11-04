-- Registro de varios días a la vez para un mismo colega: se guardan todos o ninguno.
-- Cada día pasa por las mismas reglas que un registro suelto, y además se revisa lo que los
-- días elegidos suman entre ellos (tope semanal, festivo con su sábado, días repetidos).

-- Lo que el colega ya tiene registrado entre dos fechas, ampliado a semanas completas para
-- que el formulario pueda sumar cada semana. Solo totales por día y códigos, como resumen_colega.
create function public.dias_del_colega(p_identificacion text, p_desde date, p_hasta date)
returns table (fecha date, minutos integer, codigos text)
language sql stable security definer
set search_path = ''
as $$
  select r.fecha_horas_extras, sum(r.minutos_totales)::integer,
         string_agg(r.codigo, ', ' order by r.id)
  from public.registros r
  where r.identificacion = upper(btrim(p_identificacion))
    and r.estado = 'registrada'
    and p_hasta - p_desde between 0 and 92
    and r.fecha_horas_extras between date_trunc('week', p_desde)::date
                                 and date_trunc('week', p_hasta)::date + 6
  group by r.fecha_horas_extras
$$;

-- p_dias: [{"fecha": "2026-11-03", "inicio": "17:00", "final": "19:00"}, ...]
-- Los errores del colega (nivel, justificación) salen una sola vez, sin fecha.
create function privado.errores_varios(
  p_colega_id uuid,
  p_nivel integer,
  p_dias jsonb,
  p_justificacion text
) returns table (fecha date, codigo text, campo text, mensaje text)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_tope_semana integer := privado.config_minutos('tope_semanal_min');
  v_dia record;
  v_semana integer;
begin
  return query
  select null::date, e.codigo, e.campo, e.mensaje
  from privado.errores_registro(p_colega_id, p_nivel, null, null, null, p_justificacion) e
  where e.campo in ('nivel', 'justificacion');

  if jsonb_typeof(p_dias) is distinct from 'array' or jsonb_array_length(p_dias) = 0 then
    return query select null::date, 'HE_FECHA_REQUERIDA', 'fecha_horas_extras',
      'Seleccione al menos un día.';
    return;
  end if;
  if jsonb_array_length(p_dias) > 62 then
    return query select null::date, 'HE_DEMASIADOS_DIAS', 'fecha_horas_extras',
      'Se pueden registrar máximo 62 días a la vez.';
    return;
  end if;

  for v_dia in
    with dias as (
      select d.fecha, d.inicio, d.final,
             greatest(coalesce((extract(epoch from (d.final - d.inicio)) / 60)::integer, 0), 0)
               as minutos
      from jsonb_to_recordset(p_dias) as d(fecha date, inicio time, final time)
    )
    select d.*,
      count(*) over (partition by d.fecha) as veces,
      date_trunc('week', d.fecha)::date as lunes,
      -- Lo que suman los días elegidos anteriores de la misma semana.
      coalesce(sum(d.minutos) over (partition by date_trunc('week', d.fecha) order by d.fecha
                                    rows between unbounded preceding and 1 preceding), 0)
        as minutos_previos,
      -- Festivo entre semana cuyo sábado también está en la selección, o al revés.
      (select min(o.fecha) from dias o
        where privado.tipo_dia(d.fecha) = 'festivo'
          and extract(isodow from d.fecha) between 1 and 5
          and o.fecha = privado.sabado_del_festivo(d.fecha)) as sabado_elegido,
      (select min(o.fecha) from dias o
        where extract(isodow from d.fecha) = 6
          and privado.tipo_dia(o.fecha) = 'festivo'
          and extract(isodow from o.fecha) between 1 and 5
          and privado.sabado_del_festivo(o.fecha) = d.fecha) as festivo_elegido
    from dias d
    order by d.fecha
  loop
    if v_dia.fecha is null then
      return query select null::date, 'HE_FECHA_REQUERIDA', 'fecha_horas_extras',
        'Hay un día sin fecha.';
      continue;
    end if;
    if v_dia.veces > 1 then
      return query select v_dia.fecha, 'HE_FECHA_REPETIDA', 'fecha_horas_extras',
        'Ese día está más de una vez en la selección.';
      continue;
    end if;

    -- El tope semanal se calcula abajo, contando también los otros días elegidos.
    return query
    select v_dia.fecha, e.codigo, e.campo, e.mensaje
    from privado.errores_registro(p_colega_id, p_nivel, v_dia.fecha, v_dia.inicio, v_dia.final,
                                  p_justificacion) e
    where e.campo not in ('nivel', 'justificacion') and e.codigo <> 'HE_TOPE_SEMANAL';

    select coalesce(sum(r.minutos_totales), 0) into v_semana
    from public.registros r
    where r.colega_id = p_colega_id
      and r.fecha_horas_extras between v_dia.lunes and v_dia.lunes + 6
      and r.estado = 'registrada';

    if v_semana + v_dia.minutos_previos + v_dia.minutos > v_tope_semana then
      return query select v_dia.fecha, 'HE_TOPE_SEMANAL', 'hora_final',
        format('El máximo es %s horas extras a la semana. Del lunes %s al domingo %s el colega '
               || 'ya lleva %s, los días anteriores de esta selección suman %s y este día %s.',
               privado.formato_horas(v_tope_semana), to_char(v_dia.lunes, 'DD/MM/YYYY'),
               to_char(v_dia.lunes + 6, 'DD/MM/YYYY'), privado.formato_horas(v_semana),
               privado.formato_horas(v_dia.minutos_previos::integer),
               privado.formato_horas(v_dia.minutos));
    end if;

    if v_dia.sabado_elegido is not null then
      return query select v_dia.fecha, 'HE_DESCANSO', 'fecha_horas_extras',
        format('En la selección también está el sábado %s. Los festivos solo se pueden registrar '
               || 'si no se trabajó el sábado.', to_char(v_dia.sabado_elegido, 'DD/MM/YYYY'));
    end if;
    if v_dia.festivo_elegido is not null then
      return query select v_dia.fecha, 'HE_DESCANSO', 'fecha_horas_extras',
        format('En la selección también está el festivo %s. Los festivos solo se permiten si no '
               || 'se trabaja el sábado.', to_char(v_dia.festivo_elegido, 'DD/MM/YYYY'));
    end if;
  end loop;
end
$$;

-- Para el formulario: todos los incumplimientos de la selección, sin guardar nada.
create function public.revisar_varios(
  p_identificacion text,
  p_nivel integer,
  p_dias jsonb,
  p_justificacion text
) returns table (fecha date, codigo text, campo text, mensaje text)
language sql stable security definer
set search_path = ''
as $$
  select e.fecha, e.codigo, e.campo, e.mensaje
  from privado.errores_varios(
    (select c.id from public.colegas c where c.identificacion = upper(btrim(p_identificacion))),
    p_nivel, p_dias, p_justificacion
  ) e
$$;

-- Guarda todos los días o ninguno. Revisa la selección completa antes de insertar, para no
-- gastar códigos; si aun así un día falla (otro registro simultáneo), se deshace todo.
create function public.registrar_varios(
  p_identificacion text,
  p_nombre_completo text,
  p_cargo text,
  p_nivel integer,
  p_filial text,
  p_dias jsonb,
  p_justificacion text
) returns table (
  id bigint, codigo text, clave_anulacion uuid, identificacion text, nombre_completo text,
  cargo text, nivel smallint, filial text, fecha_horas_extras date, hora_inicio time,
  hora_final time, minutos_totales integer, tipo_dia text, justificacion text
)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_error record;
  v_dia record;
  v_detalle text;
begin
  select e.fecha, e.codigo, e.mensaje into v_error
  from privado.errores_varios(
    (select c.id from public.colegas c where c.identificacion = upper(btrim(p_identificacion))),
    p_nivel, p_dias, p_justificacion
  ) e
  limit 1;
  if found then
    raise exception using
      message = case when v_error.fecha is null then v_error.mensaje
                     else format('%s: %s', to_char(v_error.fecha, 'DD/MM/YYYY'), v_error.mensaje) end,
      detail = v_error.codigo, errcode = 'P0001';
  end if;

  for v_dia in
    select d.fecha, d.inicio, d.final
    from jsonb_to_recordset(p_dias) as d(fecha date, inicio time, final time)
    order by d.fecha
  loop
    begin
      return query
      select r.* from public.registrar_horas(p_identificacion, p_nombre_completo, p_cargo, p_nivel,
                                             p_filial, v_dia.fecha, v_dia.inicio, v_dia.final,
                                             p_justificacion) r;
    exception when sqlstate 'P0001' then
      get stacked diagnostics v_detalle = pg_exception_detail;
      -- Los errores de los datos del colega no son de un día en particular.
      raise exception using
        message = case when v_detalle in ('HE_IDENTIFICACION', 'HE_DATOS_COLEGA') then sqlerrm
                       else format('%s: %s', to_char(v_dia.fecha, 'DD/MM/YYYY'), sqlerrm) end,
        detail = v_detalle, errcode = 'P0001';
    end;
  end loop;
end
$$;

revoke all on function public.dias_del_colega, public.revisar_varios, public.registrar_varios
  from public;
grant execute on function public.dias_del_colega, public.revisar_varios, public.registrar_varios
  to anon, authenticated;
revoke all on function privado.errores_varios from public, anon, authenticated;
