-- Máximo 2 horas en día hábil.
select prueba.reloj('2026-10-01 08:00');
select prueba.anonimo();

select prueba.debe_funcionar('Día hábil: exactamente 2:00 se acepta',
  $$select prueba.reg('2001', '2026-10-05', '17:00', '19:00')$$);
select prueba.debe_fallar('Día hábil: 2:01 se rechaza',
  $$select prueba.reg('2002', '2026-10-05', '17:00', '19:01')$$, 'HE_TOPE_DIARIO');
select prueba.debe_fallar('Día hábil: 3:00 se rechaza',
  $$select prueba.reg('2003', '2026-10-06', '17:00', '20:00')$$, 'HE_TOPE_DIARIO');

select prueba.debe_funcionar('Día hábil: 1:00 se acepta',
  $$select prueba.reg('2004', '2026-10-06', '17:00', '18:00')$$);
select prueba.debe_fallar('Segundo registro el mismo día se cruza con el primero',
  $$select prueba.reg('2004', '2026-10-06', '17:00', '17:30')$$, 'HE_SOLAPAMIENTO');
select prueba.debe_fallar('Segundo registro el mismo día después del primero rompe la continuidad',
  $$select prueba.reg('2004', '2026-10-06', '18:00', '19:00')$$, 'HE_INICIO_JORNADA');

select prueba.como_postgres();
select prueba.ok('Minutos y tipo de día los calcula la base',
  (select minutos_totales = 120 and tipo_dia = 'habil' and codigo ~ '^HE-\d{5}$'
   from public.registros where identificacion = '2001'));
