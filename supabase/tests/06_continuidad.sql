-- Día hábil: las horas extras empiezan justo al terminar la jornada.
select prueba.reloj('2026-10-01 08:00');
select prueba.anonimo();

select prueba.debe_funcionar('Día hábil de 5:00 PM a 7:00 PM se acepta',
  $$select prueba.reg('6001', '2026-10-05', '17:00', '19:00')$$);
select prueba.debe_fallar('Día hábil de 6:00 PM a 8:00 PM se rechaza (pausa de una hora)',
  $$select prueba.reg('6002', '2026-10-05', '18:00', '20:00')$$, 'HE_INICIO_JORNADA');
select prueba.debe_fallar('Día hábil de 5:30 PM a 6:30 PM se rechaza',
  $$select prueba.reg('6003', '2026-10-05', '17:30', '18:30')$$, 'HE_INICIO_JORNADA');
select prueba.debe_fallar('Día hábil antes de la jornada (6:00 AM) se rechaza',
  $$select prueba.reg('6004', '2026-10-05', '06:00', '07:00')$$, 'HE_INICIO_JORNADA');

select prueba.como_postgres();
update public.configuracion set valor = '18:00' where clave = 'fin_jornada';
select prueba.anonimo();
select prueba.debe_funcionar('Con jornada hasta las 6:00 PM, iniciar a las 6:00 PM se acepta',
  $$select prueba.reg('6005', '2026-10-06', '18:00', '19:00')$$);
select prueba.debe_fallar('Con jornada hasta las 6:00 PM, iniciar a las 5:00 PM se rechaza',
  $$select prueba.reg('6006', '2026-10-06', '17:00', '18:00')$$, 'HE_INICIO_JORNADA');
