-- Descarga del Excel con todo lo registrado en un mes, protegida con una clave compartida
-- (la página no tiene login). La clave la define el administrador desde el SQL Editor con
-- privado.cambiar_clave_descarga(); aquí solo queda su hash con sal.

create table privado.clave_descarga (
  id boolean primary key default true check (id),
  sal text not null,
  hash text not null,
  cambiada_en timestamptz not null default now()
);

create table privado.intentos_descarga (
  id bigint generated always as identity primary key,
  origen text not null,
  fecha timestamptz not null default now()
);
create index intentos_descarga_origen_fecha on privado.intentos_descarga (origen, fecha);

create function privado.hash_con_sal(p_texto text, p_sal text) returns text
language sql immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(p_sal || p_texto, 'UTF8')), 'hex')
$$;

create function privado.cambiar_clave_descarga(p_clave text) returns void
language plpgsql
set search_path = ''
as $$
declare
  v_sal text := gen_random_uuid()::text;
begin
  if length(coalesce(p_clave, '')) < 12 then
    raise exception 'La clave debe tener al menos 12 caracteres.';
  end if;
  insert into privado.clave_descarga (sal, hash)
  values (v_sal, privado.hash_con_sal(p_clave, v_sal))
  on conflict (id) do update
    set sal = excluded.sal, hash = excluded.hash, cambiada_en = now();
end
$$;

-- Devuelve {ok, mensaje, registros}. No lanza error con la clave equivocada para que el
-- intento fallido quede anotado (un error desharía el insert).
create function public.descargar_registros(p_clave text, p_mes date) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_origen text := coalesce(
    split_part(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ',', 1),
    'desconocido');
  v_guardada privado.clave_descarga%rowtype;
  v_desde date := date_trunc('month', p_mes)::date;
begin
  select * into v_guardada from privado.clave_descarga;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'HE_DESCARGA_SIN_CLAVE',
      'mensaje', 'La descarga consolidada aún no está habilitada: falta definir la clave.');
  end if;

  if (select count(*) from privado.intentos_descarga
      where origen = v_origen and fecha > now() - interval '15 minutes') >= 10 then
    return jsonb_build_object('ok', false, 'codigo', 'HE_DEMASIADOS_INTENTOS',
      'mensaje', 'Demasiados intentos con clave equivocada. Espere 15 minutos.');
  end if;

  if privado.hash_con_sal(coalesce(p_clave, ''), v_guardada.sal) <> v_guardada.hash then
    insert into privado.intentos_descarga (origen) values (v_origen);
    return jsonb_build_object('ok', false, 'codigo', 'HE_CLAVE_DESCARGA',
      'mensaje', 'La clave de descarga no es correcta.');
  end if;

  return jsonb_build_object('ok', true, 'registros', coalesce((
    select jsonb_agg(jsonb_build_object(
      'codigo', r.codigo, 'identificacion', r.identificacion,
      'nombre_completo', r.nombre_completo, 'cargo', r.cargo, 'nivel', r.nivel,
      'filial', r.filial, 'fecha_horas_extras', r.fecha_horas_extras,
      'hora_inicio', r.hora_inicio, 'hora_final', r.hora_final,
      'minutos_totales', r.minutos_totales, 'tipo_dia', r.tipo_dia,
      'justificacion', r.justificacion
    ) order by r.fecha_horas_extras, r.nombre_completo, r.hora_inicio)
    from public.registros r
    where r.estado = 'registrada'
      and r.fecha_horas_extras >= v_desde
      and r.fecha_horas_extras < (v_desde + interval '1 month')::date
  ), '[]'::jsonb));
end
$$;

revoke all on privado.clave_descarga, privado.intentos_descarga from public, anon, authenticated;
revoke all on function privado.hash_con_sal, privado.cambiar_clave_descarga
  from public, anon, authenticated;
revoke all on function public.descargar_registros from public;
grant execute on function public.descargar_registros to anon, authenticated;
