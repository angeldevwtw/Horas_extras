-- Las funciones internas viven en "privado", que la API de Supabase no expone.
create schema if not exists privado;

create table public.colegas (
  id uuid primary key default gen_random_uuid(),
  identificacion text not null unique check (identificacion ~ '^[0-9A-Za-z]{3,20}$'),
  nombre_completo text not null check (btrim(nombre_completo) <> ''),
  cargo text not null check (btrim(cargo) <> ''),
  nivel smallint not null check (nivel in (68, 73, 78)),
  filial text not null check (btrim(filial) <> ''),
  updated_at timestamptz not null default now()
);

create table public.festivos (
  fecha date primary key,
  nombre text not null
);

create table public.configuracion (
  clave text primary key,
  valor text not null,
  descripcion text not null,
  -- Las reglas convierten estos valores; uno mal escrito dejaría de validar los registros.
  check (case when clave = 'fin_jornada' then valor ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
              else valor ~ '^[0-9]{1,4}$' end)
);

create table public.registros (
  id bigint generated always as identity primary key,
  codigo text generated always as ('HE-' || lpad(id::text, 5, '0')) stored unique,
  colega_id uuid not null references public.colegas (id),
  -- Copia de los datos del colega al registrar, para que el formato conserve los de esa fecha.
  identificacion text not null,
  nombre_completo text not null,
  cargo text not null,
  nivel smallint not null check (nivel in (68, 73, 78)),
  filial text not null,
  fecha_horas_extras date not null,
  hora_inicio time not null,
  hora_final time not null check (hora_final < time '24:00'),
  minutos_totales integer generated always as
    ((extract(epoch from (hora_final - hora_inicio)) / 60)::integer) stored,
  tipo_dia text not null check (tipo_dia in ('habil', 'sabado', 'domingo', 'festivo')),
  justificacion text not null check (btrim(justificacion) <> ''),
  estado text not null default 'registrada' check (estado in ('registrada', 'anulada')),
  -- No hay login: quien registra recibe una clave para poder anular. Aquí solo queda su hash.
  clave_anulacion_hash text not null,
  created_at timestamptz not null default now(),
  fecha_anulacion timestamptz,
  motivo_anulacion text
);

create index registros_colega_fecha on public.registros (colega_id, fecha_horas_extras)
  where estado = 'registrada';
