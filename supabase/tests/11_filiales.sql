-- Solo las cuatro filiales: Banco, Sufi, Leasing y Empleados.
select prueba.reloj('2026-10-01 08:00');
select prueba.anonimo();

select prueba.debe_funcionar('Filial ' || f || ' se acepta',
  format($$select public.registrar_horas('%s', 'Colega %s', 'Cargo', 68, %L, '2026-10-05',
    '17:00', '18:00', 'Prueba de filial')$$, n, n, f))
from (values (1201, 'Banco'), (1202, 'Sufi'), (1203, 'Leasing'), (1204, 'Empleados')) v(n, f);
select prueba.debe_fallar('Una filial fuera de la lista se rechaza',
  $$select public.registrar_horas('1205', 'Colega 1205', 'Cargo', 68, 'Filial A', '2026-10-05',
    '17:00', '18:00', 'Prueba de filial')$$, 'HE_FILIAL');
select prueba.debe_fallar('La filial distingue mayúsculas (debe venir del desplegable)',
  $$select public.registrar_horas('1206', 'Colega 1206', 'Cargo', 68, 'banco', '2026-10-05',
    '17:00', '18:00', 'Prueba de filial')$$, 'HE_FILIAL');

select prueba.como_postgres();
select prueba.debe_fallar('Ni desde el panel entra un registro con otra filial',
  $$insert into public.registros (colega_id, identificacion, nombre_completo, cargo, nivel,
      filial, fecha_horas_extras, hora_inicio, hora_final, tipo_dia, justificacion,
      clave_anulacion_hash)
    select id, identificacion, nombre_completo, cargo, nivel, 'Otra', '2026-10-06', '17:00',
      '18:00', 'habil', 'x', 'x' from public.colegas where identificacion = '1201'$$, '23514');
