-- Si el colega ya tiene registrado el día (hábil: cualquier registro; sábado o festivo: el
-- tope completo), se avisa con un mensaje claro en la fecha en lugar del cruce de horarios.
-- resumen_colega devuelve además lo registrado ese día, para avisar apenas se elige la fecha.

drop function public.resumen_colega(text, date);

create function public.resumen_colega(p_identificacion text, p_fecha date)
returns table (minutos_semana integer, tope_semana integer, lunes date, domingo date,
               minutos_dia integer, codigos_dia text)
language sql stable security definer
set search_path = ''
as $$
  with semana as (select date_trunc('week', p_fecha)::date as lunes),
  del_colega as (
    select r.fecha_horas_extras, r.minutos_totales, r.codigo, r.id
    from public.registros r
    where r.identificacion = upper(btrim(p_identificacion)) and r.estado = 'registrada'
  )
  select
    coalesce(sum(d.minutos_totales), 0)::integer,
    privado.config_minutos('tope_semanal_min'),
    semana.lunes,
    semana.lunes + 6,
    coalesce(sum(d.minutos_totales) filter (where d.fecha_horas_extras = p_fecha), 0)::integer,
    string_agg(d.codigo, ', ' order by d.id) filter (where d.fecha_horas_extras = p_fecha)
  from semana
  left join del_colega d on d.fecha_horas_extras between semana.lunes and semana.lunes + 6
  group by semana.lunes
$$;

revoke all on function public.resumen_colega from public;
grant execute on function public.resumen_colega to anon, authenticated;

create or replace function privado.errores_registro(
  p_colega_id uuid,
  p_nivel integer,
  p_fecha date,
  p_inicio time,
  p_final time,
  p_justificacion text
) returns table (codigo text, campo text, mensaje text)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_hoy date := privado.ahora()::date;
  v_tipo text;
  v_fin_jornada time;
  v_tope_dia integer;
  v_tope_semana integer := privado.config_minutos('tope_semanal_min');
  v_lunes date := date_trunc('week', p_fecha)::date;
  v_minutos integer;
  v_minutos_dia integer;
  v_minutos_semana integer;
  v_cruce text;
  v_codigos_dia text;
  v_sabado date;
  v_festivo date;
  v_meses text[] := array['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                          'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
begin
  if p_nivel is null or p_nivel not in (68, 73, 78) then
    return query select 'HE_NIVEL', 'nivel',
      'Solo se pueden registrar horas extras a colegas de nivel 68 (Analista - Ejecutivo), '
      || '73 (Asistentes) o 78 (Conductor).';
  end if;

  if p_justificacion is null or btrim(p_justificacion) = '' then
    return query select 'HE_JUSTIFICACION', 'justificacion', 'La justificación es obligatoria.';
  end if;

  if p_fecha is null then
    return query select 'HE_FECHA_REQUERIDA', 'fecha_horas_extras', 'La fecha es obligatoria.';
    return;
  end if;

  if date_trunc('month', p_fecha) <> date_trunc('month', v_hoy) then
    return query select 'HE_FECHA_FUERA_DEL_MES', 'fecha_horas_extras',
      format('La fecha debe ser del mes en curso (%s de %s).',
             v_meses[extract(month from v_hoy)::integer], extract(year from v_hoy));
  end if;

  if extract(isodow from p_fecha) = 7 then
    return query select 'HE_DOMINGO', 'fecha_horas_extras',
      'Los domingos no se pueden registrar horas extras.';
    return;
  end if;

  if p_inicio is null or p_final is null then
    return query select 'HE_HORAS_REQUERIDAS', 'hora_inicio',
      'La hora de inicio y la hora final son obligatorias.';
    return;
  end if;

  if p_final <= p_inicio or p_final >= time '24:00' then
    return query select 'HE_HORAS_INVALIDAS', 'hora_final',
      'La hora final debe ser posterior a la hora de inicio, sin pasar de la medianoche.';
    return;
  end if;

  v_tipo := privado.tipo_dia(p_fecha);
  v_fin_jornada := privado.fin_jornada_del_dia(p_fecha);
  v_minutos := (extract(epoch from (p_final - p_inicio)) / 60)::integer;

  -- Un día hábil admite un solo registro (empieza al terminar la jornada); sábados y festivos,
  -- varios bloques hasta el tope. Si el día ya no admite más, se dice eso y nada más.
  select coalesce(sum(r.minutos_totales), 0), string_agg(r.codigo, ', ' order by r.id)
    into v_minutos_dia, v_codigos_dia
  from public.registros r
  where r.colega_id = p_colega_id and r.fecha_horas_extras = p_fecha and r.estado = 'registrada';

  if v_minutos_dia > 0
     and (v_tipo = 'habil' or v_minutos_dia >= privado.config_minutos('tope_fin_semana_min')) then
    return query select 'HE_DIA_REGISTRADO', 'fecha_horas_extras',
      format('El colega ya tiene horas extras registradas el %s (%s). Ese día no admite más.',
             to_char(p_fecha, 'DD/MM/YYYY'), v_codigos_dia);
    return;
  end if;

  if v_tipo = 'habil' and p_inicio <> v_fin_jornada then
    return query select 'HE_INICIO_JORNADA', 'hora_inicio',
      format('Ese día la jornada termina a las %s y las horas extras deben empezar a esa '
             || 'hora, sin pausas.', to_char(v_fin_jornada, 'FMHH12:MI AM'));
  end if;

  if p_colega_id is not null then
    select string_agg(r.codigo, ', ' order by r.id) into v_cruce
    from public.registros r
    where r.colega_id = p_colega_id
      and r.fecha_horas_extras = p_fecha
      and r.estado = 'registrada'
      and r.hora_inicio < p_final
      and r.hora_final > p_inicio;

    if v_cruce is not null then
      return query select 'HE_SOLAPAMIENTO', 'hora_inicio',
        format('El horario se cruza con otro registro del colega ese día (%s).', v_cruce);
    end if;
  end if;

  if v_tipo = 'habil' then
    v_tope_dia := privado.config_minutos('tope_diario_min');
    if v_minutos_dia + v_minutos > v_tope_dia then
      return query select 'HE_TOPE_DIARIO', 'hora_final',
        format('En un día hábil se permiten máximo %s horas extras. Este registro suma %s y el '
               || 'día ya tenía %s.', privado.formato_horas(v_tope_dia),
               privado.formato_horas(v_minutos), privado.formato_horas(v_minutos_dia));
    end if;
  else
    v_tope_dia := privado.config_minutos('tope_fin_semana_min');
    if v_minutos_dia + v_minutos > v_tope_dia then
      return query select 'HE_TOPE_FIN_DE_SEMANA', 'hora_final',
        format('Sábados y festivos admiten máximo %s horas extras. Este registro suma %s y el '
               || 'día ya tenía %s.', privado.formato_horas(v_tope_dia),
               privado.formato_horas(v_minutos), privado.formato_horas(v_minutos_dia));
    end if;
  end if;

  -- Semana de lunes a domingo, aunque cruce de un mes a otro.
  select coalesce(sum(r.minutos_totales), 0) into v_minutos_semana
  from public.registros r
  where r.colega_id = p_colega_id
    and r.fecha_horas_extras between v_lunes and v_lunes + 6
    and r.estado = 'registrada';

  if v_minutos_semana + v_minutos > v_tope_semana then
    return query select 'HE_TOPE_SEMANAL', 'hora_final',
      format('El máximo es %s horas extras a la semana. Del lunes %s al domingo %s el colega ya '
             || 'lleva %s y le quedan %s.',
             privado.formato_horas(v_tope_semana), to_char(v_lunes, 'DD/MM/YYYY'),
             to_char(v_lunes + 6, 'DD/MM/YYYY'), privado.formato_horas(v_minutos_semana),
             privado.formato_horas(greatest(v_tope_semana - v_minutos_semana, 0)));
  end if;

  -- Festivo entre lunes y viernes: no si el colega trabajó su sábado (puede caer en otro mes).
  if v_tipo = 'festivo' and extract(isodow from p_fecha) between 1 and 5 then
    v_sabado := privado.sabado_del_festivo(p_fecha);
    if exists (
      select 1 from public.registros r
      where r.colega_id = p_colega_id and r.fecha_horas_extras = v_sabado
        and r.estado = 'registrada'
    ) then
      return query select 'HE_DESCANSO', 'fecha_horas_extras',
        format('El colega trabajó el sábado %s. Los festivos solo se pueden registrar si no se '
               || 'trabajó el sábado.', to_char(v_sabado, 'DD/MM/YYYY'));
    end if;
  end if;

  -- Sábado: no si el colega ya tiene horas en un festivo que depende de ese sábado.
  if extract(isodow from p_fecha) = 6 then
    select r.fecha_horas_extras into v_festivo
    from public.registros r
    join public.festivos f on f.fecha = r.fecha_horas_extras
    where r.colega_id = p_colega_id and r.estado = 'registrada'
      and extract(isodow from f.fecha) between 1 and 5
      and privado.sabado_del_festivo(f.fecha) = p_fecha
    limit 1;
    if v_festivo is not null then
      return query select 'HE_DESCANSO', 'fecha_horas_extras',
        format('El colega ya tiene horas extras el festivo %s. Los festivos solo se permiten si '
               || 'no se trabaja el sábado.', to_char(v_festivo, 'DD/MM/YYYY'));
    end if;
  end if;
end
$$;
