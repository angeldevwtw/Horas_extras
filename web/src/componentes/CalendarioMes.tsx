import { diaDeSemana, diasDelMes, nombreMes, tipoDia } from '../lib/fechas';

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Solo muestra los días del mes en curso; fines de semana y festivos van resaltados. */
export function CalendarioMes({ hoy, festivos, seleccionada, alElegir }: {
  hoy: string;
  festivos: Map<string, string>;
  seleccionada: string;
  alElegir: (fecha: string) => void;
}) {
  const dias = diasDelMes(hoy);
  const fechasFestivas = new Set(festivos.keys());
  // La semana empieza en domingo, que es el 0 de diaDeSemana.
  const huecos = diaDeSemana(dias[0]);

  return (
    <div>
      <p className="mb-3 text-sm font-semibold first-letter:uppercase">{nombreMes(hoy)}</p>
      <div className="grid grid-cols-7 gap-1 text-center">
        {DIAS.map((d) => (
          <span key={d} className="pb-1 text-xs font-medium uppercase tracking-wide text-texto-suave">{d}</span>
        ))}
        {Array.from({ length: huecos }, (_, i) => <span key={`h${i}`} />)}
        {dias.map((fecha) => {
          const tipo = tipoDia(fecha, fechasFestivas);
          const elegida = fecha === seleccionada;
          const esDomingo = diaDeSemana(fecha) === 0;
          const clase = elegida
            ? 'bg-primario font-semibold text-blanco'
            : esDomingo
              ? 'cursor-not-allowed text-texto-suave line-through'
              : tipo === 'habil'
                ? 'text-texto hover:bg-suave'
                : 'bg-seleccion font-medium text-secundario hover:bg-suave';
          return (
            <button key={fecha} type="button" onClick={() => alElegir(fecha)} disabled={esDomingo}
              title={esDomingo ? 'Domingo: no se registran horas extras'
                : festivos.get(fecha) ?? (tipo === 'habil' ? undefined : 'Sábado')}
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
          Sábado o festivo: máximo 2:00 horas
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-sm ring-1 ring-inset ring-primario" />
          Hoy
        </li>
        <li><span className="line-through">Dom</span>: no se registran horas extras</li>
      </ul>
    </div>
  );
}
