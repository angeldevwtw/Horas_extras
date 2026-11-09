-- La lista "Registrado en esta ventana" consulta la decisión del jefe. Solo responde por los
-- registros cuya clave de anulación tiene quien pregunta, la misma que se entregó al registrar.
create function public.estado_en_la_ventana(p_registros jsonb)
returns table (id bigint, estado text, aprobacion text)
language sql stable security definer
set search_path = ''
as $$
  select r.id, r.estado, r.aprobacion
  from jsonb_to_recordset(p_registros) as p (id bigint, clave uuid)
  join public.registros r on r.id = p.id and r.clave_anulacion_hash = privado.hash_clave(p.clave)
$$;

revoke all on function public.estado_en_la_ventana from public;
grant execute on function public.estado_en_la_ventana to anon, authenticated;
