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

export interface Configuracion {
  finJornada: string;
  topeDiarioMin: number;
  topeFinSemanaMin: number;
  topeSemanalMin: number;
}

export interface Festivo {
  fecha: string;
  nombre: string;
}
