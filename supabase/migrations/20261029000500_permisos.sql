alter table public.usuarios enable row level security;
alter table public.colegas enable row level security;
alter table public.festivos enable row level security;
alter table public.configuracion enable row level security;
alter table public.registros enable row level security;

-- Supabase da por defecto todos los permisos a anon y authenticated; se parte de cero.
revoke all on public.usuarios, public.colegas, public.festivos, public.configuracion,
  public.registros from anon, authenticated;
revoke all on all functions in schema privado from public, anon, authenticated;
revoke all on function public.registrar_horas, public.revisar_registro, public.resumen_colega,
  public.anular_registro from public, anon;

grant usage on schema privado to authenticated;
grant execute on function privado.usuario_id, privado.es_admin to authenticated;
grant execute on function public.registrar_horas, public.revisar_registro, public.resumen_colega,
  public.anular_registro to authenticated;

-- Registros: solo lectura. Se crean con registrar_horas() y se anulan con anular_registro().
grant select on public.registros to authenticated;
create policy registros_lectura on public.registros for select to authenticated
  using (registrado_por = privado.usuario_id() or privado.es_admin());

-- Colegas: cada usuario ve los que ha registrado (para autocompletar); el admin, todos.
grant select on public.colegas to authenticated;
grant update (nombre_completo, cargo, nivel, filial) on public.colegas to authenticated;
create policy colegas_lectura on public.colegas for select to authenticated
  using (
    privado.es_admin()
    or exists (select 1 from public.registros r
               where r.colega_id = colegas.id and r.registrado_por = privado.usuario_id())
  );
create policy colegas_edicion_admin on public.colegas for update to authenticated
  using (privado.es_admin()) with check (privado.es_admin());

grant select on public.festivos, public.configuracion to authenticated;
grant insert, update, delete on public.festivos to authenticated;
grant update (valor) on public.configuracion to authenticated;
create policy festivos_lectura on public.festivos for select to authenticated
  using (privado.usuario_id() is not null);
create policy festivos_admin on public.festivos for all to authenticated
  using (privado.es_admin()) with check (privado.es_admin());
create policy configuracion_lectura on public.configuracion for select to authenticated
  using (privado.usuario_id() is not null);
create policy configuracion_admin on public.configuracion for update to authenticated
  using (privado.es_admin()) with check (privado.es_admin());

grant select on public.usuarios to authenticated;
grant insert (email, nombre, es_admin, activo) on public.usuarios to authenticated;
grant update (nombre, es_admin, activo) on public.usuarios to authenticated;
create policy usuarios_propio on public.usuarios for select to authenticated
  using (auth_id = auth.uid() or privado.es_admin());
create policy usuarios_admin_crea on public.usuarios for insert to authenticated
  with check (privado.es_admin());
create policy usuarios_admin_edita on public.usuarios for update to authenticated
  using (privado.es_admin()) with check (privado.es_admin());

create function privado.normalizar_usuario() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  new.email := lower(btrim(new.email));
  if tg_op = 'INSERT' then
    new.auth_id := (select u.id from auth.users u where lower(u.email) = new.email);
  end if;
  return new;
end
$$;

create trigger normalizar_usuario
  before insert on public.usuarios
  for each row execute function privado.normalizar_usuario();

-- Enlaza la cuenta de Supabase Auth con el usuario de la app en el primer ingreso.
create function privado.enlazar_cuenta() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.usuarios set auth_id = new.id
  where email = lower(new.email) and auth_id is null;
  return new;
end
$$;

create trigger enlazar_cuenta
  after insert on auth.users
  for each row execute function privado.enlazar_cuenta();

-- Hook "Before User Created" de Supabase Auth: solo se crean cuentas para correos de la
-- lista de usuarios activos, aunque el código OTP sea válido.
create function public.hook_antes_de_crear_usuario(event jsonb) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.usuarios
    where email = lower(btrim(event -> 'user' ->> 'email')) and activo
  ) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Este correo no está habilitado para usar la aplicación de horas extras.'
  ));
end
$$;

revoke all on function public.hook_antes_de_crear_usuario from public, anon, authenticated;
grant execute on function public.hook_antes_de_crear_usuario to supabase_auth_admin;
