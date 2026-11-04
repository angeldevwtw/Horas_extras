import { formatoFecha, sumarDias, tipoDia } from '../lib/fechas';
import { formatoDuracion, formatoHoraAmPm, horaDeMinutos, minutosEntre, opcionesDeHora } from '../lib/horas';
import type { DiaRegistro, Errores } from '../lib/reglas';
import { ListaDias } from './ListaDias';
import { Campo, claseEntrada } from './ui';

export interface HorarioSemana {
  /** Minutos por día; 0 si no se ha elegido. */
  duracion: number;
  /** Hora de inicio en fin de semana o festivo; los hábiles empiezan al terminar la jornada. */
  inicio: string;
  /** Jornada con horario especial (Sufi en día hábil). */
  inicioJornada: string;
  finalJornada: string;
}

const INICIOS = Array.from({ length: 47 }, (_, i) => horaDeMinutos(i * 30));
const HORAS = opcionesDeHora();

/** Los días elegidos de una semana (lunes a domingo), con su horario común y su subtotal. */
export function BloqueSemana({ lunes, dias, horario, duraciones, topeSemanalMin, usadosMin, festivos,
  finJornadaDe, finJornadaSufi, topeDe, esEspecial, minutosDe, errores, alCambiarHorario, alCambiarDia,
  alQuitar }: {
  lunes: string;
  dias: DiaRegistro[];
  horario: HorarioSemana;
  duraciones: number[];
  topeSemanalMin: number;
  usadosMin: number;
  festivos: Map<string, string>;
  finJornadaDe: (fecha: string) => string;
  finJornadaSufi: string;
  topeDe: (fecha: string) => number;
  esEspecial: (fecha: string) => boolean;
  minutosDe: (dia: DiaRegistro) => number;
  errores: Record<string, Errores>;
  alCambiarHorario: (horario: HorarioSemana) => void;
  alCambiarDia: (fecha: string, cambios: Partial<DiaRegistro>) => void;
  alQuitar: (fecha: string) => void;
}) {
  const fechasFestivas = new Set(festivos.keys());
  const hayEspeciales = dias.some((d) => tipoDia(d.fecha_horas_extras, fechasFestivas) !== 'habil');
  const hayJornada = dias.some((d) => esEspecial(d.fecha_horas_extras));
  const subtotal = dias.reduce((s, d) => s + minutosDe(d), 0);
  const finalesJornada = horario.inicioJornada
    ? HORAS.filter((h) => minutosEntre(horario.inicioJornada, h) > 0 && minutosEntre(finJornadaSufi, h) <= 0)
    : [];
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
        <Campo etiqueta={hayJornada ? 'Total de horas extras por día' : 'Horas por día'} htmlFor={`${id}-duracion`}
          ayuda="Se aplica a los días de esta semana.">
          <select id={`${id}-duracion`} value={horario.duracion || ''} className={claseEntrada}
            onChange={(e) => alCambiarHorario({ ...horario, duracion: Number(e.target.value) })}>
            <option value="">Seleccione…</option>
            {duraciones.map((m) => <option key={m} value={m}>{formatoDuracion(m)} horas</option>)}
          </select>
        </Campo>
        {hayJornada && (
          <>
            <Campo etiqueta="Inicio de la jornada" htmlFor={`${id}-inicio-jornada`}>
              <select id={`${id}-inicio-jornada`} value={horario.inicioJornada} className={claseEntrada}
                onChange={(e) => alCambiarHorario({ ...horario, inicioJornada: e.target.value,
                  finalJornada: minutosEntre(e.target.value, horario.finalJornada || '00:00') > 0 ? horario.finalJornada : '' })}>
                <option value="">Seleccione…</option>
                {INICIOS.filter((h) => minutosEntre(finJornadaSufi, h) < 0).map((h) => (
                  <option key={h} value={h}>{formatoHoraAmPm(h)}</option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Final de la jornada" htmlFor={`${id}-final-jornada`}
              ayuda={`Máximo ${formatoHoraAmPm(finJornadaSufi)}.`}>
              <select id={`${id}-final-jornada`} value={horario.finalJornada} className={claseEntrada}
                disabled={!horario.inicioJornada}
                onChange={(e) => alCambiarHorario({ ...horario, finalJornada: e.target.value })}>
                <option value="">Seleccione…</option>
                {finalesJornada.map((h) => <option key={h} value={h}>{formatoHoraAmPm(h)}</option>)}
              </select>
            </Campo>
          </>
        )}
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

      <ListaDias dias={dias} festivos={festivos} finJornadaDe={finJornadaDe} finJornadaSufi={finJornadaSufi}
        topeDe={topeDe} duraciones={duraciones} esEspecial={esEspecial} errores={errores}
        alCambiar={alCambiarDia} alQuitar={alQuitar} />
    </section>
  );
}
