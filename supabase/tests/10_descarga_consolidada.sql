-- Descarga del mes con clave compartida.
select prueba.reloj('2026-10-01 08:00');
select prueba.anonimo();
select prueba.reg('1101', '2026-10-05', '17:00', '19:00');
select prueba.reg('1102', '2026-10-06', '17:00', '18:00');
select prueba.reg('1103', '2026-10-07', '17:00', '18:30');

select prueba.ok('Sin clave definida la descarga no está habilitada',
  (select public.descargar_registros('cualquier-cosa', '2026-10-01') ->> 'codigo'
   = 'HE_DESCARGA_SIN_CLAVE'));
select prueba.debe_fallar('Desde la API no se puede definir la clave',
  $$select privado.cambiar_clave_descarga('una-clave-cualquiera')$$, '42501');
select prueba.debe_fallar('Desde la API no se pueden leer las claves guardadas',
  $$select * from privado.clave_descarga$$, '42501');

select prueba.como_postgres();
select prueba.debe_fallar('La clave debe tener al menos 12 caracteres',
  $$select privado.cambiar_clave_descarga('corta')$$, 'P0001');
select privado.cambiar_clave_descarga('clave-de-prueba-rrhh');
select prueba.ok('La clave no se guarda en texto plano',
  (select hash <> 'clave-de-prueba-rrhh' and hash ~ '^[0-9a-f]{64}$' from privado.clave_descarga));
select prueba.anular((select id from prueba.claves order by id desc limit 1));
select prueba.reloj('2026-11-02 08:00');
select prueba.anonimo();
select prueba.reg('1104', '2026-11-03', '17:00', '18:00');

select prueba.ok('Con la clave correcta trae los registros del mes, sin los anulados ni otros meses',
  (select d ->> 'ok' = 'true'
      and jsonb_array_length(d -> 'registros') = 2
      and d -> 'registros' -> 0 ->> 'identificacion' = '1101'
      and d -> 'registros' -> 1 ->> 'identificacion' = '1102'
      and (d -> 'registros' -> 0 ->> 'minutos_totales')::int = 120
   from public.descargar_registros('clave-de-prueba-rrhh', '2026-10-15') d));
select prueba.ok('Se puede descargar un mes anterior',
  (select jsonb_array_length(public.descargar_registros('clave-de-prueba-rrhh', '2026-11-01')
     -> 'registros') = 1));
select prueba.ok('Con la clave equivocada no trae nada',
  (select d ->> 'codigo' = 'HE_CLAVE_DESCARGA' and not d ? 'registros'
   from public.descargar_registros('otra-clave', '2026-10-01') d));

select public.descargar_registros('otra-clave', '2026-10-01') from generate_series(1, 9);
select prueba.ok('Tras 10 intentos fallidos se bloquea, aunque llegue la clave correcta',
  (select public.descargar_registros('clave-de-prueba-rrhh', '2026-10-01') ->> 'codigo'
   = 'HE_DEMASIADOS_INTENTOS'));
