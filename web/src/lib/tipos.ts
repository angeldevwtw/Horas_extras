import type { TipoDia } from './fechas';

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  es_admin: boolean;
  activo: boolean;
}

export interface Registro {
  id: number;
  codigo: string;
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
  motivo_anulacion: string | null;
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
