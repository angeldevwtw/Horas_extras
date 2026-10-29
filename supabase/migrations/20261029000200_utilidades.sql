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

create function privado.formato_horas(p_minutos integer) returns text
language sql immutable
as $$
  select (p_minutos / 60) || ':' || lpad((p_minutos % 60)::text, 2, '0')
$$;
