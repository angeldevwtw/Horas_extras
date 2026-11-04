-- Caso excepcional: quien descansa el sábado puede trabajar el domingo. En un fin de semana se
-- registra el sábado o el domingo, no los dos, y el festivo se compara con los dos días.
select prueba.reloj('2026-11-30 08:00');
select prueba.anonimo();

select prueba.debe_funcionar('Domingo sin sábado trabajado: 2:00 se aceptan',
  $$select prueba.reg('1601', '2026-11-08', '08:00', '10:00')$$);
select prueba.como_postgres();
select prueba.ok('El domingo queda como tipo domingo',
  (select tipo_dia = 'domingo' from public.registros where identificacion = '1601'));
select prueba.anonimo();
select prueba.debe_fallar('Domingo: 2:30 se rechaza',
  $$select prueba.reg('1602', '2026-11-08', '08:00', '10:30')$$, 'HE_TOPE_FIN_DE_SEMANA');
select prueba.debe_fallar('Con el domingo trabajado, el sábado anterior se rechaza',
  $$select prueba.reg('1601', '2026-11-07', '08:00', '09:00')$$, 'HE_DESCANSO');

select prueba.reg('1603', '2026-11-07', '08:00', '10:00');
select prueba.debe_fallar('Con el sábado trabajado, el domingo siguiente se rechaza',
  $$select prueba.reg('1603', '2026-11-08', '08:00', '09:00')$$, 'HE_DESCANSO');
select prueba.debe_funcionar('El domingo anterior a ese sábado es de otro fin de semana',
  $$select prueba.reg('1603', '2026-11-01', '08:00', '09:00')$$);

-- Lunes festivo 16 de noviembre: depende del sábado 14 y del domingo 15.
select prueba.reg('1604', '2026-11-15', '08:00', '10:00');
select prueba.debe_fallar('Con el domingo trabajado, el lunes festivo siguiente se rechaza',
  $$select prueba.reg('1604', '2026-11-16', '09:00', '10:00')$$, 'HE_DESCANSO');
select prueba.reg('1605', '2026-11-16', '09:00', '11:00');
select prueba.debe_fallar('Con el lunes festivo trabajado, el domingo anterior se rechaza',
  $$select prueba.reg('1605', '2026-11-15', '08:00', '09:00')$$, 'HE_DESCANSO');

select prueba.como_postgres();
select prueba.anular((select id from public.registros
  where identificacion = '1603' and fecha_horas_extras = '2026-11-07'));
select prueba.anonimo();
select prueba.debe_funcionar('Al anular el sábado, el domingo queda permitido',
  $$select prueba.reg('1603', '2026-11-08', '08:00', '09:00')$$);

-- Varios días a la vez.
select prueba.como_postgres();
create or replace function prueba.varios(p_identificacion text, p_dias jsonb)
returns setof bigint language sql as $$
  insert into prueba.claves (id, clave)
  select id, clave_anulacion from public.registrar_varios(p_identificacion,
    'Colega ' || p_identificacion, 'Cargo de prueba', 68, 'Banco', p_dias,
    'Cierre de proceso de prueba')
  returning id
$$;
select prueba.anonimo();

select prueba.debe_fallar('Sábado y domingo del mismo fin de semana en la selección se rechazan',
  $$select prueba.varios('1606', '[
    {"fecha": "2026-11-21", "inicio": "08:00", "final": "09:00"},
    {"fecha": "2026-11-22", "inicio": "08:00", "final": "09:00"}]')$$, 'HE_DESCANSO');
select prueba.ok('revisar_varios marca los dos días',
  (select count(distinct fecha) = 2 from public.revisar_varios('1606', 68, '[
    {"fecha": "2026-11-21", "inicio": "08:00", "final": "09:00"},
    {"fecha": "2026-11-22", "inicio": "08:00", "final": "09:00"}]', 'Motivo')
   where codigo = 'HE_DESCANSO'));
select prueba.debe_fallar('Domingo y el lunes festivo siguiente en la selección se rechazan',
  $$select prueba.varios('1607', '[
    {"fecha": "2026-11-15", "inicio": "08:00", "final": "09:00"},
    {"fecha": "2026-11-16", "inicio": "08:00", "final": "09:00"}]')$$, 'HE_DESCANSO');
select prueba.debe_funcionar('Domingos de fines de semana distintos se aceptan juntos',
  $$select prueba.varios('1608', '[
    {"fecha": "2026-11-22", "inicio": "08:00", "final": "10:00"},
    {"fecha": "2026-11-29", "inicio": "08:00", "final": "10:00"}]')$$);
