-- El director asigna la contraseña de sus coordinadores; no toca directores ni líneas ajenas.
select prueba.como_postgres();
insert into auth.users (id, email, email_confirmed_at) values
  ('10000000-0000-0000-0000-000000000001', 'ana@prueba.co', now()),
  ('10000000-0000-0000-0000-000000000002', 'beto@prueba.co', now()),
  ('10000000-0000-0000-0000-000000000003', 'caro@prueba.co', now());
insert into auth.sessions (user_id) values
  ('10000000-0000-0000-0000-000000000003'), ('10000000-0000-0000-0000-000000000001');
insert into public.jefes (id, nombre, correo, rol, director_id, activo) values
  ('20000000-0000-0000-0000-000000000001', 'Ana Directora', 'ana@prueba.co', 'director', null, true),
  ('20000000-0000-0000-0000-000000000002', 'Beto Director', 'beto@prueba.co', 'director', null, true),
  ('20000000-0000-0000-0000-000000000003', 'Caro Coordinadora', 'caro@prueba.co', 'coordinador',
   '20000000-0000-0000-0000-000000000001', true),
  ('20000000-0000-0000-0000-000000000004', 'Gabi Coordinadora', 'gabi@prueba.co', 'coordinador',
   '20000000-0000-0000-0000-000000000001', true),
  ('20000000-0000-0000-0000-000000000005', 'Hugo Inactivo', 'hugo@prueba.co', 'coordinador',
   '20000000-0000-0000-0000-000000000001', false),
  ('20000000-0000-0000-0000-000000000006', 'Iván de Beto', 'ivan@prueba.co', 'coordinador',
   '20000000-0000-0000-0000-000000000002', true);

select prueba.como_cuenta('10000000-0000-0000-0000-000000000001');
select prueba.ok('Autoriza a un coordinador sin cuenta y dice su correo',
  (select r ->> 'ok' = 'true' and r ->> 'correo' = 'gabi@prueba.co' and r -> 'usuario_id' = 'null'
   from public.autorizar_contrasena_coordinador('20000000-0000-0000-0000-000000000004') r));
select prueba.ok('Y a uno con cuenta, con el id de la cuenta',
  (select r ->> 'usuario_id' = '10000000-0000-0000-0000-000000000003'
   from public.autorizar_contrasena_coordinador('20000000-0000-0000-0000-000000000003') r));
select prueba.ok('A un coordinador inactivo no',
  (select public.autorizar_contrasena_coordinador('20000000-0000-0000-0000-000000000005')
     ->> 'mensaje' like 'Active al coordinador%'));
select prueba.debe_fallar('No autoriza la cuenta de un director',
  $$select public.autorizar_contrasena_coordinador('20000000-0000-0000-0000-000000000002')$$,
  'HE_SIN_PERMISO');
select prueba.debe_fallar('Ni la de un coordinador de otro director',
  $$select public.autorizar_contrasena_coordinador('20000000-0000-0000-0000-000000000006')$$,
  'HE_SIN_PERMISO');
select prueba.debe_fallar('Ni un id que no existe',
  $$select public.autorizar_contrasena_coordinador(gen_random_uuid())$$, 'HE_SIN_PERMISO');
select prueba.debe_fallar('El director no cierra sesiones por su cuenta',
  $$select public.cerrar_sesiones('10000000-0000-0000-0000-000000000003')$$, '42501');

select prueba.como_cuenta('10000000-0000-0000-0000-000000000003');
select prueba.debe_fallar('Un coordinador no autoriza contraseñas',
  $$select public.autorizar_contrasena_coordinador('20000000-0000-0000-0000-000000000004')$$,
  'HE_SIN_PERMISO');

select prueba.anonimo();
select prueba.debe_fallar('Sin sesión no se puede llamar',
  $$select public.autorizar_contrasena_coordinador('20000000-0000-0000-0000-000000000004')$$, '42501');
select prueba.debe_fallar('Ni cerrar sesiones',
  $$select public.cerrar_sesiones('10000000-0000-0000-0000-000000000003')$$, '42501');

reset role;
set role service_role;
select public.cerrar_sesiones('10000000-0000-0000-0000-000000000003');
reset role;
select prueba.ok('La service_role cierra las sesiones de esa cuenta y no las de otra',
  (select not exists (select 1 from auth.sessions where user_id = '10000000-0000-0000-0000-000000000003')
      and exists (select 1 from auth.sessions where user_id = '10000000-0000-0000-0000-000000000001')));
