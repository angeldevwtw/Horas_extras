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

-- Registra con datos genéricos; solo cambia lo que interesa en cada prueba.
create function prueba.reg(
  p_identificacion text, p_fecha date, p_inicio time, p_final time,
  p_nivel integer default 68, p_justificacion text default 'Cierre de proceso de prueba'
) returns bigint language sql as $$
  insert into prueba.claves (id, clave)
  select id, clave_anulacion from public.registrar_horas(p_identificacion,
    'Colega ' || p_identificacion, 'Cargo de prueba', p_nivel, 'Banco', p_fecha, p_inicio,
    p_final, p_justificacion)
  returning id
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
