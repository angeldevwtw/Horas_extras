-- El registro conserva los datos del colega de ese momento; el colega queda con los nuevos.
select prueba.reloj('2026-10-01 08:00');
select prueba.anonimo();

select prueba.ok('registrar_horas devuelve el registro listo para el Excel',
  (select codigo ~ '^HE-\d{5}$' and identificacion = '9001' and nombre_completo = 'Colega Nueve'
     and minutos_totales = 60 and tipo_dia = 'habil' and clave_anulacion is not null
   from public.registrar_horas(' 9001 ', 'Colega  Nueve ', 'Asistente', 73, 'Banco',
     '2026-10-05', '17:00', '18:00', 'Primera justificación')));
select public.registrar_horas('9001', 'Colega Nueve', 'Analista', 68, 'Sufi',
  '2026-10-06', '17:00', '18:00', 'Segunda justificación');

select prueba.como_postgres();
select prueba.ok('El primer registro conserva el cargo y el nivel de ese momento',
  (select cargo = 'Asistente' and nivel = 73
   from public.registros where fecha_horas_extras = '2026-10-05'));
select prueba.ok('El colega queda con los datos más recientes',
  (select cargo = 'Analista' and nivel = 68 and filial = 'Sufi'
   from public.colegas where identificacion = '9001'));
select prueba.ok('La clave de anulación no se guarda, solo su hash',
  (select clave_anulacion_hash ~ '^[0-9a-f]{64}$' from public.registros
   where fecha_horas_extras = '2026-10-05'));
