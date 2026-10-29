-- Solo horas en punto o y media.
select prueba.reloj('2026-10-01 08:00');
select prueba.anonimo();

select prueba.debe_funcionar('Sábado de 8:30 a 10:00 se acepta',
  $$select prueba.reg('12001', '2026-10-03', '08:30', '10:00')$$);
select prueba.debe_fallar('Una hora final con 15 minutos se rechaza',
  $$select prueba.reg('12002', '2026-10-05', '17:00', '18:15')$$, '23514');
select prueba.debe_fallar('Una hora de inicio con 45 minutos se rechaza',
  $$select prueba.reg('12003', '2026-10-10', '08:45', '09:30')$$, '23514');
