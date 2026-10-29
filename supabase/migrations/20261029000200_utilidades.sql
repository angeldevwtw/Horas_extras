-- Hora actual en Bogotá. Las pruebas pueden fijarla con set_config('prueba.ahora', ...),
-- pero solo desde una conexión directa como postgres; por la API la sesión es "authenticator".
create function privado.ahora() returns timestamp
language sql stable
set search_path = ''
as $$
  select coalesce(
    case when session_user = 'postgres'
      then nullif(current_setting('prueba.ahora', true), '')::timestamp
    end,
    now() at time zone 'America/Bogota'
  )
$$;

create function privado.config_minutos(p_clave text) returns integer
language sql stable security definer
set search_path = ''
as $$
  select valor::integer from public.configuracion where clave = p_clave
$$;

create function privado.fin_jornada() returns time
language sql stable security definer
set search_path = ''
as $$
  select valor::time from public.configuracion where clave = 'fin_jornada'
$$;

create function privado.tipo_dia(p_fecha date) returns text
language sql stable security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.festivos where fecha = p_fecha) then 'festivo'
    when extract(isodow from p_fecha) = 6 then 'sabado'
    when extract(isodow from p_fecha) = 7 then 'domingo'
    else 'habil'
  end
$$;

-- Usuario de la app que corresponde a la sesión; null si no está registrado o está inactivo.
create function privado.usuario_id() returns uuid
language sql stable security definer
set search_path = ''
as $$
  select id from public.usuarios where auth_id = auth.uid() and activo
$$;

create function privado.es_admin() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select es_admin from public.usuarios where auth_id = auth.uid() and activo),
    false
  )
$$;

create function privado.exigir_usuario() returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_id uuid := privado.usuario_id();
begin
  if v_id is null then
    raise exception using
      message = 'Su correo no está habilitado para usar la aplicación.',
      detail = 'HE_SIN_ACCESO', errcode = '42501';
  end if;
  return v_id;
end
$$;

create function privado.formato_horas(p_minutos integer) returns text
language sql immutable
as $$
  select (p_minutos / 60) || ':' || lpad((p_minutos % 60)::text, 2, '0')
$$;
