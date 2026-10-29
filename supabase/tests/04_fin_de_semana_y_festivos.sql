-- Sábado, domingo o festivo: máximo 2 horas, a cualquier hora del día.
select prueba.reloj('2026-10-01 08:00');
select prueba.anonimo();

select prueba.debe_funcionar('Sábado: 2:00 en la mañana se acepta',
  $$select prueba.reg('4001', '2026-10-03', '08:00', '10:00')$$);
select prueba.debe_fallar('Sábado: 2:30 se rechaza',
  $$select prueba.reg('4002', '2026-10-03', '08:00', '10:30')$$, 'HE_TOPE_FIN_DE_SEMANA');
select prueba.debe_funcionar('Domingo: 2:00 en la tarde se acepta',
  $$select prueba.reg('4003', '2026-10-11', '14:00', '16:00')$$);
select prueba.debe_funcionar('Lunes festivo (12 de octubre): 2:00 sin empezar a las 5:00 PM',
  $$select prueba.reg('4004', '2026-10-12', '09:00', '11:00')$$);
select prueba.como_postgres();
select prueba.ok('El lunes 12 de octubre queda como festivo',
  (select tipo_dia = 'festivo' from public.registros where identificacion = '4004'));
select prueba.anonimo();
select prueba.debe_fallar('Lunes festivo: 2:30 se rechaza',
  $$select prueba.reg('4005', '2026-10-12', '09:00', '11:30')$$, 'HE_TOPE_FIN_DE_SEMANA');

select prueba.debe_funcionar('Sábado: dos bloques que suman 2:00 se aceptan (primero)',
  $$select prueba.reg('4006', '2026-10-17', '08:00', '09:00')$$);
select prueba.debe_funcionar('Sábado: dos bloques que suman 2:00 se aceptan (segundo)',
  $$select prueba.reg('4006', '2026-10-17', '14:00', '15:00')$$);
select prueba.debe_fallar('Sábado: un tercer bloque supera las 2:00',
  $$select prueba.reg('4006', '2026-10-17', '16:00', '16:30')$$, 'HE_TOPE_FIN_DE_SEMANA');

select prueba.reg('4007', '2026-10-24', '08:00', '09:00');
select prueba.debe_fallar('Sábado: un bloque que se cruza con otro se rechaza',
  $$select prueba.reg('4007', '2026-10-24', '08:30', '09:00')$$, 'HE_SOLAPAMIENTO');
