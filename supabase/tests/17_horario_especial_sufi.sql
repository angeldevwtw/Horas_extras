-- Sufi en día hábil: se marca la jornada, hasta las 9:00 PM, y aparte el total de horas extras.
-- Sábado y festivo siguen igual que en las demás filiales; el domingo, en
-- 16_domingo_si_descansa_sabado.sql.
select prueba.reloj('2026-11-30 08:00');

select prueba.como_postgres();
create function prueba.sufi(
  p_identificacion text, p_fecha date, p_inicio time, p_final time, p_minutos integer default null,
  p_filial text default 'Sufi'
) returns bigint language sql as $$
  insert into prueba.claves (id, clave)
  select id, clave_anulacion from public.registrar_horas(p_identificacion,
    'Colega ' || p_identificacion, 'Cargo de prueba', 68, p_filial, p_fecha, p_inicio, p_final,
    'Cierre de proceso de prueba', p_minutos)
  returning id
$$;

create function prueba.sufi_varios(p_identificacion text, p_dias jsonb)
returns setof bigint language sql as $$
  insert into prueba.claves (id, clave)
  select id, clave_anulacion from public.registrar_varios(p_identificacion,
    'Colega ' || p_identificacion, 'Cargo de prueba', 68, 'Sufi', p_dias,
    'Cierre de proceso de prueba')
  returning id
$$;

create function prueba.minutos(p_identificacion text, p_fecha date) returns integer
language sql as $$
  select minutos_totales from public.registros
  where identificacion = p_identificacion and fecha_horas_extras = p_fecha
$$;
select prueba.anonimo();

select prueba.debe_funcionar('Jornada de 12:00 PM a 9:00 PM con 1:00 de horas extras se acepta',
  $$select prueba.sufi('1701', '2026-11-05', '12:00', '21:00', 60)$$);
select prueba.debe_funcionar('El viernes tampoco tiene inicio fijo',
  $$select prueba.sufi('1702', '2026-11-06', '08:00', '21:00', 120)$$);
select prueba.debe_fallar('La jornada no puede terminar después de las 9:00 PM',
  $$select prueba.sufi('1703', '2026-11-05', '12:00', '21:30', 60)$$, 'HE_FIN_SUFI');
select prueba.debe_fallar('El total no puede pasar de 2:00 en día hábil',
  $$select prueba.sufi('1703', '2026-11-05', '12:00', '21:00', 150)$$, 'HE_TOPE_DIARIO');
select prueba.debe_fallar('El total debe ir en medias horas',
  $$select prueba.sufi('1703', '2026-11-05', '12:00', '21:00', 45)$$, 'HE_TOTAL_INVALIDO');
select prueba.debe_fallar('El total debe ser mayor que cero',
  $$select prueba.sufi('1703', '2026-11-05', '12:00', '21:00', 0)$$, 'HE_TOTAL_INVALIDO');
select prueba.debe_fallar('El total no puede ser mayor que la jornada',
  $$select prueba.sufi('1703', '2026-11-05', '20:00', '21:00', 120)$$, 'HE_TOTAL_INVALIDO');
select prueba.debe_fallar('Sin total se calcula con las horas y aplica el tope',
  $$select prueba.sufi('1703', '2026-11-05', '12:00', '21:00')$$, 'HE_TOPE_DIARIO');
select prueba.debe_funcionar('Sin total y dentro del tope se calcula con las horas',
  $$select prueba.sufi('1704', '2026-11-05', '19:00', '21:00')$$);
select prueba.debe_fallar('El día hábil sigue admitiendo un solo registro',
  $$select prueba.sufi('1701', '2026-11-05', '12:00', '21:00', 30)$$, 'HE_DIA_REGISTRADO');

select prueba.como_postgres();
select prueba.ok('Se guarda el total indicado, no la diferencia entre las horas',
  prueba.minutos('1701', '2026-11-05') = 60);
select prueba.ok('Sin total queda la diferencia entre las horas',
  prueba.minutos('1704', '2026-11-05') = 120);
select prueba.debe_fallar('El total guardado no se puede modificar',
  $$update public.registros set minutos_totales = 30
    where identificacion = '1701'$$, 'HE_REGISTRO_INMUTABLE');
select prueba.anonimo();
select prueba.ok('El resumen de la semana suma el total indicado',
  (select minutos_semana = 60 from public.resumen_colega('1701', '2026-11-05')));
select prueba.ok('dias_del_colega devuelve el total indicado',
  (select minutos = 60 from public.dias_del_colega('1701', '2026-11-01', '2026-11-30')
   where fecha = '2026-11-05'));

-- Tope semanal bajado a 8:00: cuatro días de 2:00 ya lo alcanzan, aunque cada jornada dure 9:00.
select prueba.sufi('1705', d::date, '12:00', '21:00', 120)
from unnest(array['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12']) d;
select prueba.como_postgres();
update public.configuracion set valor = '480' where clave = 'tope_semanal_min';
select prueba.anonimo();
select prueba.debe_fallar('El tope semanal cuenta el total indicado, no la jornada',
  $$select prueba.sufi('1705', '2026-11-13', '12:00', '21:00', 30)$$, 'HE_TOPE_SEMANAL');
select prueba.como_postgres();
update public.configuracion set valor = '720' where clave = 'tope_semanal_min';
select prueba.anonimo();

-- Las demás filiales no cambian, aunque manden un total.
select prueba.debe_fallar('Banco sigue con inicio fijo',
  $$select prueba.sufi('1706', '2026-11-05', '12:00', '21:00', 60, 'Banco')$$, 'HE_INICIO_JORNADA');
select prueba.sufi('1707', '2026-11-05', '17:00', '18:00', 30, 'Banco');
select prueba.como_postgres();
select prueba.ok('Banco ignora el total enviado', prueba.minutos('1707', '2026-11-05') = 60);
select prueba.anonimo();

-- Fin de semana y festivo de Sufi: igual que las demás filiales.
select prueba.debe_funcionar('Sufi el sábado no tiene límite de las 9:00 PM',
  $$select prueba.sufi('1708', '2026-11-07', '20:00', '22:00')$$);
select prueba.debe_funcionar('Sufi el sábado ignora el total enviado',
  $$select prueba.sufi('1709', '2026-11-07', '08:00', '10:00', 30)$$);
select prueba.debe_fallar('Sufi el sábado: la franja completa cuenta para el tope',
  $$select prueba.sufi('1710', '2026-11-07', '08:00', '11:00', 60)$$, 'HE_TOPE_FIN_DE_SEMANA');
select prueba.debe_fallar('Sufi el lunes festivo: la franja completa cuenta para el tope',
  $$select prueba.sufi('1710', '2026-11-16', '12:00', '21:00', 60)$$, 'HE_TOPE_FIN_DE_SEMANA');
select prueba.como_postgres();
select prueba.ok('El total del sábado es la diferencia entre las horas',
  prueba.minutos('1709', '2026-11-07') = 120);
select prueba.anonimo();

-- Varios días a la vez.
select prueba.debe_funcionar('Varios días de Sufi guardan el total de cada uno',
  $$select prueba.sufi_varios('1711', '[
    {"fecha": "2026-11-17", "inicio": "12:00", "final": "21:00", "minutos": 60},
    {"fecha": "2026-11-18", "inicio": "10:00", "final": "20:00", "minutos": 90}]')$$);
select prueba.como_postgres();
select prueba.ok('Queda el total del primer día', prueba.minutos('1711', '2026-11-17') = 60);
select prueba.ok('Queda el total del segundo día', prueba.minutos('1711', '2026-11-18') = 90);
select prueba.anonimo();
select prueba.debe_fallar('Si un día de Sufi no cumple no se guarda ninguno',
  $$select prueba.sufi_varios('1712', '[
    {"fecha": "2026-11-17", "inicio": "12:00", "final": "21:00", "minutos": 60},
    {"fecha": "2026-11-18", "inicio": "12:00", "final": "22:00", "minutos": 60}]')$$, 'HE_FIN_SUFI');
select prueba.ok('revisar_varios aplica el límite con la filial Sufi',
  (select codigo = 'HE_FIN_SUFI' and campo = 'hora_final' and fecha = '2026-11-18'
   from public.revisar_varios('1712', 68,
     '[{"fecha": "2026-11-18", "inicio": "12:00", "final": "22:00", "minutos": 60}]', 'Motivo', 'Sufi')));
select prueba.ok('revisar_varios señala el total inválido en su campo',
  (select codigo = 'HE_TOTAL_INVALIDO' and campo = 'minutos_totales'
   from public.revisar_varios('1712', 68,
     '[{"fecha": "2026-11-18", "inicio": "20:00", "final": "21:00", "minutos": 120}]', 'Motivo', 'Sufi')));
select prueba.ok('revisar_varios sin filial aplica las reglas generales',
  (select codigo = 'HE_INICIO_JORNADA'
   from public.revisar_varios('1712', 68,
     '[{"fecha": "2026-11-18", "inicio": "12:00", "final": "13:00"}]', 'Motivo')));
select prueba.ok('El tope semanal de la selección usa el total indicado',
  (select count(*) = 0 from public.revisar_varios('1713', 68, '[
     {"fecha": "2026-11-23", "inicio": "08:00", "final": "21:00", "minutos": 120},
     {"fecha": "2026-11-24", "inicio": "08:00", "final": "21:00", "minutos": 120},
     {"fecha": "2026-11-25", "inicio": "08:00", "final": "21:00", "minutos": 120},
     {"fecha": "2026-11-26", "inicio": "08:00", "final": "21:00", "minutos": 120},
     {"fecha": "2026-11-27", "inicio": "08:00", "final": "21:00", "minutos": 120}]',
     'Motivo', 'Sufi')));
