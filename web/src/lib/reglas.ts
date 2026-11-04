// Réplica de las reglas que se pueden revisar sin consultar la base, para avisar mientras se
// diligencia. La base vuelve a validar todo al guardar; sus mensajes son los que mandan.
import { diaDeSemana, mesesPermitidos, mismoMes, nombreMes, tipoDia } from './fechas';
import { formatoDuracion, formatoHoraAmPm, minutosEntre } from './horas';

export const NIVELES = [
  { valor: 68, nombre: '68 - Analista - Ejecutivo' },
  { valor: 73, nombre: '73 - Asistentes' },
  { valor: 78, nombre: '78 - Conductor' },
] as const;

export const CARGOS = [
  'Analista',
  'Analista de Cuenta',
  'Analista de informes',
  'Analista de operaciones',
  'Analista operativo',
  'Analista Técnico',
  'Asistente de cuenta',
  'Ejecutiva operativa',
] as const;

export const FILIALES = ['Banco', 'Sufi', 'Leasing', 'Empleados'] as const;

/** "angel francisco ramos CASTILLO" -> "Angel Francisco Ramos Castillo". */
export function nombrePropio(texto: string): string {
  return texto.toLocaleLowerCase('es')
    .replace(/(^|[\s'-])(\p{L})/gu, (_, antes: string, letra: string) => antes + letra.toLocaleUpperCase('es'));
}

export type Campo = 'identificacion' | 'nombre_completo' | 'cargo' | 'nivel' | 'filial'
  | 'fecha_horas_extras' | 'hora_inicio' | 'hora_final' | 'justificacion';

export type Errores = Partial<Record<Campo, string>>;

export interface DatosColega {
  identificacion: string;
  nombre_completo: string;
  cargo: string;
  nivel: number | null;
  filial: string;
  justificacion: string;
}

export interface DiaRegistro {
  fecha_horas_extras: string;
  hora_inicio: string;
  hora_final: string;
}

export type DatosRegistro = DatosColega & DiaRegistro;

export interface Reglas {
  hoy: string;
  festivos: Set<string>;
  finJornada: string;
  finJornadaViernes: string;
  topeDiarioMin: number;
  topeFinSemanaMin: number;
}

/** Hora en que termina la jornada ese día: los viernes es más temprano. */
export function finJornadaDe(fecha: string, reglas: Pick<Reglas, 'finJornada' | 'finJornadaViernes'>): string {
  return diaDeSemana(fecha) === 5 ? reglas.finJornadaViernes : reglas.finJornada;
}

/** Tope de horas extras de ese día: hábil o fin de semana/festivo. */
export function topeDelDia(fecha: string, reglas: Pick<Reglas, 'festivos' | 'topeDiarioMin' | 'topeFinSemanaMin'>): number {
  return tipoDia(fecha, reglas.festivos) === 'habil' ? reglas.topeDiarioMin : reglas.topeFinSemanaMin;
}

export function erroresLocales(datos: DatosRegistro, reglas: Reglas): Errores {
  return { ...erroresColega(datos), ...erroresDia(datos, reglas) };
}

export function erroresColega(datos: DatosColega): Errores {
  const errores: Errores = {};

  if (!/^[0-9A-Za-z]{3,20}$/.test(datos.identificacion.trim())) {
    errores.identificacion = 'Entre 3 y 20 letras o números, sin puntos ni espacios.';
  }
  if (!datos.nombre_completo.trim()) errores.nombre_completo = 'El nombre es obligatorio.';
  if (!datos.cargo.trim()) errores.cargo = 'Seleccione el cargo o escríbalo con "Otro".';
  if (!FILIALES.some((f) => f === datos.filial)) errores.filial = 'Seleccione la filial.';
  if (!NIVELES.some((n) => n.valor === datos.nivel)) {
    errores.nivel = 'Solo niveles 68, 73 o 78.';
  }
  if (!datos.justificacion.trim()) errores.justificacion = 'La justificación es obligatoria.';
  return errores;
}

export function erroresDia(datos: DiaRegistro, reglas: Reglas): Errores {
  const errores: Errores = {};

  if (!datos.fecha_horas_extras) {
    errores.fecha_horas_extras = 'La fecha es obligatoria.';
    return errores;
  }
  const [anterior, actual] = mesesPermitidos(reglas.hoy);
  if (!mismoMes(datos.fecha_horas_extras, anterior) && !mismoMes(datos.fecha_horas_extras, actual)) {
    errores.fecha_horas_extras = `La fecha debe ser de ${nombreMes(anterior)} o de ${nombreMes(actual)}.`;
  }

  if (!datos.hora_inicio || !datos.hora_final) {
    errores.hora_final = 'Seleccione la hora de inicio y la hora final.';
    return errores;
  }
  const minutos = minutosEntre(datos.hora_inicio, datos.hora_final);
  if (minutos <= 0) {
    errores.hora_final = 'La hora final debe ser posterior a la de inicio, sin pasar de la medianoche.';
    return errores;
  }

  if (tipoDia(datos.fecha_horas_extras, reglas.festivos) === 'habil') {
    const fin = finJornadaDe(datos.fecha_horas_extras, reglas);
    if (datos.hora_inicio !== fin) {
      errores.hora_inicio = `Ese día las horas extras empiezan a las ${formatoHoraAmPm(fin)}, sin pausas.`;
    }
    if (minutos > reglas.topeDiarioMin) {
      errores.hora_final = `Máximo ${formatoDuracion(reglas.topeDiarioMin)} horas en día hábil.`;
    }
  } else if (minutos > reglas.topeFinSemanaMin) {
    errores.hora_final = `Máximo ${formatoDuracion(reglas.topeFinSemanaMin)} horas en fin de semana o festivo.`;
  }
  return errores;
}
