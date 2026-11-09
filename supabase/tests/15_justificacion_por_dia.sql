-- En varios días, cada uno puede traer su justificación; si no, usa la general.
select prueba.reloj('2026-11-30 08:00');

create function prueba.varios_j(p_identificacion text, p_dias jsonb, p_general text)
returns setof bigint language sql as $$
  insert into prueba.claves (id, clave)
  select id, clave_anulacion from prueba.registrar_varios(p_identificacion,
    'Colega ' || p_identificacion, 'Cargo de prueba', 68, 'Banco', p_dias, p_general)
  returning id
$$;

create function prueba.justificaciones(p_identificacion text) returns text[] language sql
security definer as $$
  select array_agg(justificacion order by fecha_horas_extras) from public.registros
  where identificacion = p_identificacion
$$;
grant execute on all functions in schema prueba to anon, authenticated;
select prueba.anonimo();

select prueba.debe_funcionar('Cada día guarda su propia justificación',
  $$select prueba.varios_j('1501', '[
    {"fecha": "2026-11-03", "inicio": "17:00", "final": "18:00", "justificacion": "Cierre contable"},
    {"fecha": "2026-11-04", "inicio": "17:00", "final": "18:00", "justificacion": "Auditoría externa"}]', '')$$);
select prueba.ok('Quedan las dos justificaciones distintas',
  prueba.justificaciones('1501') = array['Cierre contable', 'Auditoría externa']);

select prueba.debe_funcionar('Sin justificación propia, el día usa la general',
  $$select prueba.varios_j('1502', '[
    {"fecha": "2026-11-03", "inicio": "17:00", "final": "18:00"},
    {"fecha": "2026-11-04", "inicio": "17:00", "final": "18:00", "justificacion": "Auditoría externa"}]',
    'Cierre contable')$$);
select prueba.ok('Se combinan la general y la propia',
  prueba.justificaciones('1502') = array['Cierre contable', 'Auditoría externa']);

select prueba.debe_fallar('Una justificación propia vacía se rechaza aunque haya general',
  $$select prueba.varios_j('1503', '[
    {"fecha": "2026-11-03", "inicio": "17:00", "final": "18:00", "justificacion": "Cierre contable"},
    {"fecha": "2026-11-04", "inicio": "17:00", "final": "18:00", "justificacion": "  "}]', 'General')$$,
  'HE_JUSTIFICACION');
select prueba.ok('El error de la justificación propia sale en su día',
  (select array_agg(fecha) = array['2026-11-04'::date]
   from public.revisar_varios('1503', 68, '[
     {"fecha": "2026-11-03", "inicio": "17:00", "final": "18:00", "justificacion": "Cierre contable"},
     {"fecha": "2026-11-04", "inicio": "17:00", "final": "18:00", "justificacion": ""}]', '')
   where campo = 'justificacion'));
select prueba.ok('Con todas las propias llenas no hace falta la general',
  not exists (select 1 from public.revisar_varios('1504', 68, '[
     {"fecha": "2026-11-03", "inicio": "17:00", "final": "18:00", "justificacion": "Cierre contable"}]', '')));
