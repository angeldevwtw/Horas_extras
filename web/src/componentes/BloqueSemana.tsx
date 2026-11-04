import { formatoFecha, sumarDias, tipoDia } from '../lib/fechas';
import { formatoDuracion, formatoHoraAmPm, horaDeMinutos, minutosEntre } from '../lib/horas';
import type { DiaRegistro, Errores } from '../lib/reglas';
import { ListaDias } from './ListaDias';
import { Campo, claseEntrada } from './ui';

export interface HorarioSemana {
  /** Minutos por día; 0 si no se ha elegido. */
  duracion: number;
  /** Hora de inicio en fin de semana o festivo; los hábiles empiezan al terminar la jornada. */
  inicio: string;
}

const INICIOS = Array.from({ length: 47 }, (_, i) => horaDeMinutos(i * 30));

/** Los días elegidos de una semana (lunes a domingo), con su horario común y su subtotal. */
export function BloqueSemana({ lunes, dias, horario, duraciones, topeSemanalMin, usadosMin, festivos,
  finJornadaDe, topeDe, errores, alCambiarHorario, alCambiarDia, alQuitar }: {
  lunes: string;
  dias: DiaRegistro[];
  horario: HorarioSemana;
  duraciones: number[];
  topeSemanalMin: number;
  usadosMin: number;
  festivos: Map<string, string>;
  finJornadaDe: (fecha: string) => string;
  topeDe: (fecha: string) => number;
  errores: Record<string, Errores>;
  alCambiarHorario: (horario: HorarioSemana) => void;
  alCambiarDia: (fecha: string, cambios: Partial<DiaRegistro>) => void;
  alQuitar: (fecha: string) => void;
}) {
  const fechasFestivas = new Set(festivos.keys());
  const hayEspeciales = dias.some((d) => tipoDia(d.fecha_horas_extras, fechasFestivas) !== 'habil');
  const subtotal = dias.reduce((s, d) =>
    s + (d.hora_inicio && d.hora_final ? Math.max(0, minutosEntre(d.hora_inicio, d.hora_final)) : 0), 0);
  const pasaTope = usadosMin + subtotal > topeSemanalMin;
  const id = `semana-${lunes}`;

  return (
    <section aria-labelledby={id} className="grid gap-3 rounded-lg border border-borde bg-fondo/40 p-3 sm:p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={id} className="text-sm font-semibold">
          Semana {formatoFecha(lunes).slice(0, 5)} – {formatoFecha(sumarDias(lunes, 6)).slice(0, 5)}
          <span className="ml-2 font-normal text-texto-suave">
            {dias.length === 1 ? '1 día' : `${dias.length} días`}
          </span>
        </h3>
        <p className={`text-sm ${pasaTope ? 'font-semibold text-error' : 'text-texto-suave'}`}>
          <span className="font-semibold text-primario">{formatoDuracion(subtotal)}</span> horas
          {usadosMin > 0 && <> · ya tenía {formatoDuracion(usadosMin)}</>}
          {' '}· máximo {formatoDuracion(topeSemanalMin)}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Horas por día" htmlFor={`${id}-duracion`}
          ayuda="Se aplica a los días de esta semana.">
          <select id={`${id}-duracion`} value={horario.duracion || ''} className={claseEntrada}
            onChange={(e) => alCambiarHorario({ ...horario, duracion: Number(e.target.value) })}>
            <option value="">Seleccione…</option>
            {duraciones.map((m) => <option key={m} value={m}>{formatoDuracion(m)} horas</option>)}
          </select>
        </Campo>
        {hayEspeciales && (
          <Campo etiqueta="Inicio en fin de semana o festivo" htmlFor={`${id}-inicio`}>
            <select id={`${id}-inicio`} value={horario.inicio} className={claseEntrada}
              onChange={(e) => alCambiarHorario({ ...horario, inicio: e.target.value })}>
              <option value="">Seleccione…</option>
              {INICIOS.map((h) => <option key={h} value={h}>{formatoHoraAmPm(h)}</option>)}
            </select>
          </Campo>
        )}
      </div>

      <ListaDias dias={dias} festivos={festivos} finJornadaDe={finJornadaDe} topeDe={topeDe}
        errores={errores} alCambiar={alCambiarDia} alQuitar={alQuitar} />
    </section>
  );
}
