-- Domingos no se registran. Un festivo solo si el colega no trabajó su sábado (lunes festivo:
-- el sábado anterior; festivo de otro día: el sábado de esa semana), y al revés.
select prueba.reloj('2026-10-01 08:00');
select prueba.anonimo();

select prueba.debe_fallar('Un domingo no se puede registrar',
  $$select prueba.reg('5000', '2026-10-04', '08:00', '09:00')$$, 'HE_DOMINGO');
select prueba.debe_fallar('Ningún domingo se puede registrar, a ninguna hora',
  $$select prueba.reg('5000', '2026-10-11', '17:00', '18:00')$$, 'HE_DOMINGO');

select prueba.reg('5001', '2026-10-10', '08:00', '10:00');
select prueba.debe_fallar('Con horas el sábado, el lunes festivo siguiente se rechaza',
  $$select prueba.reg('5001', '2026-10-12', '09:00', '10:00')$$, 'HE_DESCANSO');

select prueba.reg('5002', '2026-10-12', '09:00', '11:00');
select prueba.debe_fallar('Con horas el lunes festivo, el sábado anterior se rechaza',
  $$select prueba.reg('5002', '2026-10-10', '08:00', '09:00')$$, 'HE_DESCANSO');

select prueba.debe_funcionar('Sin sábado trabajado, el lunes festivo se acepta',
  $$select prueba.reg('5003', '2026-10-12', '09:00', '11:00')$$);
select prueba.debe_funcionar('El sábado siguiente al lunes festivo no tiene relación',
  $$select prueba.reg('5002', '2026-10-17', '08:00', '10:00')$$);

select prueba.como_postgres();
select prueba.anular((select id from public.registros
  where identificacion = '5002' and fecha_horas_extras = '2026-10-12'));
select prueba.anonimo();
select prueba.debe_funcionar('Al anular el festivo, el sábado anterior queda permitido',
  $$select prueba.reg('5002', '2026-10-10', '08:00', '09:00')$$);

-- Festivo en martes (8 de diciembre): se compara con el sábado de esa semana (12 de diciembre).
select prueba.reloj('2026-12-01 08:00');
select prueba.reg('5004', '2026-12-12', '08:00', '10:00');
select prueba.debe_fallar('Martes festivo: si trabajó el sábado de esa semana, se rechaza',
  $$select prueba.reg('5004', '2026-12-08', '09:00', '10:00')$$, 'HE_DESCANSO');
select prueba.reg('5005', '2026-12-08', '09:00', '11:00');
select prueba.debe_fallar('Martes festivo trabajado: el sábado de esa semana se rechaza',
  $$select prueba.reg('5005', '2026-12-12', '08:00', '09:00')$$, 'HE_DESCANSO');
select prueba.debe_funcionar('Martes festivo trabajado: el sábado de la semana anterior sí se acepta',
  $$select prueba.reg('5005', '2026-12-05', '08:00', '09:00')$$);

-- Viernes festivo (25 de diciembre): el sábado de esa semana es el 26.
select prueba.reg('5006', '2026-12-26', '08:00', '10:00');
select prueba.debe_fallar('Viernes festivo: si trabajó el sábado siguiente, se rechaza',
  $$select prueba.reg('5006', '2026-12-25', '09:00', '10:00')$$, 'HE_DESCANSO');

-- Sábado 31 de octubre y lunes festivo 2 de noviembre: la pareja cruza de mes.
select prueba.reloj('2026-10-30 08:00');
select prueba.reg('5007', '2026-10-31', '08:00', '10:00');
select prueba.reloj('2026-11-01 07:00');
select prueba.debe_fallar('Sábado 31 de octubre trabajado: el lunes festivo 2 de noviembre se rechaza',
  $$select prueba.reg('5007', '2026-11-02', '08:00', '09:00')$$, 'HE_DESCANSO');
select prueba.debe_funcionar('Lunes festivo 2 de noviembre sin sábado trabajado se acepta',
  $$select prueba.reg('5008', '2026-11-02', '08:00', '09:00')$$);
