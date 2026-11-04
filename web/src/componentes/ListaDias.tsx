import { diaDeSemana, formatoFecha, NOMBRE_TIPO_DIA, tipoDia } from '../lib/fechas';
import { formatoDuracion, formatoHoraAmPm, minutosEntre, opcionesDeHora } from '../lib/horas';
import type { DiaRegistro, Errores } from '../lib/reglas';
import { claseEntrada } from './ui';

const HORAS = opcionesDeHora();
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Un renglón por día elegido; en día hábil la hora de inicio es fija, en sábado o festivo se elige. */
export function ListaDias({ dias, festivos, finJornadaDe, topeDe, errores, alCambiar, alQuitar }: {
  dias: DiaRegistro[];
  festivos: Map<string, string>;
  finJornadaDe: (fecha: string) => string;
  topeDe: (fecha: string) => number;
  errores: Record<string, Errores>;
  alCambiar: (fecha: string, cambios: Partial<DiaRegistro>) => void;
  alQuitar: (fecha: string) => void;
}) {
  const fechasFestivas = new Set(festivos.keys());

  return (
    <ul className="divide-y divide-borde rounded-lg border border-borde bg-blanco">
      {dias.map((dia) => {
        const fecha = dia.fecha_horas_extras;
        const tipo = tipoDia(fecha, fechasFestivas);
        const habil = tipo === 'habil';
        const tope = topeDe(fecha);
        const minutos = dia.hora_inicio && dia.hora_final ? Math.max(0, minutosEntre(dia.hora_inicio, dia.hora_final)) : 0;
        const opcionesFinal = dia.hora_inicio
          ? HORAS.filter((h) => minutosEntre(dia.hora_inicio, h) > 0 && minutosEntre(dia.hora_inicio, h) <= tope)
          : [];
        const e = errores[fecha] ?? {};
        const mensaje = e.fecha_horas_extras ?? e.hora_inicio ?? e.hora_final;
        const etiqueta = `${DIAS[diaDeSemana(fecha)]} ${formatoFecha(fecha).slice(0, 5)}`;

        return (
          <li key={fecha} className={`grid gap-2 px-3 py-2.5 ${mensaje ? 'bg-error-suave' : ''}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="w-28 shrink-0">
                <p className="text-sm font-semibold">{etiqueta}</p>
                <p className="text-xs text-texto-suave">{festivos.get(fecha) ?? NOMBRE_TIPO_DIA[tipo]}</p>
              </div>
              <div className="flex flex-1 items-center gap-2">
                {habil ? (
                  <span className="w-28 text-sm" title="Día hábil: inicia al terminar la jornada">
                    {formatoHoraAmPm(finJornadaDe(fecha))}
                  </span>
                ) : (
                  <select aria-label={`Hora de inicio ${etiqueta}`} value={dia.hora_inicio}
                    onChange={(ev) => alCambiar(fecha, { hora_inicio: ev.target.value })}
                    className={`${claseEntrada} w-28 py-1.5`}>
                    <option value="">Inicio…</option>
                    {HORAS.slice(0, -1).map((h) => <option key={h} value={h}>{formatoHoraAmPm(h)}</option>)}
                  </select>
                )}
                <span aria-hidden className="text-texto-suave">→</span>
                <select aria-label={`Hora final ${etiqueta}`} value={dia.hora_final} disabled={!dia.hora_inicio}
                  onChange={(ev) => alCambiar(fecha, { hora_final: ev.target.value })}
                  className={`${claseEntrada} w-28 py-1.5`}>
                  <option value="">Final…</option>
                  {opcionesFinal.map((h) => <option key={h} value={h}>{formatoHoraAmPm(h)}</option>)}
                </select>
                <span className="ml-auto text-sm font-semibold text-primario">
                  {minutos > 0 ? formatoDuracion(minutos) : '—'}
                </span>
              </div>
              <button type="button" onClick={() => alQuitar(fecha)} aria-label={`Quitar ${etiqueta}`}
                className="grid size-7 place-items-center rounded-md text-texto-suave hover:bg-suave hover:text-texto">
                ×
              </button>
            </div>
            {mensaje && <p role="alert" className="text-sm text-error">{mensaje}</p>}
          </li>
        );
      })}
    </ul>
  );
}
