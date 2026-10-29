-- Solo niveles 68, 73 y 78.
select prueba.reloj('2026-10-01 08:00');
select prueba.como('jefe.uno@ejemplo.com');

select prueba.debe_funcionar('Nivel 68 (Analista - Ejecutivo) se registra',
  $$select prueba.reg('1001', '2026-10-05', '17:00', '18:00', 68)$$);
select prueba.debe_funcionar('Nivel 73 (Asistentes) se registra',
  $$select prueba.reg('1002', '2026-10-05', '17:00', '18:00', 73)$$);
select prueba.debe_funcionar('Nivel 78 (Conductor) se registra',
  $$select prueba.reg('1003', '2026-10-05', '17:00', '18:00', 78)$$);
select prueba.debe_fallar('Nivel 70 no se puede registrar',
  $$select prueba.reg('1004', '2026-10-05', '17:00', '18:00', 70)$$, 'HE_NIVEL');
select prueba.debe_fallar('Nivel vacío no se puede registrar',
  $$select prueba.reg('1005', '2026-10-05', '17:00', '18:00', null)$$, 'HE_NIVEL');

select prueba.como_postgres();
select prueba.ok('El colega de nivel no permitido no queda creado',
  not exists (select 1 from public.colegas where identificacion = '1004'));
