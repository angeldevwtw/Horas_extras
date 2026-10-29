-- La fecha debe ser del mes y año en curso, y las horas deben tener sentido.
select prueba.reloj('2026-10-15 08:00');
select prueba.anonimo();

select prueba.debe_funcionar('Primer día del mes en curso se acepta',
  $$select prueba.reg('7001', '2026-10-01', '17:00', '18:00')$$);
select prueba.debe_funcionar('Último día hábil del mes en curso se acepta',
  $$select prueba.reg('7002', '2026-10-30', '17:00', '18:00')$$);
select prueba.debe_fallar('Mes anterior se rechaza',
  $$select prueba.reg('7003', '2026-09-30', '17:00', '18:00')$$, 'HE_FECHA_FUERA_DEL_MES');
select prueba.debe_fallar('Mes siguiente se rechaza',
  $$select prueba.reg('7004', '2026-11-03', '17:00', '18:00')$$, 'HE_FECHA_FUERA_DEL_MES');
select prueba.debe_fallar('Mismo mes de otro año se rechaza',
  $$select prueba.reg('7005', '2025-10-15', '17:00', '18:00')$$, 'HE_FECHA_FUERA_DEL_MES');
select prueba.debe_fallar('Hora final igual a la de inicio se rechaza',
  $$select prueba.reg('7006', '2026-10-16', '17:00', '17:00')$$, 'HE_HORAS_INVALIDAS');
select prueba.debe_fallar('Hora final antes de la de inicio (cruza medianoche) se rechaza',
  $$select prueba.reg('7007', '2026-10-17', '23:00', '01:00')$$, 'HE_HORAS_INVALIDAS');
select prueba.debe_fallar('Justificación vacía se rechaza',
  $$select prueba.reg('7008', '2026-10-16', '17:00', '18:00', 68, '   ')$$, 'HE_JUSTIFICACION');
select prueba.debe_fallar('Identificación con puntos se rechaza',
  $$select prueba.reg('1.020.000', '2026-10-16', '17:00', '18:00')$$, 'HE_IDENTIFICACION');

-- A las 12:30 AM del 1 de noviembre en Bogotá ya es noviembre, aunque en otra zona no.
select prueba.reloj('2026-11-01 00:30');
select prueba.debe_fallar('A las 12:30 AM del 1 de noviembre, octubre ya no se acepta',
  $$select prueba.reg('7009', '2026-10-30', '17:00', '18:00')$$, 'HE_FECHA_FUERA_DEL_MES');

select prueba.reloj('2026-10-15 08:00');
select prueba.ok('revisar_registro devuelve todos los errores a la vez',
  (select array_agg(codigo order by codigo) = array['HE_INICIO_JORNADA', 'HE_JUSTIFICACION',
     'HE_NIVEL', 'HE_TOPE_DIARIO']
   from public.revisar_registro('7010', 70, '2026-10-05', '18:00', '21:00', '')));
