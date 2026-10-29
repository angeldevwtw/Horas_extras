import type { TipoDia } from './fechas';

/** Lo que devuelve registrar_horas, más el estado que se lleva en esta ventana. */
export interface Registro {
  id: number;
  codigo: string;
  clave_anulacion: string;
  identificacion: string;
  nombre_completo: string;
  cargo: string;
  nivel: number;
  filial: string;
  fecha_horas_extras: string;
  hora_inicio: string;
  hora_final: string;
  minutos_totales: number;
  tipo_dia: TipoDia;
  justificacion: string;
  estado: 'registrada' | 'anulada';
}

/** Lo que necesita una fila del Excel; la descarga consolidada no trae id ni clave. */
export type FilaFormato = Pick<Registro, 'identificacion' | 'nombre_completo' | 'cargo' | 'nivel'
  | 'filial' | 'fecha_horas_extras' | 'hora_inicio' | 'hora_final' | 'minutos_totales'
  | 'justificacion'>;

export interface Configuracion {
  finJornada: string;
  finJornadaViernes: string;
  topeDiarioMin: number;
  topeFinSemanaMin: number;
  topeSemanalMin: number;
}

export interface Festivo {
  fecha: string;
  nombre: string;
}
