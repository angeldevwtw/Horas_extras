-- Sin login: desde la API solo se puede registrar y anular con la clave; nada se puede leer.
select prueba.reloj('2026-10-01 08:00');
select prueba.anonimo();
select prueba.reg('8001', '2026-10-05', '17:00', '19:00');

select prueba.debe_fallar('Desde la API no se pueden leer los registros',
  $$select count(*) from public.registros$$, '42501');
select prueba.debe_fallar('Desde la API no se pueden leer los colegas',
  $$select count(*) from public.colegas$$, '42501');
select prueba.debe_fallar('UPDATE directo del estado falla',
  $$update public.registros set estado = 'anulada'$$, '42501');
select prueba.debe_fallar('UPDATE directo de la hora final falla',
  $$update public.registros set hora_final = '23:00'$$, '42501');
select prueba.debe_fallar('INSERT directo en registros falla',
  $$insert into public.registros (colega_id, identificacion, nombre_completo, cargo, nivel,
      filial, fecha_horas_extras, hora_inicio, hora_final, tipo_dia, justificacion,
      clave_anulacion_hash)
    values (gen_random_uuid(), '8002', 'X', 'X', 68, 'X', '2026-10-06', '17:00', '23:00',
      'habil', 'x', 'x')$$, '42501');
select prueba.debe_fallar('DELETE directo falla', $$delete from public.registros$$, '42501');
select prueba.debe_fallar('Desde la API no se puede cambiar la configuración',
  $$update public.configuracion set valor = '600' where clave = 'tope_diario_min'$$, '42501');
select prueba.debe_fallar('Desde la API no se pueden agregar festivos',
  $$insert into public.festivos values ('2026-10-20', 'Inventado')$$, '42501');
select prueba.ok('Desde la API sí se leen festivos y configuración (para el formulario)',
  (select count(*) > 0 from public.festivos) and (select count(*) = 5 from public.configuracion));
select prueba.debe_fallar('Las funciones internas no se pueden llamar desde la API',
  $$select privado.tipo_dia('2026-10-05')$$, '42501');

select prueba.debe_fallar('Sin la clave correcta no se puede anular',
  $$select public.anular_registro((select id from prueba.claves limit 1), gen_random_uuid(), 'x')$$,
  'HE_SIN_PERMISO');
select prueba.debe_fallar('Anular exige un motivo',
  $$select public.anular_registro((select id from prueba.claves limit 1),
      (select clave from prueba.claves limit 1), '  ')$$, 'HE_MOTIVO_ANULACION');
select prueba.debe_funcionar('Con la clave que entregó el registro sí se anula',
  $$select prueba.anular((select id from prueba.claves limit 1))$$);
select prueba.debe_fallar('Un registro anulado no se anula dos veces',
  $$select prueba.anular((select id from prueba.claves limit 1))$$, 'HE_YA_ANULADO');

-- Incluso con permisos totales (panel de Supabase) las reglas aplican.
select prueba.como_postgres();
select prueba.debe_fallar('Como postgres, revivir un registro anulado falla',
  $$update public.registros set estado = 'registrada'$$, 'HE_REGISTRO_INMUTABLE');
select prueba.debe_fallar('Como postgres, borrar un registro falla',
  $$delete from public.registros$$, 'HE_REGISTRO_INMUTABLE');
select prueba.debe_fallar('Como postgres, insertar un registro que rompe el tope falla',
  $$insert into public.registros (colega_id, identificacion, nombre_completo, cargo, nivel,
      filial, fecha_horas_extras, hora_inicio, hora_final, tipo_dia, justificacion,
      clave_anulacion_hash)
    select colega_id, identificacion, nombre_completo, cargo, nivel, filial, '2026-10-06',
      '17:00', '23:00', 'habil', 'x', 'x' from public.registros limit 1$$,
  'HE_TOPE_DIARIO');

select prueba.anonimo();
select prueba.reg('8003', '2026-10-06', '17:00', '18:00');
select prueba.debe_fallar('Desde la API no se puede usar la anulación del administrador',
  $$select privado.anular_registro_admin('HE-00002', 'x')$$, '42501');
select prueba.como_postgres();
select prueba.debe_funcionar('Desde el panel el administrador anula por código',
  $$select privado.anular_registro_admin(
    lower((select codigo from public.registros where identificacion = '8003')), 'Prueba admin')$$);
select prueba.ok('...y el registro queda anulado con su motivo',
  (select estado = 'anulada' and motivo_anulacion = 'Prueba admin'
   from public.registros where identificacion = '8003'));
