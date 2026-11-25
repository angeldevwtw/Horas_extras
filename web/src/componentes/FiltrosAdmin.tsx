import {
  alternar, type Dimension, ESTADOS, etiquetaDe, type Filtros, NOMBRE_DIMENSION, opcionesDe,
} from '../lib/filtrosAdmin';
import type { RegistroAdmin } from '../lib/tipos';
import { Boton, claseEntrada } from './ui';

const DESPLEGABLES: Dimension[] = ['filial', 'director', 'coordinador', 'colega', 'tipoDia', 'nivel'];

const COLOR_ESTADO = {
  pendiente: 'bg-alerta',
  aprobada: 'bg-estado-registrada',
  negada: 'bg-error',
  anulada: 'bg-estado-anulada',
};

/** Barra de filtros: lo que se elige aquí o con un clic en una gráfica filtra todo el panel. */
export function FiltrosAdmin({ registros, filtros, texto, alCambiar, alBuscar }: {
  registros: RegistroAdmin[];
  filtros: Filtros;
  texto: string;
  alCambiar: (filtros: Filtros) => void;
  alBuscar: (texto: string) => void;
}) {
  const activos = (Object.entries(filtros) as [Dimension, string[]][])
    .flatMap(([dimension, valores]) => valores.map((valor) => ({ dimension, valor })));
  const conteoEstado = new Map(opcionesDe(registros, filtros, texto, 'estado').map((o) => [o.valor, o.registros]));

  return (
    <section aria-label="Filtros" className="grid gap-4 rounded-xl border border-borde bg-superficie p-5 shadow-xs">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-texto-suave">Buscar</span>
          <input type="search" value={texto} onChange={(e) => alBuscar(e.target.value)}
            placeholder="Código, cédula, nombre, cargo, justificación o motivo" className={claseEntrada} />
        </label>
        {DESPLEGABLES.map((dimension) => (
          <Desplegable key={dimension} dimension={dimension} registros={registros} filtros={filtros} texto={texto}
            alElegir={(valor) => alCambiar({ ...filtros, [dimension]: valor ? [valor] : [] })} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-medium uppercase tracking-wide text-texto-suave">Estado</span>
        {ESTADOS.map(({ valor, nombre }) => {
          const elegido = filtros.estado?.includes(valor) ?? false;
          return (
            <button key={valor} type="button" aria-pressed={elegido}
              onClick={() => alCambiar(alternar(filtros, 'estado', valor, true))}
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors
                ${elegido ? 'border-primario bg-seleccion font-semibold text-primario' : 'border-borde bg-superficie hover:bg-suave'}`}>
              <span aria-hidden className={`size-2.5 rounded-full ${COLOR_ESTADO[valor]}`} />
              {nombre}
              <span className="text-xs text-texto-suave">{conteoEstado.get(valor) ?? 0}</span>
            </button>
          );
        })}
      </div>

      {(activos.length > 0 || texto) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-borde pt-4">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-texto-suave">Filtrando por</span>
          {activos.map(({ dimension, valor }) => (
            <button key={`${dimension}-${valor}`} type="button"
              onClick={() => alCambiar(alternar(filtros, dimension, valor, true))}
              aria-label={`Quitar filtro ${NOMBRE_DIMENSION[dimension]}: ${etiquetaDe(registros, dimension, valor)}`}
              className="flex items-center gap-1.5 rounded-full bg-suave px-3 py-1 text-sm text-primario hover:bg-seleccion">
              <span className="text-texto-suave">{NOMBRE_DIMENSION[dimension]}:</span>
              <span className="font-medium">{etiquetaDe(registros, dimension, valor)}</span>
              <span aria-hidden className="ml-0.5 text-base leading-none">×</span>
            </button>
          ))}
          {texto && (
            <button type="button" onClick={() => alBuscar('')}
              className="flex items-center gap-1.5 rounded-full bg-suave px-3 py-1 text-sm text-primario hover:bg-seleccion">
              <span className="text-texto-suave">Texto:</span>
              <span className="font-medium">“{texto}”</span>
              <span aria-hidden className="ml-0.5 text-base leading-none">×</span>
            </button>
          )}
          <Boton variante="borde" className="ml-auto px-3 py-1" onClick={() => { alCambiar({}); alBuscar(''); }}>
            Limpiar filtros
          </Boton>
        </div>
      )}
    </section>
  );
}

function Desplegable({ dimension, registros, filtros, texto, alElegir }: {
  dimension: Dimension;
  registros: RegistroAdmin[];
  filtros: Filtros;
  texto: string;
  alElegir: (valor: string) => void;
}) {
  const id = `filtro-${dimension}`;
  const opciones = opcionesDe(registros, filtros, texto, dimension);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium uppercase tracking-wide text-texto-suave">
        {NOMBRE_DIMENSION[dimension]}
      </label>
      <select id={id} value={filtros[dimension]?.[0] ?? ''} onChange={(e) => alElegir(e.target.value)}
        className={claseEntrada}>
        <option value="">Todos</option>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.nombre}{o.detalle ? ` · ${o.detalle}` : ''} ({o.registros})
          </option>
        ))}
      </select>
    </div>
  );
}
