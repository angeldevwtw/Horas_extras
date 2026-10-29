-- Las horas van en punto o y media. El formulario solo ofrece esas opciones; la restricción
-- cubre a quien llame a la API directamente.
alter table public.registros add constraint registros_media_hora check (
  extract(minute from hora_inicio) in (0, 30) and extract(second from hora_inicio) = 0
  and extract(minute from hora_final) in (0, 30) and extract(second from hora_final) = 0
);
