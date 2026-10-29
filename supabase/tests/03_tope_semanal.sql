-- Máximo 12 horas por colega en la semana (lunes a domingo); las anuladas no cuentan.
select prueba.reloj('2026-10-01 08:00');
select prueba.anonimo();

-- Semana del lunes 5 al domingo 11 de octubre.
select prueba.reg('3001', d::date, '17:00', '19:00')
from unnest(array['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']) d;
select prueba.debe_funcionar('Lunes a viernes 2:00 y sábado 2:00 llegan exactamente a 12:00',
  $$select prueba.reg('3001', '2026-10-10', '08:00', '10:00')$$);
select prueba.ok('El resumen muestra 12:00 usadas en esa semana',
  (select minutos_semana = 720 and tope_semana = 720 and lunes = '2026-10-05' and domingo = '2026-10-11'
   from public.resumen_colega('3001', '2026-10-08')));
select prueba.debe_funcionar('La semana siguiente vuelve a empezar de cero',
  $$select prueba.reg('3001', '2026-10-13', '17:00', '19:00')$$);
select prueba.ok('El resumen de la semana siguiente solo cuenta sus días',
  (select minutos_semana = 120 from public.resumen_colega('3001', '2026-10-14')));

-- Con los topes por defecto (2:00 diarias y descanso) no se puede pasar de 12:00, así que
-- se baja el tope semanal a 10:00 para probar el rechazo.
select prueba.como_postgres();
update public.configuracion set valor = '600' where clave = 'tope_semanal_min';
select prueba.anonimo();

select prueba.reg('3002', d::date, '17:00', '19:00')
from unnest(array['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']) d;
select prueba.debe_fallar('Con el tope semanal alcanzado, 30 minutos más se rechazan',
  $$select prueba.reg('3002', '2026-10-24', '08:00', '08:30')$$, 'HE_TOPE_SEMANAL');

select prueba.como_postgres();
select prueba.anular((select id from public.registros
   where identificacion = '3002' and fecha_horas_extras = '2026-10-23'));
select prueba.anonimo();
select prueba.debe_funcionar('Al anular un registro se liberan sus horas de la semana',
  $$select prueba.reg('3002', '2026-10-24', '08:00', '08:30')$$);

-- Semana del lunes 26 de octubre al domingo 1 de noviembre: cruza de mes.
select prueba.reloj('2026-10-26 08:00');
select prueba.reg('3003', d::date, '17:00', '19:00')
from unnest(array['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']) d;
select prueba.reloj('2026-11-01 07:00');
select prueba.debe_fallar('El domingo 1 de noviembre suma las horas de octubre de esa semana',
  $$select prueba.reg('3003', '2026-11-01', '08:00', '08:30')$$, 'HE_TOPE_SEMANAL');
select prueba.debe_funcionar('El lunes festivo 2 de noviembre ya es otra semana',
  $$select prueba.reg('3003', '2026-11-02', '08:00', '10:00')$$);
