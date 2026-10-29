-- El registro conserva los datos del colega de ese momento; el colega queda con los nuevos.
select prueba.reloj('2026-10-01 08:00');
select prueba.como('jefe.uno@ejemplo.com');

select public.registrar_horas(' 9001 ', 'Colega  Nueve ', 'Asistente', 73, 'Filial A',
  '2026-10-05', '17:00', '18:00', 'Primera justificación');
select public.registrar_horas('9001', 'Colega Nueve', 'Analista', 68, 'Filial B',
  '2026-10-06', '17:00', '18:00', 'Segunda justificación');

select prueba.ok('La identificación y el nombre se guardan sin espacios sobrantes',
  (select identificacion = '9001' and nombre_completo = 'Colega Nueve'
   from public.registros where fecha_horas_extras = '2026-10-05'));
select prueba.ok('El primer registro conserva el cargo y el nivel de ese momento',
  (select cargo = 'Asistente' and nivel = 73
   from public.registros where fecha_horas_extras = '2026-10-05'));
select prueba.ok('El colega queda con los datos más recientes',
  (select cargo = 'Analista' and nivel = 68 and filial = 'Filial B'
   from public.colegas where identificacion = '9001'));
select prueba.ok('La búsqueda encuentra al colega por cédula o por nombre',
  (select count(*) = 1 from public.buscar_colegas('900'))
  and (select count(*) = 1 from public.buscar_colegas('nueve')));

select prueba.como('jefe.dos@ejemplo.com');
select prueba.ok('Otro jefe no encuentra en la búsqueda a un colega que no ha registrado',
  (select count(*) = 0 from public.buscar_colegas('9001')));
