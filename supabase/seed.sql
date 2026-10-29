-- Datos 100% ficticios para desarrollo local. No usar datos reales de colegas.
insert into public.usuarios (email, nombre, es_admin) values
  ('admin@ejemplo.com', 'Administrador de Prueba', true),
  ('jefe.uno@ejemplo.com', 'Jefe Uno de Prueba', false),
  ('jefe.dos@ejemplo.com', 'Jefe Dos de Prueba', false);

insert into public.usuarios (email, nombre, activo) values
  ('inactivo@ejemplo.com', 'Usuario Inactivo de Prueba', false);

insert into public.colegas (identificacion, nombre_completo, cargo, nivel, filial) values
  ('900000001', 'Colega Uno Ficticio', 'Analista de prueba', 68, 'Filial A'),
  ('900000002', 'Colega Dos Ficticio', 'Asistente de prueba', 73, 'Filial A'),
  ('900000003', 'Colega Tres Ficticio', 'Conductor de prueba', 78, 'Filial B');
