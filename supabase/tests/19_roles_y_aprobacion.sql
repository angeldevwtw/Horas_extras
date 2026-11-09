-- Director y coordinador ven y deciden solo lo de su línea; el super admin ve todo.
select prueba.reloj('2026-11-30 08:00');

select prueba.como_postgres();
select privado.cambiar_clave_descarga('clave-de-prueba-admin');
insert into auth.users (id, email, email_confirmed_at) values
  ('10000000-0000-0000-0000-000000000001', 'ana@prueba.co', now()),
  ('10000000-0000-0000-0000-000000000002', 'beto@prueba.co', now()),
  ('10000000-0000-0000-0000-000000000003', 'caro@prueba.co', now()),
  ('10000000-0000-0000-0000-000000000004', 'dani@prueba.co', now()),
  ('10000000-0000-0000-0000-000000000005', 'suplantador@prueba.co', null),
  ('10000000-0000-0000-0000-000000000006', 'sin-rol@prueba.co', now());
insert into public.jefes (id, nombre, correo, rol, director_id) values
  ('20000000-0000-0000-0000-000000000001', 'Ana Directora', 'ana@prueba.co', 'director', null),
  ('20000000-0000-0000-0000-000000000002', 'Beto Director', 'beto@prueba.co', 'director', null),
  ('20000000-0000-0000-0000-000000000003', 'Caro Coordinadora', 'caro@prueba.co', 'coordinador',
   '20000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000004', 'Dani Coordinador', 'dani@prueba.co', 'coordinador',
   '20000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000005', 'Sin confirmar', 'suplantador@prueba.co', 'director', null);

create function prueba.con_jefe(
  p_identificacion text, p_fecha date, p_coordinador uuid, p_director uuid default null
) returns bigint language sql as $$
  insert into prueba.claves (id, clave)
  select id, clave_anulacion from public.registrar_horas(p_identificacion,
    'Colega ' || p_identificacion, 'Cargo', 68, 'Banco', p_fecha, '17:00', '18:00', 'Motivo', null,
    p_coordinador, p_director)
  returning id
$$;
select prueba.anonimo();

select prueba.ok('El formulario lista los jefes activos sin sus correos',
  (select count(*) = 6 and bool_and(to_jsonb(j) - array['id', 'nombre', 'rol', 'director', 'filial'] = '{}')
   from public.jefes_formulario() j));
select prueba.ok('El coordinador sale con su director',
  (select director = 'Ana Directora' from public.jefes_formulario() where nombre = 'Caro Coordinadora'));

select prueba.debe_fallar('Sin coordinador ni director no se registra',
  $$select prueba.con_jefe('1901', '2026-11-03', null)$$, 'HE_JEFE');
select prueba.debe_fallar('Un director no sirve como coordinador',
  $$select prueba.con_jefe('1901', '2026-11-03', '20000000-0000-0000-0000-000000000001')$$, 'HE_JEFE');
select prueba.debe_fallar('Un coordinador no sirve como director',
  $$select prueba.con_jefe('1901', '2026-11-03', null, '20000000-0000-0000-0000-000000000003')$$, 'HE_JEFE');
select prueba.debe_fallar('Registrar varios días también exige jefe y no dice un día',
  $$select public.registrar_varios('1901', 'Colega', 'Cargo', 68, 'Banco',
      '[{"fecha": "2026-11-03", "inicio": "17:00", "final": "18:00"}]', 'Motivo')$$, 'HE_JEFE');

-- Caro y Dani dependen de Ana; 1904 depende directamente de Beto.
select prueba.con_jefe('1902', '2026-11-03', '20000000-0000-0000-0000-000000000003');
select prueba.con_jefe('1902', '2026-11-04', '20000000-0000-0000-0000-000000000003');
select prueba.con_jefe('1902', '2026-11-05', '20000000-0000-0000-0000-000000000003');
select prueba.con_jefe('1903', '2026-11-03', '20000000-0000-0000-0000-000000000004');
select prueba.con_jefe('1904', '2026-11-03', null, '20000000-0000-0000-0000-000000000002');

select prueba.como_postgres();
select prueba.ok('El registro queda pendiente y el director sale del coordinador',
  (select aprobacion = 'pendiente' and director_id = '20000000-0000-0000-0000-000000000001'
   from public.registros where identificacion = '1902' limit 1));
create function prueba.codigo(p_identificacion text, p_fecha date) returns text language sql
security definer as $$
  select codigo from public.registros
  where identificacion = p_identificacion and fecha_horas_extras = p_fecha
$$;
grant execute on function prueba.codigo to anon, authenticated;
select prueba.anonimo();

select prueba.debe_fallar('Sin cuenta no se ven los registros del equipo',
  $$select public.registros_equipo('2026-11-01')$$, '42501');
select prueba.debe_fallar('Sin cuenta no se decide',
  $$select public.decidir_registros(array[prueba.codigo('1902', '2026-11-03')], 'aprobada')$$, '42501');

select prueba.como_cuenta('10000000-0000-0000-0000-000000000006');
select prueba.ok('Una cuenta que no es de un jefe no tiene perfil', public.mi_perfil() is null);
select prueba.debe_fallar('Una cuenta que no es de un jefe no ve registros',
  $$select public.registros_equipo('2026-11-01')$$, 'HE_SIN_PERMISO');

select prueba.como_cuenta('10000000-0000-0000-0000-000000000005');
select prueba.ok('Una cuenta con el correo sin confirmar no toma el rol', public.mi_perfil() is null);

select prueba.como_cuenta('10000000-0000-0000-0000-000000000003');
select prueba.ok('El perfil dice el rol', (select public.mi_perfil() ->> 'rol' = 'coordinador'));
select prueba.ok('La coordinadora ve solo su equipo',
  (select jsonb_array_length(d -> 'registros') = 3
      and (select bool_and(x ->> 'identificacion' = '1902') from jsonb_array_elements(d -> 'registros') x)
   from public.registros_equipo('2026-11-01') d));
select prueba.ok('La coordinadora ve el nombre de su director en el registro',
  (select d -> 'registros' -> 0 ->> 'director' = 'Ana Directora'
   from public.registros_equipo('2026-11-01') d));
select prueba.debe_fallar('La coordinadora no decide lo del otro equipo',
  $$select public.decidir_registros(array[prueba.codigo('1903', '2026-11-03')], 'aprobada')$$,
  'HE_SIN_PERMISO');
select prueba.debe_fallar('Negar exige motivo',
  $$select public.decidir_registros(array[prueba.codigo('1902', '2026-11-03')], 'negada', '  ')$$,
  'HE_MOTIVO_DECISION');
select prueba.debe_fallar('Un código inexistente no decide nada',
  $$select public.decidir_registros(array[prueba.codigo('1902', '2026-11-03'), 'HE-99999'], 'aprobada')$$,
  'HE_SIN_PERMISO');
select prueba.ok('...y deshace la parte que sí existía',
  (select d -> 'pendientes' @> jsonb_build_array(jsonb_build_object('codigo', prueba.codigo('1902', '2026-11-03')))
   from public.registros_equipo('2026-11-01') d));
select prueba.ok('La coordinadora aprueba',
  public.decidir_registros(array[prueba.codigo('1902', '2026-11-03')], 'aprobada') = 1);

select prueba.como_cuenta('10000000-0000-0000-0000-000000000001');
select prueba.ok('La directora ve a sus dos coordinadores y no lo de otro director',
  (select jsonb_array_length(d -> 'registros') = 4
      and jsonb_array_length(d -> 'pendientes') = 3
   from public.registros_equipo('2026-11-01') d));
select prueba.debe_fallar('Vale la primera decisión: la directora no la cambia',
  $$select public.decidir_registros(array[prueba.codigo('1902', '2026-11-03')], 'negada', 'No')$$,
  'HE_YA_DECIDIDO');
select prueba.debe_fallar('La directora no decide lo de otro director',
  $$select public.decidir_registros(array[prueba.codigo('1904', '2026-11-03')], 'aprobada')$$,
  'HE_SIN_PERMISO');
select prueba.ok('La directora niega lo de su coordinadora',
  public.decidir_registros(array[prueba.codigo('1902', '2026-11-04')], 'negada', 'No autorizada') = 1);
select prueba.debe_fallar('El jefe no puede modificar registros directamente',
  $$update public.registros set aprobacion = 'aprobada'$$, '42501');

select prueba.como_cuenta('10000000-0000-0000-0000-000000000002');
select prueba.ok('El director ve a quien lo eligió directamente',
  (select jsonb_array_length(d -> 'registros') = 1 from public.registros_equipo('2026-11-01') d));

select prueba.anonimo();
select prueba.ok('Lo negado libera las horas de la semana',
  (select minutos_semana = 120 from public.resumen_colega('1902', '2026-11-04')));
select prueba.debe_funcionar('Y el día negado se puede registrar de nuevo',
  $$select prueba.con_jefe('1902', '2026-11-04', '20000000-0000-0000-0000-000000000003')$$);
select prueba.ok('Lo pendiente sí cuenta para la semana',
  (select minutos_semana = 180 from public.resumen_colega('1902', '2026-11-04')));
select prueba.debe_fallar('Con la clave del registro ya no se anula lo aprobado',
  $$select prueba.anular((select id from prueba.claves order by id limit 1))$$, 'HE_YA_DECIDIDO');

select prueba.ok('El super admin ve todo, con el estado de aprobación',
  (select jsonb_array_length(d -> 'registros') = 6
      and (select count(*) = 1 from jsonb_array_elements(d -> 'registros') x
           where x ->> 'aprobacion' = 'negada' and x ->> 'decidido_por' = 'Ana Directora'
             and x ->> 'motivo_decision' = 'No autorizada')
   from public.registros_admin('clave-de-prueba-admin', '2026-11-01') d));
select prueba.ok('El super admin anula lo aprobado',
  (select public.anular_con_clave('clave-de-prueba-admin', prueba.codigo('1902', '2026-11-03'), 'Error') ->> 'ok' = 'true'));

-- Lista de jefes desde la administración.
select prueba.ok('Sin la clave no se ve la lista de jefes',
  (select d ->> 'ok' = 'false' and not d ? 'jefes' from public.jefes_admin('otra-clave') d));
select prueba.ok('Con la clave se ve la lista y quién tiene cuenta',
  (select (x ->> 'tiene_cuenta')::boolean
   from jsonb_array_elements(public.jefes_admin('clave-de-prueba-admin') -> 'jefes') x
   where x ->> 'correo' = 'ana@prueba.co'));
select prueba.ok('Sin la clave no se agregan jefes',
  (select public.guardar_jefe_admin('otra-clave', null, 'Eva', 'eva@prueba.co', 'director', null) ->> 'ok' = 'false'));
select prueba.ok('Se agrega un director con la clave',
  (select public.guardar_jefe_admin('clave-de-prueba-admin', null, ' Eva  Díaz ', ' EVA@prueba.co ',
     'director', null) ->> 'ok' = 'true'));
select prueba.ok('El correo no se repite',
  (select public.guardar_jefe_admin('clave-de-prueba-admin', null, 'Otra', 'eva@prueba.co',
     'director', null) ->> 'mensaje' like 'Ya existe%'));
select prueba.ok('Un coordinador necesita un director de verdad',
  (select public.guardar_jefe_admin('clave-de-prueba-admin', null, 'Fer', 'fer@prueba.co',
     'coordinador', '20000000-0000-0000-0000-000000000003') ->> 'mensaje' like 'Elija el director%'));
select prueba.ok('No se desactiva un director con coordinadores activos',
  (select public.guardar_jefe_admin('clave-de-prueba-admin', '20000000-0000-0000-0000-000000000001',
     'Ana Directora', 'ana@prueba.co', 'director', null, false) ->> 'mensaje' like 'Este director%'));
select prueba.ok('Se desactiva un coordinador',
  (select public.guardar_jefe_admin('clave-de-prueba-admin', '20000000-0000-0000-0000-000000000004',
     'Dani Coordinador', 'dani@prueba.co', 'coordinador', '20000000-0000-0000-0000-000000000001', false) ->> 'ok' = 'true'));
select prueba.ok('Y sale del formulario',
  not exists (select 1 from public.jefes_formulario() where nombre = 'Dani Coordinador'));
select prueba.debe_fallar('Y ya no se puede elegir',
  $$select prueba.con_jefe('1905', '2026-11-03', '20000000-0000-0000-0000-000000000004')$$, 'HE_JEFE');
select prueba.como_cuenta('10000000-0000-0000-0000-000000000004');
select prueba.ok('Y su cuenta pierde el acceso', public.mi_perfil() is null);

-- El director maneja los coordinadores de su línea.
select prueba.como_cuenta('10000000-0000-0000-0000-000000000001');
select prueba.ok('El director agrega un coordinador a su línea',
  (select public.guardar_coordinador(null, ' Gabi  Ruiz ', ' GABI@prueba.co ') ->> 'ok' = 'true'));
select prueba.ok('Y lo ve en su lista, todavía sin cuenta',
  (select not (x ->> 'tiene_cuenta')::boolean
   from jsonb_array_elements(public.mis_coordinadores()) x where x ->> 'correo' = 'gabi@prueba.co'));
select prueba.ok('Y sale en el formulario con ese director',
  (select director = 'Ana Directora' from public.jefes_formulario() where nombre = 'Gabi Ruiz'));
select prueba.ok('El correo de otro jefe no se repite',
  (select public.guardar_coordinador(null, 'Otra', 'beto@prueba.co') ->> 'mensaje' like 'Ya existe%'));
select prueba.ok('Desactiva a su coordinador',
  (select public.guardar_coordinador('20000000-0000-0000-0000-000000000003', 'Caro Coordinadora',
     'caro@prueba.co', false) ->> 'ok' = 'true'));
select prueba.ok('Y lo vuelve a activar',
  (select public.guardar_coordinador('20000000-0000-0000-0000-000000000003', 'Caro Coordinadora',
     'caro@prueba.co', true) ->> 'ok' = 'true'));
select prueba.debe_fallar('No toca a un director',
  $$select public.guardar_coordinador('20000000-0000-0000-0000-000000000002', 'Beto', 'beto@prueba.co', false)$$,
  'HE_SIN_PERMISO');

select prueba.como_cuenta('10000000-0000-0000-0000-000000000002');
select prueba.ok('Otro director no ve los coordinadores ajenos',
  (select public.mis_coordinadores() = '[]'::jsonb));
select prueba.debe_fallar('Ni los modifica',
  $$select public.guardar_coordinador('20000000-0000-0000-0000-000000000003', 'Caro', 'caro@prueba.co', false)$$,
  'HE_SIN_PERMISO');

select prueba.como_cuenta('10000000-0000-0000-0000-000000000003');
select prueba.debe_fallar('Un coordinador no ve la lista de coordinadores',
  $$select public.mis_coordinadores()$$, 'HE_SIN_PERMISO');
select prueba.debe_fallar('Ni agrega coordinadores',
  $$select public.guardar_coordinador(null, 'Hugo', 'hugo@prueba.co')$$, 'HE_SIN_PERMISO');
select prueba.debe_fallar('Ni cambia la filial de un director',
  $$select public.guardar_mi_filial('Sufi')$$, 'HE_SIN_PERMISO');

-- Filial de cada jefe: el formulario filtra y la base no deja elegir a uno de otra filial.
select prueba.como_cuenta('10000000-0000-0000-0000-000000000001');
select prueba.ok('El director agrega un coordinador con su filial',
  (select public.guardar_coordinador(null, 'Iván Sufi', 'ivan@prueba.co', true, 'Sufi') ->> 'ok' = 'true'));
select prueba.ok('El director marca su propia filial',
  (select public.guardar_mi_filial('Banco') ->> 'ok' = 'true'));
select prueba.ok('Y su perfil la muestra', (select public.mi_perfil() ->> 'filial' = 'Banco'));
select prueba.ok('No acepta una filial que no existe',
  (select public.guardar_mi_filial('Otra') ->> 'mensaje' like 'Elija una filial%'));
select prueba.ok('Sigue activo y con su filial tras el intento',
  (select public.mi_perfil() ->> 'filial' = 'Banco'));

select prueba.como_cuenta('10000000-0000-0000-0000-000000000002');
select prueba.ok('Otro director marca otra filial',
  (select public.guardar_mi_filial('Sufi') ->> 'ok' = 'true'));

select prueba.anonimo();
select prueba.ok('El formulario trae la filial de cada jefe',
  (select filial = 'Sufi' from public.jefes_formulario() where nombre = 'Iván Sufi'));
select prueba.debe_fallar('No se elige a un coordinador de otra filial',
  $$select prueba.con_jefe('1906', '2026-11-03', (select id from public.jefes_formulario() where nombre = 'Iván Sufi'))$$,
  'HE_JEFE');
select prueba.debe_fallar('Ni a un director de otra filial',
  $$select prueba.con_jefe('1906', '2026-11-03', null, '20000000-0000-0000-0000-000000000002')$$, 'HE_JEFE');
select prueba.ok('Sí a un director de la filial',
  (select prueba.con_jefe('1906', '2026-11-03', null, '20000000-0000-0000-0000-000000000001') is not null));
select prueba.ok('Y a un coordinador sin filial, que sirve para todas',
  (select prueba.con_jefe('1907', '2026-11-03', '20000000-0000-0000-0000-000000000003') is not null));
select prueba.ok('El super admin asigna la filial',
  (select public.guardar_jefe_admin('clave-de-prueba-admin', '20000000-0000-0000-0000-000000000003',
     'Caro Coordinadora', 'caro@prueba.co', 'coordinador', '20000000-0000-0000-0000-000000000001', true, 'Leasing') ->> 'ok' = 'true'));
select prueba.ok('Y el formulario la refleja',
  (select filial = 'Leasing' from public.jefes_formulario() where nombre = 'Caro Coordinadora'));

select prueba.anonimo();
select prueba.debe_fallar('Sin cuenta no se agregan coordinadores',
  $$select public.guardar_coordinador(null, 'Hugo', 'hugo@prueba.co')$$, '42501');
select prueba.debe_fallar('Desde la API no se lee la tabla de jefes',
  $$select count(*) from public.jefes$$, '42501');
select prueba.como_postgres();
select prueba.debe_fallar('Como postgres, un registro no se aprueba sin pasar por la decisión',
  $$update public.registros set aprobacion = 'aprobada' where aprobacion = 'pendiente'$$,
  'HE_REGISTRO_INMUTABLE');
