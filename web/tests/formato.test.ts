import ExcelJS from 'exceljs';
import { expect, it } from 'vitest';
import { construirLibro } from '../src/exportar/formatoServicesCentral';
import type { Registro } from '../src/lib/tipos';

const registro: Registro = {
  id: 1,
  codigo: 'HE-00001',
  identificacion: '900000001',
  nombre_completo: 'Colega Uno Ficticio',
  cargo: 'Asistente de prueba',
  nivel: 73,
  filial: 'Filial A',
  fecha_horas_extras: '2026-09-01',
  hora_inicio: '17:00:00',
  hora_final: '18:00:00',
  minutos_totales: 60,
  tipo_dia: 'habil',
  justificacion: 'Apoyo a cierre de prueba',
  estado: 'registrada',
  clave_anulacion: '00000000-0000-0000-0000-000000000000',
};

it('arma el formato con el encabezado combinado, los formatos y el pie', async () => {
  const libro = await construirLibro([registro], () => 'FF521380');
  // Ida y vuelta por el archivo para revisar lo que realmente queda en el .xlsx.
  const leido = new ExcelJS.Workbook();
  await leido.xlsx.load(await libro.xlsx.writeBuffer());
  const hoja = leido.getWorksheet('Horas extras')!;

  expect(hoja.getCell('F4').value).toBe('Relación horas extras');
  expect(hoja.getCell('I4').isMerged).toBe(true);
  expect(hoja.getCell('A4').value).toBe('Filial');
  expect(hoja.getCell('A5').isMerged).toBe(true);
  expect(['F5', 'G5', 'H5', 'I5'].map((c) => hoja.getCell(c).value))
    .toEqual(['Fecha aprobada', 'Hora de inicio', 'Hora final', 'Total horas extras']);

  const fila = hoja.getRow(6);
  expect(fila.getCell(1).value).toBe('Filial A');
  expect(fila.getCell(2).value).toBe('900000001');
  expect(fila.getCell(5).value).toBe(73);
  expect((fila.getCell(6).value as Date).toISOString().slice(0, 10)).toBe('2026-09-01');
  expect(fila.getCell(6).numFmt).toBe('dd/mm/yyyy');
  // Excel guarda las horas como fracción del día; ExcelJS las lee como fecha del 30/12/1899.
  const hora = (col: number) => (fila.getCell(col).value as Date).toISOString().slice(11, 16);
  expect(hora(7)).toBe('17:00');
  expect(fila.getCell(7).numFmt).toBe('h:mm AM/PM');
  expect(hora(8)).toBe('18:00');
  expect(hora(9)).toBe('01:00');
  expect(fila.getCell(9).numFmt).toBe('[h]:mm');

  const textos: string[] = [];
  hoja.eachRow((r) => r.eachCell((c) => { if (typeof c.value === 'string') textos.push(c.value); }));
  expect(textos.some((t) => t.includes('Services Central'))).toBe(true);
  expect(textos).toEqual(expect.arrayContaining(['Jefe inmediato', 'Vicepresidencia del área', 'Recursos Humanos']));
});
