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
select prueba.debe_fallar('Día hábil ya registrado: otro registro ese día se rechaza',
  $$select prueba.reg('2004', '2026-10-06', '17:00', '17:30')$$, 'HE_DIA_REGISTRADO');
select prueba.debe_fallar('Día hábil ya registrado: también después del primero',
  $$select prueba.reg('2004', '2026-10-06', '18:00', '19:00')$$, 'HE_DIA_REGISTRADO');
select prueba.ok('El aviso dice el día y el código del registro que ya existe',
  (select mensaje like 'El colega ya tiene horas extras registradas el 06/10/2026 (HE-%'
   from public.revisar_registro('2004', 68, '2026-10-06', '17:00', '17:30', 'x')));
select prueba.ok('El resumen trae lo registrado ese día',
  (select minutos_dia = 60 and codigos_dia like 'HE-%' from public.resumen_colega('2004', '2026-10-06')));
select prueba.ok('Un día sin registros sale en cero',
  (select minutos_dia = 0 and codigos_dia is null from public.resumen_colega('2004', '2026-10-07')));

select prueba.como_postgres();
select prueba.ok('Minutos y tipo de día los calcula la base',
  (select minutos_totales = 120 and tipo_dia = 'habil' and codigo ~ '^HE-\d{5}$'
   from public.registros where identificacion = '2001'));
