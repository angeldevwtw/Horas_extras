-- La app no tiene login: estas funciones son lo único que puede usar. Ninguna devuelve
-- registros guardados ni datos de colegas; solo lo que se acaba de registrar y totales.

-- Única forma de crear registros: crea o actualiza el colega y guarda el registro en la misma
-- transacción. El trigger de registros vuelve a validar con el candado. Devuelve el registro
-- con la clave para anularlo, que no se guarda en la base (solo su hash).
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
    colega_id, identificacion, nombre_completo, cargo, nivel, filial, fecha_horas_extras,
    hora_inicio, hora_final, tipo_dia, justificacion, clave_anulacion_hash
  ) values (
    v_colega, v_identificacion, v_nombre, v_cargo, p_nivel, v_filial, p_fecha,
    p_hora_inicio, p_hora_final, privado.tipo_dia(p_fecha), btrim(p_justificacion),
    privado.hash_clave(v_clave)
  )
  returning r.id, r.codigo, v_clave, r.identificacion, r.nombre_completo, r.cargo, r.nivel,
    r.filial, r.fecha_horas_extras, r.hora_inicio, r.hora_final, r.minutos_totales, r.tipo_dia,
    r.justificacion;
end
$$;

create function privado.hash_clave(p_clave uuid) returns text
language sql immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(p_clave::text, 'UTF8')), 'hex')
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
language sql stable security definer
set search_path = ''
as $$
  select e.codigo, e.campo, e.mensaje
  from privado.errores_registro(
    (select c.id from public.colegas c where c.identificacion = upper(btrim(p_identificacion))),
    p_nivel, p_fecha, p_hora_inicio, p_hora_final, p_justificacion
  ) e
$$;

-- Horas que ya tiene el colega en la semana (lunes a domingo) de esa fecha.
-- Solo devuelve totales, no datos del colega.
create function public.resumen_colega(p_identificacion text, p_fecha date)
returns table (minutos_semana integer, tope_semana integer, lunes date, domingo date)
language sql stable security definer
set search_path = ''
as $$
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
  group by semana.lunes
$$;

-- Solo anula quien tiene la clave que se entregó al registrar.
create function public.anular_registro(p_id bigint, p_clave uuid, p_motivo text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_registro public.registros%rowtype;
begin
  if coalesce(btrim(p_motivo), '') = '' then
    raise exception using message = 'Indique el motivo de la anulación.',
      detail = 'HE_MOTIVO_ANULACION', errcode = 'P0001';
  end if;

  select * into v_registro from public.registros where id = p_id for update;
  if not found or v_registro.clave_anulacion_hash <> privado.hash_clave(p_clave) then
    raise exception using message = 'El registro no existe o la clave de anulación no corresponde.',
      detail = 'HE_SIN_PERMISO', errcode = '42501';
  end if;
  if v_registro.estado = 'anulada' then
    raise exception using message = format('El registro %s ya estaba anulado.', v_registro.codigo),
      detail = 'HE_YA_ANULADO', errcode = 'P0001';
  end if;

  perform set_config('he.anulando', 'si', true);
  update public.registros
  set estado = 'anulada', fecha_anulacion = now(), motivo_anulacion = btrim(p_motivo)
  where id = p_id;
  perform set_config('he.anulando', '', true);
end
$$;

-- Para el administrador, desde el SQL Editor del panel (el esquema privado no está en la API).
create function privado.anular_registro_admin(p_codigo text, p_motivo text) returns void
language plpgsql
set search_path = ''
as $$
declare
  v_registro public.registros%rowtype;
begin
  if coalesce(btrim(p_motivo), '') = '' then
    raise exception 'Indique el motivo de la anulación.';
  end if;
  select * into v_registro from public.registros where codigo = upper(btrim(p_codigo)) for update;
  if not found then
    raise exception 'No existe el registro %.', p_codigo;
  end if;
  if v_registro.estado = 'anulada' then
    raise exception 'El registro % ya estaba anulado.', v_registro.codigo;
  end if;

  perform set_config('he.anulando', 'si', true);
  update public.registros
  set estado = 'anulada', fecha_anulacion = now(), motivo_anulacion = btrim(p_motivo)
  where id = v_registro.id;
  perform set_config('he.anulando', '', true);
end
$$;
