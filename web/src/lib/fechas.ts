// Fechas como texto ISO "AAAA-MM-DD", siempre interpretadas en America/Bogota.

const formatoBogota = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];

export type TipoDia = 'habil' | 'sabado' | 'domingo' | 'festivo';

export const NOMBRE_TIPO_DIA: Record<TipoDia, string> = {
  habil: 'Día hábil',
  sabado: 'Sábado',
  domingo: 'Domingo',
  festivo: 'Festivo',
};

export function hoyBogota(ahora = new Date()): string {
  return formatoBogota.format(ahora);
}

/** 0 = domingo … 6 = sábado. */
export function diaDeSemana(fecha: string): number {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

export function tipoDia(fecha: string, festivos: Set<string>): TipoDia {
  if (festivos.has(fecha)) return 'festivo';
  const dia = diaDeSemana(fecha);
  if (dia === 6) return 'sabado';
  if (dia === 0) return 'domingo';
  return 'habil';
}

export function mismoMes(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function diasDelMes(fecha: string): string[] {
  const [a, m] = fecha.split('-').map(Number);
  const total = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return Array.from({ length: total }, (_, i) =>
    `${fecha.slice(0, 7)}-${String(i + 1).padStart(2, '0')}`);
}

export function nombreMes(fecha: string): string {
  const [a, m] = fecha.split('-').map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

/** dd/mm/aaaa */
export function formatoFecha(fecha: string): string {
  return fecha.split('-').reverse().join('/');
}

export function primerDiaMesSiguiente(fecha: string): string {
  const [a, m] = fecha.split('-').map(Number);
  return m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`;
}
