import { useState } from 'react';
import { diaDeSemana, diasDelMes, mesesPermitidos, mismoMes, nombreMes, tipoDia } from '../lib/fechas';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const TITULO_FIN_DE_SEMANA: Record<number, string> = {
  6: 'Sábado',
  0: 'Domingo: solo si el colega descansa el sábado',
};

/**
 * Mes anterior o mes en curso; cada clic marca o desmarca un día. Fines de semana y festivos van
 * resaltados; los días futuros y los que el colega ya tiene completos no se pueden marcar.
 */
export function CalendarioMes({ hoy, festivos, seleccionadas, llenos, alElegir }: {
  hoy: string;
  festivos: Map<string, string>;
  seleccionadas: Set<string>;
  /** Fecha → códigos de los registros que ya llenan ese día. */
  llenos: Map<string, string>;
  alElegir: (fecha: string) => void;
}) {
  const meses = mesesPermitidos(hoy);
  const [mes, setMes] = useState(meses[1]);
  const dias = diasDelMes(mes);
  const fechasFestivas = new Set(festivos.keys());
  // La semana empieza en lunes, como el tope semanal; diaDeSemana da 0 al domingo.
  const huecos = (diaDeSemana(dias[0]) + 6) % 7;
  const elegidasEn = (m: string) => [...seleccionadas].filter((f) => mismoMes(f, m)).length;

  return (
    <div>
      <div role="group" aria-label="Mes" className="mb-3 inline-flex rounded-lg bg-suave p-1">
        {meses.map((m) => (
          <button key={m} type="button" onClick={() => setMes(m)} aria-pressed={m === mes}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors first-letter:uppercase
              ${m === mes ? 'bg-primario text-blanco' : 'text-texto-suave hover:text-texto'}`}>
            {nombreMes(m)}
            {elegidasEn(m) > 0 && <span className="ml-1.5 font-normal opacity-80">({elegidasEn(m)})</span>}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {DIAS.map((d) => (
          <span key={d} className="pb-1 text-xs font-medium uppercase tracking-wide text-texto-suave">{d}</span>
        ))}
        {Array.from({ length: huecos }, (_, i) => <span key={`h${i}`} />)}
        {dias.map((fecha) => {
          const tipo = tipoDia(fecha, fechasFestivas);
          const elegida = seleccionadas.has(fecha);
          const lleno = llenos.get(fecha);
          const futuro = fecha > hoy;
          const bloqueado = futuro || (!!lleno && !elegida);
          const clase = elegida
            ? `font-semibold text-blanco ${lleno ? 'bg-error' : 'bg-primario'}`
            : futuro
              ? 'cursor-not-allowed text-texto-suave opacity-40'
              : lleno
                ? 'cursor-not-allowed bg-error-suave text-error line-through'
                : tipo === 'habil'
                  ? 'text-texto hover:bg-suave'
                  : 'bg-seleccion font-medium text-secundario hover:bg-suave';
          return (
            <button key={fecha} type="button" onClick={() => alElegir(fecha)} disabled={bloqueado}
              title={futuro ? 'Se registra después de trabajarlo'
                : lleno ? `Ya registrado (${lleno})`
                : festivos.get(fecha) ?? TITULO_FIN_DE_SEMANA[diaDeSemana(fecha)]}
              aria-pressed={elegida}
              className={`h-10 rounded-md text-sm transition-colors ${clase}
                ${fecha === hoy && !elegida ? 'ring-1 ring-inset ring-primario' : ''}`}>
              {Number(fecha.slice(8))}
            </button>
          );
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-texto-suave">
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-sm bg-seleccion" />
          Fin de semana o festivo: máximo 2:00 horas
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-sm bg-error-suave" />
          Ya registrado
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-sm ring-1 ring-inset ring-primario" />
          Hoy
        </li>
        <li>Sábado o domingo, no los dos</li>
        <li><span className="opacity-40">Días futuros</span>: se registran después de trabajarlos</li>
      </ul>
    </div>
  );
}
