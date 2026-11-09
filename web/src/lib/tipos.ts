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
  estado: Estado;
  aprobacion: Aprobacion;
}

export type Estado = 'registrada' | 'anulada' | 'negada';
export type Aprobacion = 'pendiente' | 'aprobada' | 'negada';
export type RolJefe = 'director' | 'coordinador';

/** Opción de los desplegables del formulario. */
export interface JefeOpcion {
  id: string;
  nombre: string;
  rol: RolJefe;
  director: string | null;
  filial: string | null;
}

/** Fila de la lista de jefes en la administración. */
export interface JefeAdmin {
  id: string;
  nombre: string;
  correo: string;
  rol: RolJefe;
  director_id: string | null;
  filial: string | null;
  activo: boolean;
  tiene_cuenta: boolean;
}

/** Lo que necesita una fila del Excel; la descarga consolidada no trae id ni clave. */
export type FilaFormato = Pick<Registro, 'identificacion' | 'nombre_completo' | 'cargo' | 'nivel'
  | 'filial' | 'fecha_horas_extras' | 'hora_inicio' | 'hora_final' | 'minutos_totales'
  | 'justificacion'>;

/** Fila de administración y de "Mi equipo": incluye los anulados y los negados. */
export type RegistroAdmin = FilaFormato & Pick<Registro, 'codigo' | 'tipo_dia' | 'estado' | 'aprobacion'> & {
  motivo_anulacion: string | null;
  motivo_decision: string | null;
  coordinador: string | null;
  director: string | null;
  decidido_por: string | null;
};

export interface Configuracion {
  finJornada: string;
  finJornadaViernes: string;
  finJornadaSufi: string;
  topeDiarioMin: number;
  topeFinSemanaMin: number;
  topeSemanalMin: number;
}

export interface Festivo {
  fecha: string;
  nombre: string;
}
