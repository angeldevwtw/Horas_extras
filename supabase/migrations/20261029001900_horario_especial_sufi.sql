-- Sufi tiene un horario especial: en día hábil se marca la jornada (inicio y final, máximo hasta
-- las 9:00 PM) y se indica aparte el total de horas extras, que ya no sale de restar las horas.
-- Los topes son los mismos. Sábado, domingo y festivo siguen igual que en las demás filiales.

insert into public.configuracion (clave, valor, descripcion) values
  ('fin_jornada_sufi', '21:00', 'Hora máxima en que termina la jornada de Sufi en día hábil');

-- Deja de ser una columna generada. Los valores ya guardados se conservan.
alter table public.registros alter column minutos_totales drop expression;
alter table public.registros alter column minutos_totales set not null;

alter table public.registros add constraint registros_minutos_totales check (
  minutos_totales > 0 and minutos_totales % 30 = 0
  and minutos_totales <= (extract(epoch from (hora_final - hora_inicio)) / 60)::integer
  and ((filial = 'Sufi' and tipo_dia = 'habil')
       or minutos_totales = (extract(epoch from (hora_final - hora_inicio)) / 60)::integer)
);

create function privado.fin_jornada_sufi() returns time
language sql stable security definer
set search_path = ''
as $$
  select valor::time from public.configuracion where clave = 'fin_jornada_sufi'
$$;

create function privado.horario_especial(p_filial text, p_fecha date) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(p_filial = 'Sufi', false) and privado.tipo_dia(p_fecha) = 'habil'
$$;

-- Con horario especial el total es el indicado; si no se indica, y en todos los demás casos,
-- es la diferencia entre las horas.
create function privado.minutos_del_registro(
  p_filial text, p_fecha date, p_inicio time, p_final time, p_minutos integer
) returns integer
language sql stable security definer
set search_path = ''
as $$
  select case when privado.horario_especial(p_filial, p_fecha) and p_minutos is not null then p_minutos
              else (extract(epoch from (p_final - p_inicio)) / 60)::integer end
$$;

-- Cambian las firmas: se quitan las anteriores para que no queden dos versiones.
drop function privado.errores_registro(uuid, integer, date, time, time, text);
drop function privado.errores_varios(uuid, integer, jsonb, text);
drop function public.registrar_horas(text, text, text, integer, text, date, time, time, text);
drop function public.revisar_registro(text, integer, date, time, time, text);
drop function public.revisar_varios(text, integer, jsonb, text);

create function privado.errores_registro(
  p_colega_id uuid,
  p_nivel integer,
  p_fecha date,
  p_inicio time,
  p_final time,
  p_justificacion text,
  p_filial text default null,
  p_minutos integer default null
) returns table (codigo text, campo text, mensaje text)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_hoy date := privado.ahora()::date;
  v_mes_actual date := date_trunc('month', v_hoy)::date;
  v_mes_anterior date := (date_trunc('month', v_hoy) - interval '1 month')::date;
  v_tipo text;
  v_fin_jornada time;
  v_tope_dia integer;
  v_tope_semana integer := privado.config_minutos('tope_semanal_min');
  v_lunes date := date_trunc('week', p_fecha)::date;
  v_especial boolean;
  v_minutos integer;
  v_minutos_dia integer;
  v_minutos_semana integer;
  v_cruce text;
  v_codigos_dia text;
  v_sabado date;
  v_pareja date;
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

  if p_fecha < v_mes_anterior or p_fecha >= v_mes_actual + interval '1 month' then
    return query select 'HE_FECHA_FUERA_DEL_MES', 'fecha_horas_extras',
      format('La fecha debe ser del mes anterior o del mes en curso (%s de %s a %s de %s).',
             v_meses[extract(month from v_mes_anterior)::integer], extract(year from v_mes_anterior),
             v_meses[extract(month from v_mes_actual)::integer], extract(year from v_mes_actual));
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
  v_especial := privado.horario_especial(p_filial, p_fecha);
  v_minutos := privado.minutos_del_registro(p_filial, p_fecha, p_inicio, p_final, p_minutos);

  -- Un día hábil admite un solo registro (empieza al terminar la jornada); fines de semana y festivos,
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

  if v_especial then
    if p_final > privado.fin_jornada_sufi() then
      return query select 'HE_FIN_SUFI', 'hora_final',
        format('En Sufi la jornada termina máximo a las %s.',
               to_char(privado.fin_jornada_sufi(), 'FMHH12:MI AM'));
    end if;
    if v_minutos <= 0 or v_minutos % 30 <> 0
       or v_minutos > (extract(epoch from (p_final - p_inicio)) / 60)::integer then
      return query select 'HE_TOTAL_INVALIDO', 'minutos_totales',
        'El total de horas extras debe ir en medias horas y caber dentro de la jornada.';
    end if;
  elsif v_tipo = 'habil' and p_inicio <> v_fin_jornada then
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
        format('Sábados, domingos y festivos admiten máximo %s horas extras. Este registro suma %s y el '
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

  -- Festivo entre lunes y viernes: no si el colega trabajó su fin de semana, el sábado o el
  -- domingo (puede caer en otro mes).
  if v_tipo = 'festivo' and extract(isodow from p_fecha) between 1 and 5 then
    v_sabado := privado.sabado_del_festivo(p_fecha);
    select r.fecha_horas_extras into v_pareja
    from public.registros r
    where r.colega_id = p_colega_id and r.fecha_horas_extras in (v_sabado, v_sabado + 1)
      and r.estado = 'registrada'
    limit 1;
    if v_pareja is not null then
      return query select 'HE_DESCANSO', 'fecha_horas_extras',
        format('El colega trabajó el %s %s. Los festivos solo se pueden registrar si no se '
               || 'trabajó ese fin de semana.', privado.nombre_fin_de_semana(v_pareja),
               to_char(v_pareja, 'DD/MM/YYYY'));
    end if;
  end if;

  -- Fin de semana: se trabaja el sábado o, por excepción, el domingo (quien descansa el
  -- sábado), nunca los dos. Tampoco si ya tiene horas en un festivo que depende de ese fin de
  -- semana.
  if extract(isodow from p_fecha) in (6, 7) then
    v_pareja := case when extract(isodow from p_fecha) = 6 then p_fecha + 1 else p_fecha - 1 end;
    if exists (
      select 1 from public.registros r
      where r.colega_id = p_colega_id and r.fecha_horas_extras = v_pareja
        and r.estado = 'registrada'
    ) then
      return query select 'HE_DESCANSO', 'fecha_horas_extras',
        format('El colega ya tiene horas extras el %s %s. En un fin de semana se trabaja el '
               || 'sábado o el domingo, no los dos.', privado.nombre_fin_de_semana(v_pareja),
               to_char(v_pareja, 'DD/MM/YYYY'));
    end if;

    v_sabado := least(p_fecha, v_pareja);
    select r.fecha_horas_extras into v_festivo
    from public.registros r
    join public.festivos f on f.fecha = r.fecha_horas_extras
    where r.colega_id = p_colega_id and r.estado = 'registrada'
      and extract(isodow from f.fecha) between 1 and 5
      and privado.sabado_del_festivo(f.fecha) = v_sabado
    limit 1;
    if v_festivo is not null then
      return query select 'HE_DESCANSO', 'fecha_horas_extras',
        format('El colega ya tiene horas extras el festivo %s. Los festivos solo se permiten si '
               || 'no se trabaja ese fin de semana.', to_char(v_festivo, 'DD/MM/YYYY'));
    end if;
  end if;
end
$$;

create function privado.errores_varios(
  p_colega_id uuid,
  p_nivel integer,
  p_dias jsonb,
  p_justificacion text,
  p_filial text default null
) returns table (fecha date, codigo text, campo text, mensaje text)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_tope_semana integer := privado.config_minutos('tope_semanal_min');
  v_dia record;
  v_semana integer;
  v_falta_general boolean := false;
  v_filial text := regexp_replace(btrim(p_filial), '\s+', ' ', 'g');
begin
  return query
  select null::date, e.codigo, e.campo, e.mensaje
  from privado.errores_registro(p_colega_id, p_nivel, null, null, null, 'sin revisar aquí') e
  where e.campo = 'nivel';

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
      select d.fecha, d.inicio, d.final, d.justificacion as propia, d.minutos as total,
             coalesce(d.justificacion, p_justificacion) as justificacion,
             greatest(coalesce(privado.minutos_del_registro(v_filial, d.fecha, d.inicio, d.final,
                                                            d.minutos), 0), 0) as minutos
      from jsonb_to_recordset(p_dias)
        as d(fecha date, inicio time, final time, justificacion text, minutos integer)
    )
    select d.*,
      count(*) over (partition by d.fecha) as veces,
      date_trunc('week', d.fecha)::date as lunes,
      -- Lo que suman los días elegidos anteriores de la misma semana.
      coalesce(sum(d.minutos) over (partition by date_trunc('week', d.fecha) order by d.fecha
                                    rows between unbounded preceding and 1 preceding), 0)
        as minutos_previos,
      -- Festivo entre semana cuyo fin de semana también está en la selección, o al revés.
      (select min(o.fecha) from dias o
        where privado.tipo_dia(d.fecha) = 'festivo'
          and extract(isodow from d.fecha) between 1 and 5
          and o.fecha in (privado.sabado_del_festivo(d.fecha),
                          privado.sabado_del_festivo(d.fecha) + 1)) as fin_de_semana_elegido,
      (select min(o.fecha) from dias o
        where extract(isodow from d.fecha) in (6, 7)
          and privado.tipo_dia(o.fecha) = 'festivo'
          and extract(isodow from o.fecha) between 1 and 5
          and privado.sabado_del_festivo(o.fecha)
              = d.fecha - (extract(isodow from d.fecha)::integer - 6)) as festivo_elegido,
      -- Sábado y domingo del mismo fin de semana.
      (select min(o.fecha) from dias o
        where (extract(isodow from d.fecha) = 6 and o.fecha = d.fecha + 1)
           or (extract(isodow from d.fecha) = 7 and o.fecha = d.fecha - 1)) as pareja_elegida
    from dias d
    order by d.fecha
  loop
    -- Sin justificación propia, el error es de la general y se dice una sola vez.
    if coalesce(btrim(v_dia.justificacion), '') = '' then
      if v_dia.propia is null then
        v_falta_general := true;
      elsif v_dia.fecha is not null then
        return query select v_dia.fecha, 'HE_JUSTIFICACION', 'justificacion',
          'La justificación de este día es obligatoria.';
      end if;
    end if;

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
                                  v_dia.justificacion, v_filial, v_dia.total) e
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

    if v_dia.fin_de_semana_elegido is not null then
      return query select v_dia.fecha, 'HE_DESCANSO', 'fecha_horas_extras',
        format('En la selección también está el %s %s. Los festivos solo se pueden registrar '
               || 'si no se trabajó ese fin de semana.',
               privado.nombre_fin_de_semana(v_dia.fin_de_semana_elegido),
               to_char(v_dia.fin_de_semana_elegido, 'DD/MM/YYYY'));
    end if;
    if v_dia.festivo_elegido is not null then
      return query select v_dia.fecha, 'HE_DESCANSO', 'fecha_horas_extras',
        format('En la selección también está el festivo %s. Los festivos solo se permiten si no '
               || 'se trabaja ese fin de semana.', to_char(v_dia.festivo_elegido, 'DD/MM/YYYY'));
    end if;
    if v_dia.pareja_elegida is not null then
      return query select v_dia.fecha, 'HE_DESCANSO', 'fecha_horas_extras',
        format('En la selección también está el %s %s. En un fin de semana se trabaja el sábado '
               || 'o el domingo, no los dos.', privado.nombre_fin_de_semana(v_dia.pareja_elegida),
               to_char(v_dia.pareja_elegida, 'DD/MM/YYYY'));
    end if;
  end loop;

  if v_falta_general then
    return query select null::date, 'HE_JUSTIFICACION', 'justificacion',
      'La justificación es obligatoria.';
  end if;
end
$$;

create or replace function privado.validar_registro() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_error record;
  -- Lo único que cambia al anular; el código se excluye porque es una columna generada y en un
  -- trigger BEFORE todavía no está calculado.
  v_editables text[] := array['estado', 'fecha_anulacion', 'motivo_anulacion', 'codigo'];
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
  new.minutos_totales := privado.minutos_del_registro(new.filial, new.fecha_horas_extras,
                                                      new.hora_inicio, new.hora_final,
                                                      new.minutos_totales);

  select e.codigo, e.mensaje into v_error
  from privado.errores_registro(new.colega_id, new.nivel, new.fecha_horas_extras,
                                new.hora_inicio, new.hora_final, new.justificacion, new.filial,
                                new.minutos_totales) e
  limit 1;

  if found then
    raise exception using message = v_error.mensaje, detail = v_error.codigo, errcode = 'P0001';
  end if;
  return new;
end
$$;

create function public.registrar_horas(
  p_identificacion text,
  p_nombre_completo text,
  p_cargo text,
  p_nivel integer,
  p_filial text,
  p_fecha date,
  p_hora_inicio time,
  p_hora_final time,
  p_justificacion text,
  p_minutos integer default null
) returns table (
  id bigint, codigo text, clave_anulacion uuid, identificacion text, nombre_completo text,
  cargo text, nivel smallint, filial text, fecha_horas_extras date, hora_inicio time,
  hora_final time, minutos_totales integer, tipo_dia text, justificacion text
)
language plpgsql security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_identificacion text := upper(btrim(p_identificacion));
  v_nombre text := regexp_replace(btrim(p_nombre_completo), '\s+', ' ', 'g');
  v_cargo text := regexp_replace(btrim(p_cargo), '\s+', ' ', 'g');
  v_filial text := regexp_replace(btrim(p_filial), '\s+', ' ', 'g');
  v_clave uuid := gen_random_uuid();
  v_colega uuid;
  v_error record;
begin
  if v_identificacion is null or v_identificacion !~ '^[0-9A-Z]{3,20}$' then
    raise exception using
      message = 'El número de identificación debe tener entre 3 y 20 letras o números, sin puntos ni espacios.',
      detail = 'HE_IDENTIFICACION', errcode = 'P0001';
  end if;
  if coalesce(v_nombre, '') = '' or coalesce(v_cargo, '') = '' or coalesce(v_filial, '') = '' then
    raise exception using
      message = 'El nombre, el cargo y la filial del colega son obligatorios.',
      detail = 'HE_DATOS_COLEGA', errcode = 'P0001';
  end if;

  select c.id into v_colega from public.colegas c where c.identificacion = v_identificacion;

  select e.codigo, e.mensaje into v_error
  from privado.errores_registro(v_colega, p_nivel, p_fecha, p_hora_inicio, p_hora_final,
                                p_justificacion, v_filial, p_minutos) e
  limit 1;
  if found then
    raise exception using message = v_error.mensaje, detail = v_error.codigo, errcode = 'P0001';
  end if;

  insert into public.colegas as c (identificacion, nombre_completo, cargo, nivel, filial)
  values (v_identificacion, v_nombre, v_cargo, p_nivel, v_filial)
  on conflict (identificacion) do update
    set nombre_completo = excluded.nombre_completo, cargo = excluded.cargo,
        nivel = excluded.nivel, filial = excluded.filial, updated_at = now()
  returning c.id into v_colega;

  return query
  insert into public.registros as r (
    colega_id, identificacion, nombre_completo, cargo, nivel, filial, fecha_horas_extras,
    hora_inicio, hora_final, minutos_totales, tipo_dia, justificacion, clave_anulacion_hash
  ) values (
    v_colega, v_identificacion, v_nombre, v_cargo, p_nivel, v_filial, p_fecha,
    p_hora_inicio, p_hora_final, p_minutos, privado.tipo_dia(p_fecha), btrim(p_justificacion),
    privado.hash_clave(v_clave)
  )
  returning r.id, r.codigo, v_clave, r.identificacion, r.nombre_completo, r.cargo, r.nivel,
    r.filial, r.fecha_horas_extras, r.hora_inicio, r.hora_final, r.minutos_totales, r.tipo_dia,
    r.justificacion;
end
$$;

create function public.revisar_registro(
  p_identificacion text,
  p_nivel integer,
  p_fecha date,
  p_hora_inicio time,
  p_hora_final time,
  p_justificacion text,
  p_filial text default null,
  p_minutos integer default null
) returns table (codigo text, campo text, mensaje text)
language sql stable security definer
set search_path = ''
as $$
  select e.codigo, e.campo, e.mensaje
  from privado.errores_registro(
    (select c.id from public.colegas c where c.identificacion = upper(btrim(p_identificacion))),
    p_nivel, p_fecha, p_hora_inicio, p_hora_final, p_justificacion,
    regexp_replace(btrim(p_filial), '\s+', ' ', 'g'), p_minutos
  ) e
$$;

create function public.revisar_varios(
  p_identificacion text,
  p_nivel integer,
  p_dias jsonb,
  p_justificacion text,
  p_filial text default null
) returns table (fecha date, codigo text, campo text, mensaje text)
language sql stable security definer
set search_path = ''
as $$
  select e.fecha, e.codigo, e.campo, e.mensaje
  from privado.errores_varios(
    (select c.id from public.colegas c where c.identificacion = upper(btrim(p_identificacion))),
    p_nivel, p_dias, p_justificacion, p_filial
  ) e
$$;

create or replace function public.registrar_varios(
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
    p_nivel, p_dias, p_justificacion, p_filial
  ) e
  limit 1;
  if found then
    raise exception using
      message = case when v_error.fecha is null then v_error.mensaje
                     else format('%s: %s', to_char(v_error.fecha, 'DD/MM/YYYY'), v_error.mensaje) end,
      detail = v_error.codigo, errcode = 'P0001';
  end if;

  for v_dia in
    select d.fecha, d.inicio, d.final, d.minutos,
           coalesce(d.justificacion, p_justificacion) as justificacion
    from jsonb_to_recordset(p_dias)
      as d(fecha date, inicio time, final time, justificacion text, minutos integer)
    order by d.fecha
  loop
    begin
      return query
      select r.* from public.registrar_horas(p_identificacion, p_nombre_completo, p_cargo, p_nivel,
                                             p_filial, v_dia.fecha, v_dia.inicio, v_dia.final,
                                             v_dia.justificacion, v_dia.minutos) r;
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

revoke all on function public.registrar_horas, public.revisar_registro, public.revisar_varios
  from public;
grant execute on function public.registrar_horas, public.revisar_registro, public.revisar_varios
  to anon, authenticated;
revoke all on function privado.fin_jornada_sufi, privado.horario_especial,
  privado.minutos_del_registro, privado.errores_registro, privado.errores_varios
  from public, anon, authenticated;
