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
      <p className="mb-2 text-sm font-semibold first-letter:uppercase">{nombreMes(hoy)}</p>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {DIAS.map((d) => <span key={d} className="py-1 font-semibold text-texto-suave">{d}</span>)}
        {Array.from({ length: huecos }, (_, i) => <span key={`h${i}`} />)}
        {dias.map((fecha) => {
          const tipo = tipoDia(fecha, fechasFestivas);
          const elegida = fecha === seleccionada;
          const clase = elegida
            ? 'bg-primario text-blanco'
            : tipo === 'habil'
              ? 'bg-blanco hover:bg-suave'
              : 'bg-seleccion text-secundario hover:bg-suave';
          return (
            <button key={fecha} type="button" onClick={() => alElegir(fecha)}
              title={festivos.get(fecha) ?? (tipo === 'habil' ? undefined : 'Fin de semana')}
              aria-pressed={elegida}
              className={`rounded-md border border-borde py-2 text-sm ${clase}
                ${fecha === hoy && !elegida ? 'font-bold underline' : ''}`}>
              {Number(fecha.slice(8))}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-texto-suave">
        Resaltados: sábados, domingos y festivos (máximo 2:00 horas).
      </p>
    </div>
  );
}
