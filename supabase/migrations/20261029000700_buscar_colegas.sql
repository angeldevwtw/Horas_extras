-- Búsqueda para autocompletar por cédula o nombre. Se hace por RPC (POST) para que el texto
-- buscado, que puede ser una cédula, no quede en la URL ni en los logs de la API.
-- Corre con los permisos de quien llama, así que solo encuentra los colegas que le deja ver RLS.
create function public.buscar_colegas(p_texto text)
returns table (identificacion text, nombre_completo text, cargo text, nivel smallint, filial text)
language sql stable
set search_path = ''
as $$
  select c.identificacion, c.nombre_completo, c.cargo, c.nivel, c.filial
  from public.colegas c
  where length(btrim(p_texto)) >= 3
    and (c.identificacion like upper(btrim(p_texto)) || '%'
         or c.nombre_completo ilike '%' || btrim(p_texto) || '%')
  order by c.nombre_completo
  limit 10
$$;

revoke all on function public.buscar_colegas from public, anon;
grant execute on function public.buscar_colegas to authenticated;
