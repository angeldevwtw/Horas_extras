-- Utilidades de prueba: se cargan antes de cada archivo de pruebas.
create schema prueba;
grant usage on schema prueba to anon, authenticated;

create table prueba.resultados (
  n serial primary key, nombre text not null, ok boolean not null, detalle text
);
-- Las claves de anulación que entrega registrar_horas, como las guardaría el navegador.
create table prueba.claves (id bigint primary key, clave uuid not null);
grant all on prueba.resultados, prueba.claves to anon, authenticated;
grant all on sequence prueba.resultados_n_seq to anon, authenticated;

create function prueba.reloj(p_ahora text) returns void language sql as $$
  select set_config('prueba.ahora', p_ahora, false)
$$;

-- Actúa como quien abre la app: sin sesión, con el rol "anon".
create function prueba.anonimo() returns void language plpgsql as $$
begin
  reset role;
  set role anon;
end
$$;

create function prueba.como_postgres() returns void language plpgsql as $$
begin
  reset role;
end
$$;

-- Un director de prueba, para que las pruebas de las reglas no tengan que elegir jefe.
insert into public.jefes (id, nombre, correo, rol)
values ('00000000-0000-0000-0000-000000000001', 'Director de prueba', 'director@prueba.co', 'director');

create function prueba.registrar_horas(
  p_identificacion text, p_nombre_completo text, p_cargo text, p_nivel integer, p_filial text,
  p_fecha date, p_hora_inicio time, p_hora_final time, p_justificacion text,
  p_minutos integer default null
) returns table (
  id bigint, codigo text, clave_anulacion uuid, identificacion text, nombre_completo text,
  cargo text, nivel smallint, filial text, fecha_horas_extras date, hora_inicio time,
  hora_final time, minutos_totales integer, tipo_dia text, justificacion text
) language sql as $$
  select * from public.registrar_horas(p_identificacion, p_nombre_completo, p_cargo, p_nivel,
    p_filial, p_fecha, p_hora_inicio, p_hora_final, p_justificacion, p_minutos, null,
    '00000000-0000-0000-0000-000000000001')
$$;

create function prueba.registrar_varios(
  p_identificacion text, p_nombre_completo text, p_cargo text, p_nivel integer, p_filial text,
  p_dias jsonb, p_justificacion text
) returns table (
  id bigint, codigo text, clave_anulacion uuid, identificacion text, nombre_completo text,
  cargo text, nivel smallint, filial text, fecha_horas_extras date, hora_inicio time,
  hora_final time, minutos_totales integer, tipo_dia text, justificacion text
) language sql as $$
  select * from public.registrar_varios(p_identificacion, p_nombre_completo, p_cargo, p_nivel,
    p_filial, p_dias, p_justificacion, null, '00000000-0000-0000-0000-000000000001')
$$;

-- Registra con datos genéricos; solo cambia lo que interesa en cada prueba.
create function prueba.reg(
  p_identificacion text, p_fecha date, p_inicio time, p_final time,
  p_nivel integer default 68, p_justificacion text default 'Cierre de proceso de prueba'
) returns bigint language sql as $$
  insert into prueba.claves (id, clave)
  select id, clave_anulacion from prueba.registrar_horas(p_identificacion,
    'Colega ' || p_identificacion, 'Cargo de prueba', p_nivel, 'Banco', p_fecha, p_inicio,
    p_final, p_justificacion)
  returning id
$$;

-- Actúa como el jefe con esa cuenta.
create function prueba.como_cuenta(p_usuario uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', p_usuario::text, false);
  set role authenticated;
end
$$;

-- Aprueba lo pendiente sin pasar por un jefe, para las pruebas que no tratan de la aprobación.
create function prueba.aprobar_pendientes() returns void language plpgsql as $$
begin
  perform set_config('he.decidiendo', 'si', true);
  update public.registros set aprobacion = 'aprobada'
  where estado = 'registrada' and aprobacion = 'pendiente';
  perform set_config('he.decidiendo', '', true);
end
$$;

create function prueba.anular(p_id bigint, p_motivo text default 'Prueba de anulación')
returns void language sql as $$
  select public.anular_registro(p_id, (select clave from prueba.claves where id = p_id), p_motivo)
$$;

create function prueba.ok(p_nombre text, p_condicion boolean, p_detalle text default null)
returns void language sql as $$
  insert into prueba.resultados (nombre, ok, detalle)
  values (p_nombre, coalesce(p_condicion, false), p_detalle)
$$;

create function prueba.debe_funcionar(p_nombre text, p_sql text) returns void
language plpgsql as $$
declare
  v_mensaje text;
begin
  execute p_sql;
  perform prueba.ok(p_nombre, true);
exception when others then
  get stacked diagnostics v_mensaje = message_text;
  perform prueba.ok(p_nombre, false, 'falló: ' || v_mensaje);
end
$$;

-- p_esperado es el código de la regla (detail, ej. HE_TOPE_SEMANAL) o un SQLSTATE (ej. 42501).
create function prueba.debe_fallar(p_nombre text, p_sql text, p_esperado text) returns void
language plpgsql as $$
declare
  v_detalle text;
  v_estado text;
  v_mensaje text;
begin
  execute p_sql;
  perform prueba.ok(p_nombre, false, 'no falló; se esperaba ' || p_esperado);
exception when others then
  get stacked diagnostics v_detalle = pg_exception_detail, v_estado = returned_sqlstate,
                          v_mensaje = message_text;
  perform prueba.ok(p_nombre, p_esperado in (v_detalle, v_estado),
    format('[%s] %s', coalesce(nullif(v_detalle, ''), v_estado), v_mensaje));
end
$$;

grant execute on all functions in schema prueba to anon, authenticated;
