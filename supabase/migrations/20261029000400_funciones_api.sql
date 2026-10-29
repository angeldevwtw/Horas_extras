-- Única forma de crear registros desde la app: crea o actualiza el colega y guarda el
-- registro en la misma transacción. El trigger de registros vuelve a validar con el candado.
create function public.registrar_horas(
  p_identificacion text,
  p_nombre_completo text,
  p_cargo text,
  p_nivel integer,
  p_filial text,
  p_fecha date,
  p_hora_inicio time,
  p_hora_final time,
  p_justificacion text
) returns table (id bigint, codigo text)
language plpgsql security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_usuario uuid := privado.exigir_usuario();
  v_identificacion text := upper(btrim(p_identificacion));
  v_nombre text := regexp_replace(btrim(p_nombre_completo), '\s+', ' ', 'g');
  v_cargo text := regexp_replace(btrim(p_cargo), '\s+', ' ', 'g');
  v_filial text := regexp_replace(btrim(p_filial), '\s+', ' ', 'g');
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
                                p_justificacion) e
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
    colega_id, identificacion, nombre_completo, cargo, nivel, filial,
    fecha_horas_extras, hora_inicio, hora_final, tipo_dia, justificacion, registrado_por
  ) values (
    v_colega, v_identificacion, v_nombre, v_cargo, p_nivel, v_filial,
    p_fecha, p_hora_inicio, p_hora_final, privado.tipo_dia(p_fecha), btrim(p_justificacion),
    v_usuario
  )
  returning r.id, r.codigo;
end
$$;

-- Para el formulario: todos los incumplimientos de una vez, sin guardar nada.
create function public.revisar_registro(
  p_identificacion text,
  p_nivel integer,
  p_fecha date,
  p_hora_inicio time,
  p_hora_final time,
  p_justificacion text
) returns table (codigo text, campo text, mensaje text)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform privado.exigir_usuario();
  return query
  select e.codigo, e.campo, e.mensaje
  from privado.errores_registro(
    (select c.id from public.colegas c where c.identificacion = upper(btrim(p_identificacion))),
    p_nivel, p_fecha, p_hora_inicio, p_hora_final, p_justificacion
  ) e;
end
$$;

-- Horas que ya tiene el colega en la semana (lunes a domingo) de esa fecha, sin importar
-- quién las registró. Solo devuelve totales, no datos del colega.
create function public.resumen_colega(p_identificacion text, p_fecha date)
returns table (minutos_semana integer, tope_semana integer, lunes date, domingo date)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform privado.exigir_usuario();
  return query
  with semana as (select date_trunc('week', p_fecha)::date as lunes)
  select
    coalesce(sum(r.minutos_totales), 0)::integer,
    privado.config_minutos('tope_semanal_min'),
    semana.lunes,
    semana.lunes + 6
  from semana
  left join public.registros r
    on r.identificacion = upper(btrim(p_identificacion)) and r.estado = 'registrada'
   and r.fecha_horas_extras between semana.lunes and semana.lunes + 6
  group by semana.lunes;
end
$$;

create function public.anular_registro(p_id bigint, p_motivo text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_usuario uuid := privado.exigir_usuario();
  v_registro public.registros%rowtype;
begin
  if coalesce(btrim(p_motivo), '') = '' then
    raise exception using message = 'Indique el motivo de la anulación.',
      detail = 'HE_MOTIVO_ANULACION', errcode = 'P0001';
  end if;

  select * into v_registro from public.registros where id = p_id for update;
  if not found or (v_registro.registrado_por <> v_usuario and not privado.es_admin()) then
    raise exception using message = 'El registro no existe o no tiene permiso para anularlo.',
      detail = 'HE_SIN_PERMISO', errcode = '42501';
  end if;
  if v_registro.estado = 'anulada' then
    raise exception using message = format('El registro %s ya estaba anulado.', v_registro.codigo),
      detail = 'HE_YA_ANULADO', errcode = 'P0001';
  end if;

  perform set_config('he.anulando', 'si', true);
  update public.registros
  set estado = 'anulada', anulado_por = v_usuario, fecha_anulacion = now(),
      motivo_anulacion = btrim(p_motivo)
  where id = p_id;
  perform set_config('he.anulando', '', true);
end
$$;
