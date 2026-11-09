-- Jerarquía: el super admin (clave de administración) ve todo; el director ve lo de sus
-- coordinadores y sus equipos; el coordinador, lo de su equipo. Directores y coordinadores entran
-- con su cuenta de Supabase Auth y deciden los registros que les corresponden. Los empleados
-- siguen sin login y eligen a su coordinador, o a su director si no tienen coordinador.
-- Lo registrado antes de esto queda aprobado y sin jefe: solo lo ve el super admin.

create table public.jefes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (btrim(nombre) <> ''),
  -- La cuenta se reconoce por el correo: se crea aparte en Authentication → Users.
  correo text not null unique check (correo = lower(btrim(correo)) and correo like '%@%'),
  rol text not null check (rol in ('director', 'coordinador')),
  director_id uuid references public.jefes (id),
  -- Sin filial, el jefe sale en el formulario para todas.
  filial text check (filial in ('Banco', 'Sufi', 'Leasing', 'Empleados')),
  activo boolean not null default true,
  check ((rol = 'coordinador') = (director_id is not null))
);

alter table public.jefes enable row level security;
revoke all on public.jefes from anon, authenticated;

alter table public.registros drop constraint registros_estado_check;
-- "negada" libera las horas: todas las reglas cuentan solo estado = 'registrada'.
alter table public.registros add constraint registros_estado_check
  check (estado in ('registrada', 'anulada', 'negada'));

alter table public.registros
  add column aprobacion text not null default 'aprobada'
    check (aprobacion in ('pendiente', 'aprobada', 'negada')),
  add column coordinador_id uuid references public.jefes (id),
  add column director_id uuid references public.jefes (id),
  add column decidido_por uuid references public.jefes (id),
  add column fecha_decision timestamptz,
  add column motivo_decision text,
  add constraint registros_negada check ((estado = 'negada') = (aprobacion = 'negada'));
alter table public.registros alter column aprobacion set default 'pendiente';

create index registros_coordinador on public.registros (coordinador_id, fecha_horas_extras);
create index registros_director on public.registros (director_id, fecha_horas_extras);

-- Solo cuenta un correo confirmado: así nadie toma el rol de un jefe registrándose con su correo.
create function privado.jefe_actual() returns public.jefes
language sql stable security definer
set search_path = ''
as $$
  select j.*
  from public.jefes j
  join auth.users u on lower(u.email) = j.correo
  where u.id = auth.uid() and u.email_confirmed_at is not null and j.activo
  limit 1
$$;

create function privado.jefes_del_registro(
  p_coordinador uuid, p_director uuid, p_filial text, out coordinador_id uuid, out director_id uuid
)
language plpgsql stable
set search_path = ''
as $$
begin
  if p_coordinador is not null then
    select c.id, c.director_id into coordinador_id, director_id
    from public.jefes c
    join public.jefes d on d.id = c.director_id
    where c.id = p_coordinador and c.rol = 'coordinador' and c.activo and d.activo
      and (c.filial is null or c.filial = p_filial);
  elsif p_director is not null then
    select d.id into director_id
    from public.jefes d
    where d.id = p_director and d.rol = 'director' and d.activo
      and (d.filial is null or d.filial = p_filial);
  end if;

  if director_id is null then
    raise exception using
      message = 'Seleccione un coordinador o, si no tiene, un director activo de la filial.',
      detail = 'HE_JEFE', errcode = 'P0001';
  end if;
end
$$;

create or replace function privado.validar_registro() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_error record;
  -- Lo único que puede cambiar en cada operación; el código se excluye porque es una columna
  -- generada y en un trigger BEFORE todavía no está calculado.
  v_al_anular text[] := array['estado', 'fecha_anulacion', 'motivo_anulacion', 'codigo'];
  v_al_decidir text[] := array['estado', 'aprobacion', 'decidido_por', 'fecha_decision',
                               'motivo_decision', 'codigo'];
begin
  if tg_op = 'UPDATE' then
    if current_setting('he.anulando', true) = 'si'
       and old.estado = 'registrada' and new.estado = 'anulada'
       and (to_jsonb(new) - v_al_anular) is not distinct from (to_jsonb(old) - v_al_anular)
    then
      return new;
    end if;
    if current_setting('he.decidiendo', true) = 'si'
       and old.estado = 'registrada' and old.aprobacion = 'pendiente'
       and new.aprobacion in ('aprobada', 'negada')
       and new.estado = (case new.aprobacion when 'negada' then 'negada' else 'registrada' end)
       and (to_jsonb(new) - v_al_decidir) is not distinct from (to_jsonb(old) - v_al_decidir)
    then
      return new;
    end if;
    raise exception using
      message = 'Los registros no se modifican. Si hay un error, anúlelo y regístrelo de nuevo.',
      detail = 'HE_REGISTRO_INMUTABLE', errcode = '42501';
  end if;

  -- Serializa los registros de un mismo colega para que dos simultáneos no superen los topes.
  perform pg_advisory_xact_lock(hashtext('horas_extras:' || new.colega_id::text));

  new.tipo_dia := privado.tipo_dia(new.fecha_horas_extras);
  new.estado := 'registrada';
  new.fecha_anulacion := null;
  new.motivo_anulacion := null;
  new.aprobacion := 'pendiente';
  new.decidido_por := null;
  new.fecha_decision := null;
  new.motivo_decision := null;
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

  if new.director_id is null then
    raise exception using message = 'El registro debe tener un director.',
      detail = 'HE_JEFE', errcode = 'P0001';
  end if;
  return new;
end
$$;

-- Cambian las firmas: se quitan las anteriores para que no queden dos versiones.
drop function public.registrar_varios(text, text, text, integer, text, jsonb, text);
drop function public.registrar_horas(text, text, text, integer, text, date, time, time, text, integer);

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
  p_minutos integer default null,
  p_coordinador uuid default null,
  p_director uuid default null
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
  v_jefes record;
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

  select j.coordinador_id, j.director_id into v_jefes
  from privado.jefes_del_registro(p_coordinador, p_director, v_filial) j;

  insert into public.colegas as c (identificacion, nombre_completo, cargo, nivel, filial)
  values (v_identificacion, v_nombre, v_cargo, p_nivel, v_filial)
  on conflict (identificacion) do update
    set nombre_completo = excluded.nombre_completo, cargo = excluded.cargo,
        nivel = excluded.nivel, filial = excluded.filial, updated_at = now()
  returning c.id into v_colega;

  return query
  insert into public.registros as r (
    colega_id, identificacion, nombre_completo, cargo, nivel, filial, fecha_horas_extras,
    hora_inicio, hora_final, minutos_totales, tipo_dia, justificacion, clave_anulacion_hash,
    coordinador_id, director_id
  ) values (
    v_colega, v_identificacion, v_nombre, v_cargo, p_nivel, v_filial, p_fecha,
    p_hora_inicio, p_hora_final, p_minutos, privado.tipo_dia(p_fecha), btrim(p_justificacion),
    privado.hash_clave(v_clave), v_jefes.coordinador_id, v_jefes.director_id
  )
  returning r.id, r.codigo, v_clave, r.identificacion, r.nombre_completo, r.cargo, r.nivel,
    r.filial, r.fecha_horas_extras, r.hora_inicio, r.hora_final, r.minutos_totales, r.tipo_dia,
    r.justificacion;
end
$$;

create function public.registrar_varios(
  p_identificacion text,
  p_nombre_completo text,
  p_cargo text,
  p_nivel integer,
  p_filial text,
  p_dias jsonb,
  p_justificacion text,
  p_coordinador uuid default null,
  p_director uuid default null
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
                                             v_dia.justificacion, v_dia.minutos, p_coordinador,
                                             p_director) r;
    exception when sqlstate 'P0001' then
      get stacked diagnostics v_detalle = pg_exception_detail;
      -- Estos errores no son de un día en particular.
      raise exception using
        message = case when v_detalle in ('HE_IDENTIFICACION', 'HE_DATOS_COLEGA', 'HE_JEFE') then sqlerrm
                       else format('%s: %s', to_char(v_dia.fecha, 'DD/MM/YYYY'), sqlerrm) end,
        detail = v_detalle, errcode = 'P0001';
    end;
  end loop;
end
$$;

-- Con la clave del registro solo se anula mientras está pendiente: después de la decisión del
-- jefe, solo el super admin.
create or replace function public.anular_registro(p_id bigint, p_clave uuid, p_motivo text) returns void
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
  if v_registro.aprobacion <> 'pendiente' then
    raise exception using
      message = format('El registro %s ya tiene decisión de su jefe: solo el administrador puede anularlo.',
                       v_registro.codigo),
      detail = 'HE_YA_DECIDIDO', errcode = 'P0001';
  end if;

  perform set_config('he.anulando', 'si', true);
  update public.registros
  set estado = 'anulada', fecha_anulacion = now(), motivo_anulacion = btrim(p_motivo)
  where id = p_id;
  perform set_config('he.anulando', '', true);
end
$$;

create or replace function privado.anular_registro_admin(p_codigo text, p_motivo text) returns void
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
  if v_registro.estado = 'negada' then
    raise exception 'El registro % fue negado: ya no cuenta.', v_registro.codigo;
  end if;

  perform set_config('he.anulando', 'si', true);
  update public.registros
  set estado = 'anulada', fecha_anulacion = now(), motivo_anulacion = btrim(p_motivo)
  where id = v_registro.id;
  perform set_config('he.anulando', '', true);
end
$$;

create function privado.registro_json(p_registro public.registros) returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'codigo', p_registro.codigo, 'identificacion', p_registro.identificacion,
    'nombre_completo', p_registro.nombre_completo, 'cargo', p_registro.cargo,
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
                     order by r.fecha_horas_extras, r.nombre_completo, r.hora_inicio)
    from public.registros r
    where r.fecha_horas_extras >= v_desde
      and r.fecha_horas_extras < (v_desde + interval '1 month')::date
  ), '[]'::jsonb));
end
$$;

-- El Excel solo lleva lo aprobado.
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
                     order by r.fecha_horas_extras, r.nombre_completo, r.hora_inicio)
    from public.registros r
    where r.estado = 'registrada' and r.aprobacion = 'aprobada'
      and r.fecha_horas_extras >= v_desde
      and r.fecha_horas_extras < (v_desde + interval '1 month')::date
  ), '[]'::jsonb));
end
$$;

-- Para los desplegables del formulario: sin correos.
create function public.jefes_formulario()
returns table (id uuid, nombre text, rol text, director text, filial text)
language sql stable security definer
set search_path = ''
as $$
  select j.id, j.nombre, j.rol, d.nombre, j.filial
  from public.jefes j
  left join public.jefes d on d.id = j.director_id
  where j.activo and (j.rol = 'director' or d.activo)
  order by j.nombre
$$;

create function public.mi_perfil() returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select case when j.id is not null
              then jsonb_build_object('nombre', j.nombre, 'rol', j.rol, 'filial', j.filial) end
  from privado.jefe_actual() j
$$;

create function public.registros_equipo(p_mes date) returns jsonb
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
                       order by r.fecha_horas_extras, r.nombre_completo, r.hora_inicio)
      from public.registros r
      where (r.coordinador_id = v_jefe.id or r.director_id = v_jefe.id)
        and r.fecha_horas_extras >= v_desde
        and r.fecha_horas_extras < (v_desde + interval '1 month')::date
    ), '[]'::jsonb),
    -- Los pendientes salen siempre, sean del mes que sean, para que ninguno quede sin decidir.
    'pendientes', coalesce((
      select jsonb_agg(privado.registro_json(r)
                       order by r.fecha_horas_extras, r.nombre_completo, r.hora_inicio)
      from public.registros r
      where (r.coordinador_id = v_jefe.id or r.director_id = v_jefe.id)
        and r.estado = 'registrada' and r.aprobacion = 'pendiente'
    ), '[]'::jsonb));
end
$$;

-- Decide todos los códigos o ninguno. Vale la primera decisión: después no se cambia.
create function public.decidir_registros(p_codigos text[], p_decision text, p_motivo text default null)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_jefe public.jefes := privado.jefe_actual();
  v_registro public.registros%rowtype;
  v_cuantos integer := 0;
begin
  if v_jefe.id is null then
    raise exception using message = 'Esta cuenta no es de un director ni de un coordinador activo.',
      detail = 'HE_SIN_PERMISO', errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('aprobada', 'negada') then
    raise exception using message = 'La decisión debe ser aprobar o negar.',
      detail = 'HE_DECISION', errcode = 'P0001';
  end if;
  if p_decision = 'negada' and coalesce(btrim(p_motivo), '') = '' then
    raise exception using message = 'Indique el motivo para negar el registro.',
      detail = 'HE_MOTIVO_DECISION', errcode = 'P0001';
  end if;

  for v_registro in
    select * from public.registros where codigo = any(p_codigos) order by id for update
  loop
    if v_registro.coordinador_id is distinct from v_jefe.id
       and v_registro.director_id is distinct from v_jefe.id then
      raise exception using message = format('El registro %s no es de su equipo.', v_registro.codigo),
        detail = 'HE_SIN_PERMISO', errcode = '42501';
    end if;
    if v_registro.estado <> 'registrada' or v_registro.aprobacion <> 'pendiente' then
      raise exception using
        message = format('El registro %s ya no está pendiente. Actualice la página.', v_registro.codigo),
        detail = 'HE_YA_DECIDIDO', errcode = 'P0001';
    end if;

    perform set_config('he.decidiendo', 'si', true);
    update public.registros
    set aprobacion = p_decision,
        estado = case p_decision when 'negada' then 'negada' else 'registrada' end,
        decidido_por = v_jefe.id,
        fecha_decision = now(),
        motivo_decision = nullif(btrim(p_motivo), '')
    where id = v_registro.id;
    perform set_config('he.decidiendo', '', true);
    v_cuantos := v_cuantos + 1;
  end loop;

  if v_cuantos = 0 or v_cuantos <> cardinality(p_codigos) then
    raise exception using message = 'Alguno de los registros no existe.',
      detail = 'HE_SIN_PERMISO', errcode = '42501';
  end if;
  return v_cuantos;
end
$$;

create function public.jefes_admin(p_clave text) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_rechazo jsonb := privado.revisar_clave_admin(p_clave);
begin
  if v_rechazo is not null then
    return v_rechazo;
  end if;

  return jsonb_build_object('ok', true, 'jefes', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', j.id, 'nombre', j.nombre, 'correo', j.correo, 'rol', j.rol,
      'director_id', j.director_id, 'filial', j.filial, 'activo', j.activo,
      'tiene_cuenta', exists (select 1 from auth.users u
                              where lower(u.email) = j.correo and u.email_confirmed_at is not null)
    ) order by j.rol desc, j.nombre)
    from public.jefes j
  ), '[]'::jsonb));
end
$$;

create function privado.guardar_jefe(
  p_id uuid, p_nombre text, p_correo text, p_rol text, p_director uuid, p_activo boolean,
  p_filial text
) returns void
language plpgsql
set search_path = ''
as $$
declare
  v_nombre text := regexp_replace(btrim(p_nombre), '\s+', ' ', 'g');
  v_correo text := lower(btrim(p_correo));
  v_director uuid := case when p_rol = 'coordinador' then p_director end;
begin
  if coalesce(v_nombre, '') = '' or coalesce(v_correo, '') !~ '^[^@\s]+@[^@\s]+$' then
    raise exception 'Escriba el nombre y un correo válido.';
  end if;
  if p_rol is null or p_rol not in ('director', 'coordinador') then
    raise exception 'El rol debe ser director o coordinador.';
  end if;
  if p_filial is not null and p_filial not in ('Banco', 'Sufi', 'Leasing', 'Empleados') then
    raise exception 'Elija una filial de la lista.';
  end if;
  if p_rol = 'coordinador' and not exists (
    select 1 from public.jefes d
    where d.id = v_director and d.rol = 'director' and d.activo
  ) then
    raise exception 'Elija el director activo del coordinador.';
  end if;
  if exists (select 1 from public.jefes j where j.correo = v_correo and j.id is distinct from p_id) then
    raise exception 'Ya existe un jefe con ese correo.';
  end if;
  if (p_rol <> 'director' or not p_activo) and exists (
    select 1 from public.jefes c where c.director_id = p_id and c.activo
  ) then
    raise exception 'Este director tiene coordinadores activos: primero cámbielos de director o desactívelos.';
  end if;

  if p_id is null then
    insert into public.jefes (nombre, correo, rol, director_id, activo, filial)
    values (v_nombre, v_correo, p_rol, v_director, p_activo, p_filial);
  else
    update public.jefes
    set nombre = v_nombre, correo = v_correo, rol = p_rol, director_id = v_director, activo = p_activo,
        filial = p_filial
    where id = p_id;
    if not found then
      raise exception 'No existe ese jefe.';
    end if;
  end if;
end
$$;

create function public.guardar_jefe_admin(
  p_clave text, p_id uuid, p_nombre text, p_correo text, p_rol text, p_director uuid,
  p_activo boolean default true, p_filial text default null
) returns jsonb
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
    perform privado.guardar_jefe(p_id, p_nombre, p_correo, p_rol, p_director, p_activo, p_filial);
  exception when others then
    return jsonb_build_object('ok', false, 'codigo', 'HE_JEFE', 'mensaje', sqlerrm);
  end;
  return jsonb_build_object('ok', true);
end
$$;

create function privado.director_actual() returns public.jefes
language plpgsql stable
set search_path = ''
as $$
declare
  v_jefe public.jefes := privado.jefe_actual();
begin
  if v_jefe.id is null or v_jefe.rol <> 'director' then
    raise exception using message = 'Solo un director activo puede manejar coordinadores.',
      detail = 'HE_SIN_PERMISO', errcode = '42501';
  end if;
  return v_jefe;
end
$$;

create function public.mis_coordinadores() returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_director public.jefes := privado.director_actual();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'nombre', c.nombre, 'correo', c.correo, 'filial', c.filial, 'activo', c.activo,
      'tiene_cuenta', exists (select 1 from auth.users u
                              where lower(u.email) = c.correo and u.email_confirmed_at is not null)
    ) order by c.nombre)
    from public.jefes c
    where c.director_id = v_director.id
  ), '[]'::jsonb);
end
$$;

-- El director solo agrega a su propia línea y solo toca a sus coordinadores.
create function public.guardar_coordinador(
  p_id uuid, p_nombre text, p_correo text, p_activo boolean default true, p_filial text default null
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_director public.jefes := privado.director_actual();
begin
  if p_id is not null and not exists (
    select 1 from public.jefes c where c.id = p_id and c.director_id = v_director.id
  ) then
    raise exception using message = 'Ese coordinador no es de su línea.',
      detail = 'HE_SIN_PERMISO', errcode = '42501';
  end if;

  begin
    perform privado.guardar_jefe(p_id, p_nombre, p_correo, 'coordinador', v_director.id, p_activo, p_filial);
  exception when others then
    return jsonb_build_object('ok', false, 'codigo', 'HE_JEFE', 'mensaje', sqlerrm);
  end;
  return jsonb_build_object('ok', true);
end
$$;

create function public.guardar_mi_filial(p_filial text) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_director public.jefes := privado.director_actual();
begin
  begin
    perform privado.guardar_jefe(v_director.id, v_director.nombre, v_director.correo, 'director', null,
                                 true, p_filial);
  exception when others then
    return jsonb_build_object('ok', false, 'codigo', 'HE_JEFE', 'mensaje', sqlerrm);
  end;
  return jsonb_build_object('ok', true);
end
$$;

revoke all on function privado.jefe_actual, privado.jefes_del_registro, privado.registro_json,
  privado.guardar_jefe, privado.director_actual from public, anon, authenticated;
revoke all on function public.registrar_horas, public.registrar_varios, public.jefes_formulario,
  public.mi_perfil, public.registros_equipo, public.decidir_registros, public.jefes_admin,
  public.guardar_jefe_admin, public.mis_coordinadores, public.guardar_coordinador,
  public.guardar_mi_filial from public;
grant execute on function public.registrar_horas, public.registrar_varios, public.jefes_formulario,
  public.jefes_admin, public.guardar_jefe_admin to anon, authenticated;
grant execute on function public.mi_perfil, public.registros_equipo, public.decidir_registros,
  public.mis_coordinadores, public.guardar_coordinador, public.guardar_mi_filial to authenticated;
