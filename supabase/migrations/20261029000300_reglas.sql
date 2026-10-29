-- Todas las reglas de negocio en un solo lugar. Devuelve cada incumplimiento como una fila;
-- el trigger lanza el primero y validar_registro() se los entrega todos al formulario.
-- p_colega_id es null cuando el colega aún no existe (no tiene horas previas).
create function privado.errores_registro(
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
  v_fin_jornada time := privado.fin_jornada();
  v_tope_dia integer;
  v_tope_semana integer := privado.config_minutos('tope_semanal_min');
  v_lunes date := date_trunc('week', p_fecha)::date;
  v_minutos integer;
  v_minutos_dia integer;
  v_minutos_semana integer;
  v_cruce text;
  v_dia_pareja date;
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
  v_minutos := (extract(epoch from (p_final - p_inicio)) / 60)::integer;

  if v_tipo = 'habil' and p_inicio <> v_fin_jornada then
    return query select 'HE_INICIO_JORNADA', 'hora_inicio',
      format('En día hábil la jornada termina a las %s y las horas extras deben empezar a esa '
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

  select coalesce(sum(r.minutos_totales), 0) into v_minutos_dia
  from public.registros r
  where r.colega_id = p_colega_id and r.fecha_horas_extras = p_fecha and r.estado = 'registrada';

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
        format('Sábados, domingos y festivos admiten máximo %s horas extras. Este registro suma '
               || '%s y el día ya tenía %s.', privado.formato_horas(v_tope_dia),
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

  -- El descanso se mira por día de la semana, aunque el sábado o el domingo sea festivo
  -- y aunque la pareja caiga en otro mes (sábado 31 y domingo 1).
  if extract(isodow from p_fecha) in (6, 7) then
    v_dia_pareja := case when extract(isodow from p_fecha) = 6 then p_fecha + 1 else p_fecha - 1 end;
    if exists (
      select 1 from public.registros r
      where r.colega_id = p_colega_id and r.fecha_horas_extras = v_dia_pareja
        and r.estado = 'registrada'
    ) then
      return query select 'HE_DESCANSO', 'fecha_horas_extras',
        format('El colega ya tiene horas extras el %s %s. Debe descansar uno de los dos días '
               || 'del fin de semana.',
               case when extract(isodow from v_dia_pareja) = 6 then 'sábado' else 'domingo' end,
               to_char(v_dia_pareja, 'DD/MM/YYYY'));
    end if;
  end if;
end
$$;

create function privado.validar_registro() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_error record;
  -- Lo único que cambia al anular; las columnas generadas se excluyen porque en un trigger
  -- BEFORE todavía no están calculadas.
  v_editables text[] := array['estado', 'fecha_anulacion', 'motivo_anulacion', 'codigo',
                              'minutos_totales'];
begin
  if tg_op = 'UPDATE' then
    if current_setting('he.anulando', true) is distinct from 'si'
       or old.estado <> 'registrada' or new.estado <> 'anulada'
       or (to_jsonb(new) - v_editables) is distinct from (to_jsonb(old) - v_editables)
    then
      raise exception using
        message = 'Los registros no se modifican. Si hay un error, anúlelo y regístrelo de nuevo.',
        detail = 'HE_REGISTRO_INMUTABLE', errcode = '42501';
    end if;
    return new;
  end if;

  -- Serializa los registros de un mismo colega para que dos simultáneos no superen los topes.
  perform pg_advisory_xact_lock(hashtext('horas_extras:' || new.colega_id::text));

  new.tipo_dia := privado.tipo_dia(new.fecha_horas_extras);
  new.estado := 'registrada';
  new.fecha_anulacion := null;
  new.motivo_anulacion := null;

  select e.codigo, e.mensaje into v_error
  from privado.errores_registro(new.colega_id, new.nivel, new.fecha_horas_extras,
                                new.hora_inicio, new.hora_final, new.justificacion) e
  limit 1;

  if found then
    raise exception using message = v_error.mensaje, detail = v_error.codigo, errcode = 'P0001';
  end if;
  return new;
end
$$;

create trigger validar_registro
  before insert or update on public.registros
  for each row execute function privado.validar_registro();

create function privado.impedir_borrado() returns trigger
language plpgsql
as $$
begin
  raise exception using
    message = 'Los registros no se borran; se anulan.',
    detail = 'HE_REGISTRO_INMUTABLE', errcode = '42501';
end
$$;

create trigger impedir_borrado
  before delete on public.registros
  for each row execute function privado.impedir_borrado();
