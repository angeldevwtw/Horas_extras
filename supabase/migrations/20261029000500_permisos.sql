-- La app no tiene login: quien la abre usa el rol "anon". Puede registrar y anular con su
-- clave solo a través de las funciones, y leer festivos y configuración para el formulario.
-- Los registros y los colegas no se pueden leer desde la API; se consultan en el panel de
-- Supabase, donde también se editan festivos y configuración.
alter table public.colegas enable row level security;
alter table public.festivos enable row level security;
alter table public.configuracion enable row level security;
alter table public.registros enable row level security;

-- Supabase da por defecto todos los permisos a anon y authenticated; se parte de cero.
revoke all on public.colegas, public.festivos, public.configuracion, public.registros
  from anon, authenticated;
revoke all on all functions in schema privado from public, anon, authenticated;
revoke all on function public.registrar_horas, public.revisar_registro, public.resumen_colega,
  public.anular_registro from public;

grant execute on function public.registrar_horas, public.revisar_registro, public.resumen_colega,
  public.anular_registro to anon, authenticated;

grant select on public.festivos, public.configuracion to anon, authenticated;
create policy festivos_lectura on public.festivos for select to anon, authenticated using (true);
create policy configuracion_lectura on public.configuracion for select to anon, authenticated
  using (true);
