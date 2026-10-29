import type { Borders, Workbook, Worksheet } from 'exceljs';
import { formatoFecha, hoyBogota } from '../lib/fechas';
import { minutosDelDia } from '../lib/horas';
import type { FilaFormato } from '../lib/tipos';

const POLITICA = [
  'WTW reconocerá trabajo de horas extras a sus Colegas únicamente cuando previa y expresamente '
  + 'lo autorice la Vicepresidencia del área, Recursos Humanos y el Jefe inmediato.',
  'Aplicable para niveles 68: Analista - Ejecutivo, 73: Asistentes y 78 Conductor registrados en '
  + 'HR Cloud autorizados para realizar trabajo suplementario, dominical o festivo, previa '
  + 'aprobación del comité interno (GBC, Affinity, Operaciones (Bill to cash)).',
  'El Jefe inmediato debe reportar a Recursos Humanos las horas extras trabajadas por medio de un '
  + 'ticket en Services Central, adjuntando este formato junto con la notificación realizada al '
  + 'trabajador y la aprobación de la Vicepresidencia correspondiente. Si no se reportan '
  + 'oportunamente, las horas extras serán pagadas de forma retroactiva en el siguiente ciclo de '
  + 'nómina, previa validación.',
];

const COLUMNAS = [
  { titulo: 'Filial', ancho: 18 },
  { titulo: 'No. identificación', ancho: 17 },
  { titulo: 'Nombre y apellidos del colega', ancho: 32 },
  { titulo: 'Cargo', ancho: 26 },
  { titulo: 'Nivel', ancho: 8 },
  { titulo: 'Fecha aprobada', ancho: 14 },
  { titulo: 'Hora de inicio', ancho: 13 },
  { titulo: 'Hora final', ancho: 13 },
  { titulo: 'Total horas extras', ancho: 13 },
  { titulo: 'Justificación', ancho: 55 },
];

const FIRMAS = [
  { titulo: 'Jefe inmediato', desde: 1, hasta: 3 },
  { titulo: 'Vicepresidencia del área', desde: 4, hasta: 7 },
  { titulo: 'Recursos Humanos', desde: 8, hasta: 10 },
];

const DELGADO = { style: 'thin' as const };
const BORDES: Partial<Borders> = { top: DELGADO, left: DELGADO, bottom: DELGADO, right: DELGADO };

/** Devuelve un color del tema en formato ARGB de Excel (ej. "FF521380"). */
export type ColorDelTema = (nombre: string) => string;

// Los colores salen del tema (tema.css), que es la única fuente de la paleta.
function colorDelTemaCss(nombre: string): string {
  const hex = getComputedStyle(document.documentElement).getPropertyValue(`--color-${nombre}`);
  return `FF${hex.trim().replace('#', '').toUpperCase()}`;
}

function fechaExcel(fecha: string): Date {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

/** Excel guarda las horas como fracción del día. */
const fraccionDelDia = (minutos: number) => minutos / 1440;

function escribirEncabezado(hoja: Worksheet, fila: number, colorDelTema: ColorDelTema) {
  const primario = colorDelTema('primario');
  const blanco = colorDelTema('blanco');

  // Las columnas 6 a 9 van bajo el encabezado combinado; las demás ocupan las dos filas.
  COLUMNAS.forEach((columna, i) => {
    const col = i + 1;
    if (col >= 6 && col <= 9) {
      hoja.getCell(fila + 1, col).value = columna.titulo;
    } else {
      hoja.getCell(fila, col).value = columna.titulo;
      hoja.mergeCells(fila, col, fila + 1, col);
    }
  });
  hoja.getCell(fila, 6).value = 'Relación horas extras';
  hoja.mergeCells(fila, 6, fila, 9);

  for (const f of [fila, fila + 1]) {
    hoja.getRow(f).height = 22;
    for (let col = 1; col <= COLUMNAS.length; col++) {
      const celda = hoja.getCell(f, col);
      celda.font = { bold: true, color: { argb: blanco } };
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primario } };
      celda.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      celda.border = BORDES;
    }
  }
}

function escribirRegistros(hoja: Worksheet, desde: number, registros: FilaFormato[]) {
  registros.forEach((r, i) => {
    const fila = hoja.getRow(desde + i);
    fila.values = [
      r.filial,
      r.identificacion,
      r.nombre_completo,
      r.cargo,
      r.nivel,
      fechaExcel(r.fecha_horas_extras),
      fraccionDelDia(minutosDelDia(r.hora_inicio)),
      fraccionDelDia(minutosDelDia(r.hora_final)),
      fraccionDelDia(r.minutos_totales),
      r.justificacion,
    ];
    fila.getCell(2).numFmt = '@';
    fila.getCell(6).numFmt = 'dd/mm/yyyy';
    fila.getCell(7).numFmt = 'h:mm AM/PM';
    fila.getCell(8).numFmt = 'h:mm AM/PM';
    fila.getCell(9).numFmt = '[h]:mm';
    fila.eachCell({ includeEmpty: true }, (celda, col) => {
      celda.border = BORDES;
      celda.alignment = {
        vertical: 'top',
        wrapText: col === 10 || col === 3 || col === 4,
        horizontal: col >= 5 && col <= 9 ? 'center' : 'left',
      };
    });
  });
}

function escribirPie(hoja: Worksheet, desde: number) {
  let fila = desde;
  for (const parrafo of POLITICA) {
    hoja.mergeCells(fila, 1, fila, COLUMNAS.length);
    const celda = hoja.getCell(fila, 1);
    celda.value = `• ${parrafo}`;
    celda.alignment = { wrapText: true, vertical: 'top' };
    hoja.getRow(fila).height = 32;
    fila++;
  }

  fila += 2;
  for (const firma of FIRMAS) {
    hoja.mergeCells(fila, firma.desde, fila, firma.hasta);
    hoja.mergeCells(fila + 1, firma.desde, fila + 1, firma.hasta);
    hoja.mergeCells(fila + 2, firma.desde, fila + 2, firma.hasta);
    hoja.getCell(fila, firma.desde).value = firma.titulo;
    hoja.getCell(fila, firma.desde).font = { bold: true };
    hoja.getCell(fila + 1, firma.desde).value = 'Nombre:';
    hoja.getCell(fila + 2, firma.desde).value = 'Fecha de aprobación:';
    for (let col = firma.desde; col <= firma.hasta; col++) {
      hoja.getCell(fila + 1, col).border = { bottom: DELGADO };
      hoja.getCell(fila + 2, col).border = { bottom: DELGADO };
    }
  }
  hoja.getRow(fila + 1).height = 26;
  hoja.getRow(fila + 2).height = 26;
}

/** Arma el formato para Services Central con los registros dados, en el orden recibido. */
export async function construirLibro(registros: FilaFormato[], colorDelTema: ColorDelTema): Promise<Workbook> {
  const { default: ExcelJS } = await import('exceljs');
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Horas extras', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  hoja.columns = COLUMNAS.map((c) => ({ width: c.ancho }));

  hoja.mergeCells(1, 1, 1, COLUMNAS.length);
  hoja.getCell(1, 1).value = 'Reporte de horas extras';
  hoja.getCell(1, 1).font = { bold: true, size: 14, color: { argb: colorDelTema('primario') } };
  hoja.mergeCells(2, 1, 2, COLUMNAS.length);
  hoja.getCell(2, 1).value = `Generado el ${formatoFecha(hoyBogota())}`;
  hoja.getCell(2, 1).font = { color: { argb: colorDelTema('texto-suave') } };

  escribirEncabezado(hoja, 4, colorDelTema);
  escribirRegistros(hoja, 6, registros);
  escribirPie(hoja, 6 + registros.length + 2);
  return libro;
}

export async function descargarFormato(registros: FilaFormato[], nombreArchivo: string) {
  const libro = await construirLibro(registros, colorDelTemaCss);
  const contenido = await libro.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([contenido], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
