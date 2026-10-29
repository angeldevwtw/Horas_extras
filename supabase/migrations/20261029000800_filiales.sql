-- Las filiales son cuatro. registrar_horas crea o actualiza el colega antes de guardar el
-- registro, así que este trigger da el mensaje claro; la restricción de registros cubre
-- inserciones hechas por fuera. Es NOT VALID para no chocar con registros anteriores.
create function privado.validar_filial() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.filial is null or new.filial not in ('Banco', 'Sufi', 'Leasing', 'Empleados') then
    raise exception using
      message = 'La filial debe ser Banco, Sufi, Leasing o Empleados.',
      detail = 'HE_FILIAL', errcode = 'P0001';
  end if;
  return new;
end
$$;

create trigger validar_filial
  before insert or update of filial on public.colegas
  for each row execute function privado.validar_filial();

alter table public.registros
  add constraint registros_filial check (filial in ('Banco', 'Sufi', 'Leasing', 'Empleados')) not valid;
