-- Administración con la clave: lista del mes con anulados y anulación por código.
select prueba.reloj('2026-10-01 08:00');
select prueba.como_postgres();
select privado.cambiar_clave_descarga('clave-de-prueba-admin');
delete from privado.intentos_descarga;
select prueba.anonimo();
select prueba.reg('1301', '2026-10-05', '17:00', '19:00');
select prueba.reg('1302', '2026-10-06', '17:00', '18:00');

select prueba.ok('Con la clave equivocada no trae registros',
  (select d ->> 'codigo' = 'HE_CLAVE_DESCARGA' and not d ? 'registros'
   from public.registros_admin('otra-clave', '2026-10-01') d));
select prueba.ok('Con la clave equivocada no anula',
  (select public.anular_con_clave('otra-clave',
     (select codigo from public.registros_admin('clave-de-prueba-admin', '2026-10-01') r,
        jsonb_to_recordset(r -> 'registros') x(codigo text, identificacion text)
      where identificacion = '1301'), 'Error de digitación') ->> 'ok' = 'false'));

select prueba.ok('Con la clave correcta anula por código, aunque se haya cerrado la ventana',
  (select public.anular_con_clave('clave-de-prueba-admin', x.codigo, 'Error de digitación') ->> 'ok' = 'true'
   from public.registros_admin('clave-de-prueba-admin', '2026-10-01') r,
     jsonb_to_recordset(r -> 'registros') x(codigo text, identificacion text)
   where x.identificacion = '1301'));
select prueba.ok('La lista trae el anulado con su motivo y el vigente',
  (select count(*) filter (where x.estado = 'anulada' and x.motivo_anulacion = 'Error de digitación') = 1
      and count(*) filter (where x.estado = 'registrada') >= 1
   from public.registros_admin('clave-de-prueba-admin', '2026-10-01') r,
     jsonb_to_recordset(r -> 'registros') x(estado text, motivo_anulacion text, identificacion text)
   where x.identificacion in ('1301', '1302')));
select prueba.ok('Anular dos veces responde con un mensaje, sin error',
  (select d ->> 'mensaje' like '%ya estaba anulado%'
   from public.registros_admin('clave-de-prueba-admin', '2026-10-01') r,
     jsonb_to_recordset(r -> 'registros') x(codigo text, identificacion text),
     public.anular_con_clave('clave-de-prueba-admin', x.codigo, 'otra vez') d
   where x.identificacion = '1301'));
select prueba.ok('Sin motivo no anula',
  (select d ->> 'ok' = 'false'
   from public.registros_admin('clave-de-prueba-admin', '2026-10-01') r,
     jsonb_to_recordset(r -> 'registros') x(codigo text, identificacion text),
     public.anular_con_clave('clave-de-prueba-admin', x.codigo, '  ') d
   where x.identificacion = '1302'));
select prueba.debe_funcionar('Al anular se liberan las horas del día',
  $$select prueba.reg('1301', '2026-10-05', '17:00', '19:00')$$);
