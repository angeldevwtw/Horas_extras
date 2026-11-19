-- La misma cédula con el nombre escrito distinto sale siempre con el nombre más reciente.
select prueba.reloj('2026-11-30 08:00');
select prueba.como_postgres();
select privado.cambiar_clave_descarga('clave-de-prueba-admin');

select prueba.anonimo();
select prueba.registrar_horas('2101', 'Angel Francisco Ramos Castillo', 'Analista', 68, 'Banco',
  '2026-11-03', '17:00', '18:00', 'Cierre');
select prueba.registrar_horas('2102', 'Bruno Díaz', 'Analista', 68, 'Banco',
  '2026-11-03', '17:00', '18:00', 'Cierre');
select prueba.registrar_horas('2101', 'Zulema Ramos', 'Analista', 68, 'Banco',
  '2026-11-04', '17:00', '18:00', 'Cierre');

create temp table lista as
select x, n from jsonb_array_elements(
  public.registros_admin('clave-de-prueba-admin', '2026-11-01') -> 'registros') with ordinality as t(x, n);

select prueba.ok('Los dos registros de la cédula salen con el nombre más reciente',
  (select count(*) = 2 and bool_and(x ->> 'nombre_completo' = 'Zulema Ramos')
   from lista where x ->> 'identificacion' = '2101'));
select prueba.ok('El orden del día sigue el nombre que se muestra',
  (select array_agg(x ->> 'identificacion' order by n) = array['2102', '2101', '2101'] from lista));

select prueba.como_postgres();
select prueba.ok('Cada registro conserva lo que se escribió ese día',
  (select nombre_completo = 'Angel Francisco Ramos Castillo' from public.registros
   where identificacion = '2101' and fecha_horas_extras = '2026-11-03'));
insert into auth.users (id, email) values ('10000000-0000-0000-0000-000000000001', 'director@prueba.co');
select prueba.como_cuenta('10000000-0000-0000-0000-000000000001');
select prueba.ok('Mi equipo también',
  (select count(*) = 2 and bool_and(x ->> 'nombre_completo' = 'Zulema Ramos')
   from jsonb_array_elements(public.registros_equipo('2026-11-01') -> 'registros') x
   where x ->> 'identificacion' = '2101'));
select public.decidir_registros(
  (select array_agg(x ->> 'codigo')
   from jsonb_array_elements(public.registros_equipo('2026-11-01') -> 'registros') x
   where x ->> 'identificacion' = '2101'), 'aprobada');

select prueba.anonimo();
select prueba.ok('El Excel también lleva el nombre más reciente',
  (select count(*) = 2 and bool_and(x ->> 'nombre_completo' = 'Zulema Ramos')
   from jsonb_array_elements(public.descargar_registros('clave-de-prueba-admin', '2026-11-01') -> 'registros') x
   where x ->> 'identificacion' = '2101'));
