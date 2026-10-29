-- Un día de descanso del fin de semana, aunque caigan en meses distintos.
select prueba.reloj('2026-10-01 08:00');
select prueba.anonimo();

select prueba.reg('5001', '2026-10-03', '08:00', '10:00');
select prueba.debe_fallar('Con horas el sábado, el domingo se rechaza',
  $$select prueba.reg('5001', '2026-10-04', '08:00', '09:00')$$, 'HE_DESCANSO');

select prueba.reg('5002', '2026-10-11', '08:00', '10:00');
select prueba.debe_fallar('Con horas el domingo, el sábado anterior se rechaza',
  $$select prueba.reg('5002', '2026-10-10', '08:00', '09:00')$$, 'HE_DESCANSO');

select prueba.debe_funcionar('Sábado y domingo de fines de semana distintos se aceptan',
  $$select prueba.reg('5001', '2026-10-11', '08:00', '10:00')$$);
select prueba.debe_funcionar('Otro colega sí puede trabajar ese domingo',
  $$select prueba.reg('5003', '2026-10-04', '08:00', '10:00')$$);

select prueba.como_postgres();
select prueba.anular((select id from public.registros where identificacion = '5002'));
select prueba.anonimo();
select prueba.debe_funcionar('Al anular el domingo, el sábado queda permitido',
  $$select prueba.reg('5002', '2026-10-10', '08:00', '09:00')$$);

-- Sábado 31 de octubre y domingo 1 de noviembre de 2026.
select prueba.reloj('2026-10-30 08:00');
select prueba.reg('5004', '2026-10-31', '08:00', '10:00');
select prueba.reloj('2026-11-01 07:00');
select prueba.debe_fallar('Sábado 31 de octubre y domingo 1 de noviembre se rechaza',
  $$select prueba.reg('5004', '2026-11-01', '08:00', '09:00')$$, 'HE_DESCANSO');
select prueba.debe_funcionar('Domingo 1 de noviembre sin sábado previo se acepta',
  $$select prueba.reg('5005', '2026-11-01', '08:00', '09:00')$$);
