-- Registra un correo como administrador para poder entrar por primera vez.
-- Uso: en el SQL Editor de Supabase, reemplazar el correo y ejecutar.
insert into public.usuarios (email, nombre, es_admin)
values (lower('su.correo@empresa.com'), 'Su nombre', true)
on conflict (email) do update set es_admin = true, activo = true;
