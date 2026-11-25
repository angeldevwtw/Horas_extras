import { NOMBRE_TIPO_DIA, type TipoDia } from './fechas';
import type { RegistroAdmin } from './tipos';

export type EstadoVisible = 'pendiente' | 'aprobada' | 'negada' | 'anulada';

export const ESTADOS: { valor: EstadoVisible; nombre: string }[] = [
  { valor: 'pendiente', nombre: 'Pendiente' },
  { valor: 'aprobada', nombre: 'Aprobada' },
  { valor: 'negada', nombre: 'Negada' },
  { valor: 'anulada', nombre: 'Anulada' },
];

export const SIN_JEFE = 'Sin jefe';
export const SIN_COORDINADOR = 'Sin coordinador';

export const estadoVisible = (r: RegistroAdmin): EstadoVisible =>
  r.estado === 'registrada' ? r.aprobacion : r.estado;

/** Cada eje por el que se puede filtrar, con el valor que toma cada registro. */
export const DIMENSIONES = {
  filial: (r: RegistroAdmin) => r.filial,
  director: (r: RegistroAdmin) => r.director ?? SIN_JEFE,
  coordinador: (r: RegistroAdmin) => r.coordinador ?? (r.director ? SIN_COORDINADOR : SIN_JEFE),
  colega: (r: RegistroAdmin) => r.identificacion,
  tipoDia: (r: RegistroAdmin) => r.tipo_dia,
  nivel: (r: RegistroAdmin) => String(r.nivel),
  fecha: (r: RegistroAdmin) => r.fecha_horas_extras,
  estado: estadoVisible,
};

export type Dimension = keyof typeof DIMENSIONES;
export type Filtros = Partial<Record<Dimension, string[]>>;

export const NOMBRE_DIMENSION: Record<Dimension, string> = {
  filial: 'Filial',
  director: 'Director',
  coordinador: 'Coordinador',
  colega: 'Colega',
  tipoDia: 'Tipo de día',
  nivel: 'Nivel',
  fecha: 'Fecha',
  estado: 'Estado',
};

const coincideTexto = (r: RegistroAdmin, texto: string) =>
  [r.codigo, r.identificacion, r.nombre_completo, r.cargo, r.justificacion,
    r.motivo_anulacion ?? '', r.motivo_decision ?? '', r.decidido_por ?? '']
    .some((valor) => valor.toLowerCase().includes(texto));

/** Registros que cumplen todos los filtros; con `excepto`, ignora ese eje (para que su gráfica muestre las demás opciones). */
export function aplicarFiltros(registros: RegistroAdmin[], filtros: Filtros, texto = '', excepto?: Dimension) {
  const buscado = texto.trim().toLowerCase();
  const activos = (Object.entries(filtros) as [Dimension, string[]][])
    .filter(([dimension, valores]) => dimension !== excepto && valores.length);
  return registros.filter((r) =>
    activos.every(([dimension, valores]) => valores.includes(DIMENSIONES[dimension](r)))
    && (!buscado || coincideTexto(r, buscado)));
}

/** Para sumar horas: sin filtro de estado, solo lo vigente (anulado y negado no cuentan). */
export const paraHoras = (registros: RegistroAdmin[], filtros: Filtros) =>
  filtros.estado?.length ? registros : registros.filter((r) => r.estado === 'registrada');

/** Un clic elige el valor; otro clic sobre el mismo lo quita. */
export function alternar(filtros: Filtros, dimension: Dimension, valor: string, varios = false): Filtros {
  const actuales = filtros[dimension] ?? [];
  const siguientes = actuales.includes(valor)
    ? actuales.filter((v) => v !== valor)
    : varios ? [...actuales, valor] : [valor];
  return { ...filtros, [dimension]: siguientes };
}

export interface Opcion { valor: string; nombre: string; detalle?: string; registros: number }

/** Valores del eje con cuántos registros quedan con los demás filtros, ordenados por nombre. */
export function opcionesDe(registros: RegistroAdmin[], filtros: Filtros, texto: string, dimension: Dimension): Opcion[] {
  const conteo = new Map<string, Opcion>();
  for (const r of aplicarFiltros(registros, filtros, texto, dimension)) {
    const valor = DIMENSIONES[dimension](r);
    const opcion = conteo.get(valor) ?? { valor, ...nombreDe(dimension, valor, r), registros: 0 };
    opcion.registros += 1;
    conteo.set(valor, opcion);
  }
  for (const valor of filtros[dimension] ?? []) {
    if (!conteo.has(valor)) conteo.set(valor, { valor, ...nombreDe(dimension, valor), registros: 0 });
  }
  return [...conteo.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

function nombreDe(dimension: Dimension, valor: string, r?: RegistroAdmin): { nombre: string; detalle?: string } {
  if (dimension === 'colega') return { nombre: r?.nombre_completo ?? valor, detalle: valor };
  if (dimension === 'tipoDia') return { nombre: NOMBRE_TIPO_DIA[valor as TipoDia] ?? valor };
  if (dimension === 'nivel') return { nombre: `Nivel ${valor}` };
  if (dimension === 'estado') return { nombre: ESTADOS.find((e) => e.valor === valor)?.nombre ?? valor };
  return { nombre: valor };
}

/** Nombre legible de un valor ya elegido, para las etiquetas de filtros activos. */
export function etiquetaDe(registros: RegistroAdmin[], dimension: Dimension, valor: string) {
  const r = registros.find((x) => DIMENSIONES[dimension](x) === valor);
  return nombreDe(dimension, valor, r).nombre;
}
