-- Varios días a la vez: se guardan todos o ninguno, y los días elegidos cuentan entre ellos.
select prueba.reloj('2026-11-30 08:00');

create function prueba.varios(p_identificacion text, p_dias jsonb, p_nivel integer default 68)
returns setof bigint language sql as $$
  insert into prueba.claves (id, clave)
  select id, clave_anulacion from prueba.registrar_varios(p_identificacion,
    'Colega ' || p_identificacion, 'Cargo de prueba', p_nivel, 'Banco', p_dias,
    'Cierre de proceso de prueba')
  returning id
$$;

create function prueba.cuantos(p_identificacion text) returns bigint language sql
security definer as $$
  select count(*) from public.registros where identificacion = p_identificacion
$$;
grant execute on all functions in schema prueba to anon, authenticated;
select prueba.anonimo();

select prueba.debe_funcionar('Tres días de semana y un sábado se guardan juntos',
  $$select prueba.varios('1401', '[
    {"fecha": "2026-11-03", "inicio": "17:00", "final": "19:00"},
    {"fecha": "2026-11-04", "inicio": "17:00", "final": "19:00"},
    {"fecha": "2026-11-06", "inicio": "16:30", "final": "18:30"},
    {"fecha": "2026-11-07", "inicio": "08:00", "final": "10:00"}]')$$);
select prueba.ok('Quedan los cuatro registros', prueba.cuantos('1401') = 4);

select prueba.debe_funcionar('Se aceptan días del mes anterior y del actual en la misma selección',
  $$select prueba.varios('1402', '[
    {"fecha": "2026-10-29", "inicio": "17:00", "final": "18:00"},
    {"fecha": "2026-11-05", "inicio": "17:00", "final": "18:00"}]')$$);

select prueba.debe_fallar('Si un día no cumple no se guarda ninguno',
  $$select prueba.varios('1403', '[
    {"fecha": "2026-11-03", "inicio": "17:00", "final": "19:00"},
    {"fecha": "2026-11-04", "inicio": "18:00", "final": "19:00"}]')$$, 'HE_INICIO_JORNADA');
select prueba.ok('Tras el rechazo el colega no tiene registros', prueba.cuantos('1403') = 0);

select prueba.debe_fallar('El error dice qué día falló',
  $$select prueba.varios('1404', '[{"fecha": "2026-11-10", "inicio": "18:00", "final": "19:00"}]')$$,
  'HE_INICIO_JORNADA');
select prueba.ok('revisar_varios indica el día del error',
  (select mensaje like 'Ese día la jornada%' and fecha = '2026-11-10'
   from public.revisar_varios('1404', 68,
     '[{"fecha": "2026-11-10", "inicio": "18:00", "final": "19:00"}]', 'Motivo')));

select prueba.debe_fallar('Un día repetido se rechaza',
  $$select prueba.varios('1405', '[
    {"fecha": "2026-11-03", "inicio": "17:00", "final": "18:00"},
    {"fecha": "2026-11-03", "inicio": "17:00", "final": "18:00"}]')$$, 'HE_FECHA_REPETIDA');

select prueba.debe_fallar('Una selección vacía se rechaza',
  $$select prueba.varios('1406', '[]')$$, 'HE_FECHA_REQUERIDA');

-- Festivo lunes 2 de noviembre: su sábado es el 31 de octubre.
select prueba.debe_fallar('No se puede elegir el festivo junto con su sábado',
  $$select prueba.varios('1407', '[
    {"fecha": "2026-10-31", "inicio": "08:00", "final": "10:00"},
    {"fecha": "2026-11-02", "inicio": "08:00", "final": "10:00"}]')$$, 'HE_DESCANSO');
select prueba.ok('El aviso sale en los dos días',
  (select count(*) = 2 from public.revisar_varios('1407', 68, '[
    {"fecha": "2026-10-31", "inicio": "08:00", "final": "10:00"},
    {"fecha": "2026-11-02", "inicio": "08:00", "final": "10:00"}]', 'Motivo')
   where codigo = 'HE_DESCANSO'));

-- Tope semanal de 5:00 para probar la suma entre los días elegidos.
select prueba.como_postgres();
update public.configuracion set valor = '300' where clave = 'tope_semanal_min';
select prueba.anonimo();
select prueba.reg('1408', '2026-11-03', '17:00', '18:00');
select prueba.ok('El tope semanal suma lo ya registrado y los días anteriores de la selección',
  (select array_agg(fecha order by fecha) = array['2026-11-06'::date]
   from public.revisar_varios('1408', 68, '[
     {"fecha": "2026-11-04", "inicio": "17:00", "final": "19:00"},
     {"fecha": "2026-11-05", "inicio": "17:00", "final": "18:00"},
     {"fecha": "2026-11-06", "inicio": "16:30", "final": "18:30"}]', 'Motivo')
   where codigo = 'HE_TOPE_SEMANAL'));
select prueba.debe_fallar('Al guardar, el tope semanal acumulado rechaza toda la selección',
  $$select prueba.varios('1408', '[
    {"fecha": "2026-11-04", "inicio": "17:00", "final": "19:00"},
    {"fecha": "2026-11-05", "inicio": "17:00", "final": "18:00"},
    {"fecha": "2026-11-06", "inicio": "16:30", "final": "18:30"}]')$$, 'HE_TOPE_SEMANAL');
select prueba.ok('Solo queda el registro que ya tenía', prueba.cuantos('1408') = 1);
select prueba.como_postgres();
update public.configuracion set valor = '720' where clave = 'tope_semanal_min';
select prueba.anonimo();

select prueba.ok('Nivel y justificación salen una sola vez, sin fecha',
  (select count(*) = 2 and bool_and(fecha is null)
   from public.revisar_varios('1409', 70, '[
     {"fecha": "2026-11-03", "inicio": "17:00", "final": "18:00"},
     {"fecha": "2026-11-04", "inicio": "17:00", "final": "18:00"}]', '')
   where campo in ('nivel', 'justificacion')));

select prueba.ok('dias_del_colega trae lo registrado en las semanas completas del rango',
  (select array_agg(fecha order by fecha) = array['2026-11-03', '2026-11-04', '2026-11-06',
     '2026-11-07']::date[] and sum(minutos) = 480
   from public.dias_del_colega('1401', '2026-11-01', '2026-11-04')));
