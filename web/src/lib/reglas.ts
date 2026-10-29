// Réplica de las reglas que se pueden revisar sin consultar la base, para avisar mientras se
// diligencia. La base vuelve a validar todo al guardar; sus mensajes son los que mandan.
import { mismoMes, nombreMes, tipoDia } from './fechas';
import { formatoDuracion, formatoHoraAmPm, minutosEntre } from './horas';

export const NIVELES = [
  { valor: 68, nombre: '68 - Analista - Ejecutivo' },
  { valor: 73, nombre: '73 - Asistentes' },
  { valor: 78, nombre: '78 - Conductor' },
] as const;

export type Campo = 'identificacion' | 'nombre_completo' | 'cargo' | 'nivel' | 'filial'
  | 'fecha_horas_extras' | 'hora_inicio' | 'hora_final' | 'justificacion';

export type Errores = Partial<Record<Campo, string>>;

export interface DatosRegistro {
  identificacion: string;
  nombre_completo: string;
  cargo: string;
  nivel: number | null;
  filial: string;
  fecha_horas_extras: string;
  hora_inicio: string;
  hora_final: string;
  justificacion: string;
}

export interface Reglas {
  hoy: string;
  festivos: Set<string>;
  finJornada: string;
  topeDiarioMin: number;
  topeFinSemanaMin: number;
}

export function erroresLocales(datos: DatosRegistro, reglas: Reglas): Errores {
  const errores: Errores = {};

  if (!/^[0-9A-Za-z]{3,20}$/.test(datos.identificacion.trim())) {
    errores.identificacion = 'Entre 3 y 20 letras o números, sin puntos ni espacios.';
  }
  if (!datos.nombre_completo.trim()) errores.nombre_completo = 'El nombre es obligatorio.';
  if (!datos.cargo.trim()) errores.cargo = 'El cargo es obligatorio.';
  if (!datos.filial.trim()) errores.filial = 'La filial es obligatoria.';
  if (!NIVELES.some((n) => n.valor === datos.nivel)) {
    errores.nivel = 'Solo niveles 68, 73 o 78.';
  }
  if (!datos.justificacion.trim()) errores.justificacion = 'La justificación es obligatoria.';

  if (!datos.fecha_horas_extras) {
    errores.fecha_horas_extras = 'La fecha es obligatoria.';
    return errores;
  }
  if (!mismoMes(datos.fecha_horas_extras, reglas.hoy)) {
    errores.fecha_horas_extras = `La fecha debe ser del mes en curso (${nombreMes(reglas.hoy)}).`;
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
    if (datos.hora_inicio !== reglas.finJornada) {
      errores.hora_inicio = `En día hábil las horas extras empiezan a las ${formatoHoraAmPm(reglas.finJornada)}, sin pausas.`;
    }
    if (minutos > reglas.topeDiarioMin) {
      errores.hora_final = `Máximo ${formatoDuracion(reglas.topeDiarioMin)} horas en día hábil.`;
    }
  } else if (minutos > reglas.topeFinSemanaMin) {
    errores.hora_final = `Máximo ${formatoDuracion(reglas.topeFinSemanaMin)} horas en sábado, domingo o festivo.`;
  }
  return errores;
}
