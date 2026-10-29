-- Nadie puede saltarse las reglas desde la API, ni ver registros ajenos.
select prueba.reloj('2026-10-01 08:00');
select prueba.como('jefe.uno@ejemplo.com');
select prueba.reg('8001', '2026-10-05', '17:00', '19:00');

select prueba.debe_fallar('UPDATE directo del estado falla',
  $$update public.registros set estado = 'anulada'$$, '42501');
select prueba.debe_fallar('UPDATE directo de la hora final falla',
  $$update public.registros set hora_final = '23:00'$$, '42501');
select prueba.debe_fallar('INSERT directo en registros falla',
  $$insert into public.registros (colega_id, identificacion, nombre_completo, cargo, nivel,
      filial, fecha_horas_extras, hora_inicio, hora_final, tipo_dia, justificacion, registrado_por)
    select colega_id, identificacion, nombre_completo, cargo, nivel, filial, '2026-10-06',
      '17:00', '23:00', 'habil', 'x', registrado_por from public.registros limit 1$$, '42501');
select prueba.debe_fallar('DELETE directo falla', $$delete from public.registros$$, '42501');
select prueba.debe_fallar('Un usuario que no es admin no puede crear usuarios',
  $$insert into public.usuarios (email, nombre, es_admin) values ('otro@ejemplo.com', 'Otro', true)$$,
  '42501');
update public.configuracion set valor = '600' where clave = 'tope_diario_min';
select prueba.ok('Un usuario que no es admin no puede cambiar la configuración',
  (select valor = '120' from public.configuracion where clave = 'tope_diario_min'));

select prueba.como('jefe.dos@ejemplo.com');
select prueba.ok('Otro jefe no ve los registros ajenos',
  (select count(*) = 0 from public.registros));
select prueba.ok('Otro jefe no ve los colegas que no ha registrado',
  (select count(*) = 0 from public.colegas));
select prueba.debe_fallar('Otro jefe no puede anular un registro ajeno',
  $$select public.anular_registro(1, 'x')$$, 'HE_SIN_PERMISO');

select prueba.como('admin@ejemplo.com');
select prueba.ok('El admin ve todos los registros', (select count(*) = 1 from public.registros));
select prueba.debe_funcionar('El admin puede anular cualquier registro',
  $$select public.anular_registro(1, 'Prueba admin')$$);
select prueba.debe_fallar('Un registro anulado no se anula dos veces',
  $$select public.anular_registro(1, 'x')$$, 'HE_YA_ANULADO');

-- Incluso con permisos totales (SQL Editor) las reglas aplican.
select prueba.como_postgres();
select prueba.debe_fallar('Como postgres, revivir un registro anulado falla',
  $$update public.registros set estado = 'registrada'$$, 'HE_REGISTRO_INMUTABLE');
select prueba.debe_fallar('Como postgres, borrar un registro falla',
  $$delete from public.registros$$, 'HE_REGISTRO_INMUTABLE');
select prueba.debe_fallar('Como postgres, insertar un registro que rompe el tope falla',
  $$insert into public.registros (colega_id, identificacion, nombre_completo, cargo, nivel,
      filial, fecha_horas_extras, hora_inicio, hora_final, tipo_dia, justificacion, registrado_por)
    select colega_id, identificacion, nombre_completo, cargo, nivel, filial, '2026-10-06',
      '17:00', '23:00', 'habil', 'x', registrado_por from public.registros limit 1$$,
  'HE_TOPE_DIARIO');

select prueba.como('inactivo@ejemplo.com');
select prueba.debe_fallar('Un usuario inactivo no puede registrar',
  $$select prueba.reg('8002', '2026-10-05', '17:00', '18:00')$$, 'HE_SIN_ACCESO');
select prueba.como('intruso@ejemplo.com');
select prueba.debe_fallar('Una cuenta que no está en la lista no puede registrar',
  $$select prueba.reg('8003', '2026-10-05', '17:00', '18:00')$$, 'HE_SIN_ACCESO');
select prueba.ok('Una cuenta que no está en la lista no ve festivos ni configuración',
  (select count(*) = 0 from public.festivos) and (select count(*) = 0 from public.configuracion));

select prueba.como_postgres();
set role anon;
select prueba.debe_fallar('Sin sesión no se puede llamar a registrar_horas',
  $$select prueba.reg('8004', '2026-10-05', '17:00', '18:00')$$, '42501');
select prueba.debe_fallar('Sin sesión no se pueden leer registros',
  $$select count(*) from public.registros$$, '42501');
reset role;

select prueba.ok('El hook de Auth deja entrar un correo de la lista (sin importar mayúsculas)',
  public.hook_antes_de_crear_usuario('{"user": {"email": "Jefe.Uno@Ejemplo.com"}}') = '{}');
select prueba.ok('El hook de Auth rechaza un correo fuera de la lista',
  public.hook_antes_de_crear_usuario('{"user": {"email": "intruso@ejemplo.com"}}') ? 'error');
select prueba.ok('El hook de Auth rechaza un usuario inactivo',
  public.hook_antes_de_crear_usuario('{"user": {"email": "inactivo@ejemplo.com"}}') ? 'error');
select prueba.ok('La cuenta de Auth queda enlazada al usuario por correo',
  (select auth_id is not null from public.usuarios where email = 'jefe.uno@ejemplo.com'));
