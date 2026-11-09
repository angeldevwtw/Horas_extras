-- Las horas extras se registran después de trabajarlas: hasta hoy, en hora de Bogotá.
select prueba.reloj('2026-11-04 08:00');
select prueba.anonimo();

select prueba.debe_funcionar('Ayer se acepta',
  $$select prueba.reg('1801', '2026-11-03', '17:00', '18:00')$$);
select prueba.debe_funcionar('Hoy se acepta',
  $$select prueba.reg('1802', '2026-11-04', '17:00', '18:00')$$);
select prueba.debe_fallar('Mañana se rechaza',
  $$select prueba.reg('1803', '2026-11-05', '17:00', '18:00')$$, 'HE_FECHA_FUTURA');
select prueba.debe_fallar('El último día del mes en curso se rechaza si aún no llega',
  $$select prueba.reg('1803', '2026-11-30', '17:00', '18:00')$$, 'HE_FECHA_FUTURA');
select prueba.debe_fallar('Un sábado futuro también se rechaza',
  $$select prueba.reg('1803', '2026-11-07', '08:00', '10:00')$$, 'HE_FECHA_FUTURA');
select prueba.debe_fallar('El mes siguiente sigue con su propio error',
  $$select prueba.reg('1803', '2026-12-01', '17:00', '18:00')$$, 'HE_FECHA_FUERA_DEL_MES');

select prueba.debe_fallar('Sufi tampoco puede registrar un día futuro',
  $$select prueba.registrar_horas('1804', 'Colega 1804', 'Cargo', 68, 'Sufi', '2026-11-05',
    '12:00', '21:00', 'Prueba', 60)$$, 'HE_FECHA_FUTURA');
select prueba.debe_fallar('Con varios días, uno futuro impide guardar todos',
  $$select prueba.registrar_varios('1805', 'Colega 1805', 'Cargo', 68, 'Banco', '[
    {"fecha": "2026-11-03", "inicio": "17:00", "final": "18:00"},
    {"fecha": "2026-11-05", "inicio": "17:00", "final": "18:00"}]', 'Prueba')$$, 'HE_FECHA_FUTURA');
select prueba.ok('revisar_varios señala el día futuro en el campo de fecha',
  (select fecha = '2026-11-05' and campo = 'fecha_horas_extras'
   from public.revisar_varios('1805', 68, '[
     {"fecha": "2026-11-03", "inicio": "17:00", "final": "18:00"},
     {"fecha": "2026-11-05", "inicio": "17:00", "final": "18:00"}]', 'Prueba')));

-- A las 11:30 PM del 4 en Bogotá ya es 5 en UTC, pero todavía no se puede registrar el 5.
select prueba.reloj('2026-11-04 23:30');
select prueba.debe_fallar('El límite es la fecha de Bogotá',
  $$select prueba.reg('1806', '2026-11-05', '17:00', '18:00')$$, 'HE_FECHA_FUTURA');
select prueba.reloj('2026-11-05 00:30');
select prueba.debe_funcionar('Al llegar el día en Bogotá ya se acepta',
  $$select prueba.reg('1806', '2026-11-05', '17:00', '18:00')$$);
