import type { ReactNode } from 'react';
import { diaDeSemana, diasDelMes, formatoFecha } from '../lib/fechas';
import { formatoHorasDecimal, formatoTotalHoras } from '../lib/horas';
import { ESTADOS, type EstadoVisible, estadoVisible } from '../lib/filtrosAdmin';
import { FILIALES } from '../lib/reglas';
import type { RegistroAdmin } from '../lib/tipos';

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const registrosTexto = (n: number) => `${n} ${n === 1 ? 'registro' : 'registros'}`;

/** Recuadro que aparece al pasar el mouse o al enfocar la barra con el teclado. */
function Detalle({ children }: { children: ReactNode }) {
  return (
    <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2
      -translate-x-1/2 whitespace-nowrap rounded-md bg-texto px-2.5 py-1.5 text-xs text-fondo opacity-0
      shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
      {children}
    </span>
  );
}

function sumarPor(registros: RegistroAdmin[], clave: (r: RegistroAdmin) => string) {
  const totales = new Map<string, { minutos: number; registros: number }>();
  for (const r of registros) {
    const total = totales.get(clave(r)) ?? { minutos: 0, registros: 0 };
    total.minutos += r.minutos_totales;
    total.registros += 1;
    totales.set(clave(r), total);
  }
  return totales;
}

const ALTO_MINIMO_PX = 224;
const ALTO_MAXIMO_PX = 480;
const PX_POR_HORA = 12;
const SEPARACION_MINIMA_PX = 28;

/** Alto de la gráfica y líneas del eje según el día con más horas, para que las etiquetas no se amontonen. */
function escalaDelEje(minutosPico: number) {
  // Margen sobre el pico para que el valor quepa encima de la barra; el eje muestra al menos 2 horas.
  const horas = Math.max(2, (minutosPico * 1.08) / 60);
  const alto = Math.min(ALTO_MAXIMO_PX, Math.max(ALTO_MINIMO_PX, horas * PX_POR_HORA));
  const paso = [1, 2, 5, 10, 20, 50].find((p) => (p / horas) * alto >= SEPARACION_MINIMA_PX) ?? 100;
  const techoHoras = Math.ceil(horas / paso) * paso;
  const lineas = Array.from({ length: techoHoras / paso + 1 }, (_, i) => (techoHoras - i * paso) * 60);
  return { alto, techo: techoHoras * 60, lineas };
}

/** Horas de cada día del mes, con fines de semana y festivos sombreados y el valor encima de cada barra. */
export function HorasPorDia({ registros, mes, festivos, elegidos = [], alElegir }: {
  registros: RegistroAdmin[];
  mes: string;
  festivos: Set<string>;
  elegidos?: string[];
  alElegir?: (fecha: string) => void;
}) {
  const porDia = sumarPor(registros, (r) => r.fecha_horas_extras);
  const dias = diasDelMes(`${mes}-01`);
  const conHoras = [...porDia.entries()].filter(([fecha]) => fecha.startsWith(mes));
  const totalMes = conHoras.reduce((suma, [, t]) => suma + t.minutos, 0);
  const pico = conHoras.reduce<[string, { minutos: number }] | null>(
    (mayor, actual) => (!mayor || actual[1].minutos > mayor[1].minutos ? actual : mayor), null);
  const { alto, techo, lineas } = escalaDelEje(pico?.[1].minutos ?? 0);

  const datos = [
    ['Día con más horas', pico ? `${nombreCorto(pico[0])} · ${formatoHorasDecimal(pico[1].minutos)} h` : '—'],
    ['Días con horas extras', `${conHoras.length} de ${dias.length}`],
    ['Promedio por día con horas', conHoras.length ? `${formatoHorasDecimal(Math.round(totalMes / conHoras.length))} h` : '—'],
  ];

  return (
    <figure className="grid gap-5">
      <figcaption className="sr-only">Horas extras por día del mes</figcaption>
      <dl className="grid gap-3 sm:grid-cols-3">
        {datos.map(([nombre, valor]) => (
          <div key={nombre} className="rounded-lg bg-fondo px-4 py-3">
            <dt className="text-xs text-texto-suave">{nombre}</dt>
            <dd className="mt-0.5 text-base font-semibold">{valor}</dd>
          </div>
        ))}
      </dl>

      {/* En el celular los días no caben: la gráfica se desliza de lado. El pt deja sitio al detalle. */}
      <div className="-mt-10 overflow-x-auto pt-10">
        <div className="min-w-[40rem]">
          <div className="flex gap-2">
            <div aria-hidden style={{ height: alto }}
              className="flex w-9 shrink-0 flex-col justify-between text-right text-xs text-texto-suave">
              {lineas.map((m) => <span key={m} className="-my-2 leading-4">{formatoHorasDecimal(m)}</span>)}
            </div>
            <div className="relative flex-1" style={{ height: alto }}>
              <div aria-hidden className="absolute inset-0 flex flex-col justify-between">
                {lineas.map((m) => <div key={m} className={`border-t ${m ? 'border-dashed' : ''} border-borde`} />)}
              </div>
              <div className="relative flex h-full items-end gap-0.5">
                {dias.map((fecha) => {
                  const total = porDia.get(fecha);
                  const especial = diaDeSemana(fecha) % 6 === 0 || festivos.has(fecha);
                  const elegido = elegidos.includes(fecha);
                  const apagado = elegidos.length > 0 && !elegido;
                  return (
                    <button key={fecha} type="button" disabled={!total || !alElegir} aria-pressed={elegido}
                      onClick={() => alElegir?.(fecha)}
                      aria-label={total ? `${nombreCorto(fecha)}: ${formatoTotalHoras(total.minutos)}` : nombreCorto(fecha)}
                      className={`group relative flex h-full flex-1 flex-col items-center justify-end rounded-t-sm
                        enabled:cursor-pointer ${especial ? 'bg-seleccion' : ''}`}>
                      {total && (
                        <>
                          <span className={`mb-1 text-[11px] font-semibold leading-none ${apagado ? 'text-texto-suave' : ''}`}>
                            {formatoHorasDecimal(total.minutos)}
                          </span>
                          <div className={`w-full max-w-6 rounded-t transition-opacity group-hover:bg-secundario
                            ${elegido ? 'bg-secundario' : 'bg-primario'} ${apagado ? 'opacity-30' : ''}`}
                            style={{ height: `${(total.minutos / techo) * 100}%` }} />
                          <Detalle>
                            <strong>{nombreCorto(fecha)}</strong> · {formatoHorasDecimal(total.minutos)} h
                            · {registrosTexto(total.registros)}
                          </Detalle>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div aria-hidden className="mt-1.5 flex gap-2">
            <span className="w-9 shrink-0" />
            <div className="flex flex-1 gap-0.5 text-center text-[11px] leading-tight text-texto-suave">
              {dias.map((fecha) => {
                return (
                  <span key={fecha} className="flex-1">
                    <span className="block font-medium text-texto">{Number(fecha.slice(8))}</span>
                    {DIAS[diaDeSemana(fecha)][0]}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-texto-suave">
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-sm bg-primario" />Horas extras del día
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-sm bg-seleccion ring-1 ring-inset ring-borde" />Fin de semana o festivo
        </li>
      </ul>
    </figure>
  );
}

const nombreCorto = (fecha: string) => `${DIAS[diaDeSemana(fecha)]} ${formatoFecha(fecha).slice(0, 5)}`;

interface Fila { clave: string; nombre: string; detalle?: string; minutos: number; registros: number; color?: string }

const SinDatos = () => (
  <p className="rounded-lg border border-dashed border-borde py-8 text-center text-sm text-texto-suave">
    Sin horas con estos filtros.
  </p>
);

const porcentaje = (parte: number, total: number) => (total ? Math.round((parte / total) * 100) : 0);

/** Frase destacada sobre la gráfica, con la cifra en morado. */
function Titular({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-fondo px-4 py-3 text-sm">{children}</p>;
}

/** Barras frente al mayor; el porcentaje es sobre el total del mes, aunque se muestren solo algunas. */
function BarrasHorizontales({ titulo, filas, total, conPosicion = false, elegidos = [], alElegir }: {
  titulo: string;
  filas: Fila[];
  total: number;
  conPosicion?: boolean;
  elegidos?: string[];
  alElegir?: (clave: string) => void;
}) {
  const mayor = Math.max(1, ...filas.map((f) => f.minutos));
  if (!filas.length) return <SinDatos />;
  return (
    <figure>
      <figcaption className="sr-only">{titulo}</figcaption>
      <ol className="grid gap-4">
        {filas.map((f, i) => (
          <li key={f.clave}>
          <button type="button" disabled={!alElegir} aria-pressed={elegidos.includes(f.clave)}
            onClick={() => alElegir?.(f.clave)}
            className={`group relative flex w-full items-center gap-3 rounded-md text-left outline-offset-4
              transition-opacity enabled:cursor-pointer
              ${elegidos.length && !elegidos.includes(f.clave) ? 'opacity-40 hover:opacity-80' : ''}`}>
            {conPosicion && (
              <span aria-hidden className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold
                ${i === 0 ? 'bg-primario text-sobre-color' : 'bg-suave text-primario'}`}>{i + 1}</span>
            )}
            <div className="grid min-w-0 flex-1 gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-medium">
                  {f.nombre}
                  {f.detalle && <span className="ml-1.5 text-xs font-normal text-texto-suave">{f.detalle}</span>}
                </span>
                <span className="shrink-0 text-sm">
                  <span className="font-semibold">{formatoHorasDecimal(f.minutos)} h</span>
                  <span className="ml-1.5 text-xs text-texto-suave">{porcentaje(f.minutos, total)} %</span>
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-fondo">
                <div className={`h-full rounded-full transition-[width] group-hover:bg-secundario
                  ${elegidos.includes(f.clave) ? 'bg-secundario' : f.color ?? 'bg-primario'}`}
                  style={{ width: `${(f.minutos / mayor) * 100}%` }} />
              </div>
              <span className="text-xs text-texto-suave">{registrosTexto(f.registros)}</span>
            </div>
            <Detalle>
              <strong>{f.nombre}</strong> · {formatoHorasDecimal(f.minutos)} h · {porcentaje(f.minutos, total)} % del total
              {alElegir && ' · clic para filtrar'}
            </Detalle>
          </button>
          </li>
        ))}
      </ol>
    </figure>
  );
}

interface Interactiva {
  registros: RegistroAdmin[];
  elegidos?: string[];
  alElegir?: (clave: string) => void;
}

const totalDe = (registros: RegistroAdmin[]) => registros.reduce((suma, r) => suma + r.minutos_totales, 0);
const colegasTexto = (n: number) => `${n} ${n === 1 ? 'colega' : 'colegas'}`;

export function HorasPorFilial({ registros, elegidos, alElegir }: Interactiva) {
  const porFilial = sumarPor(registros, (r) => r.filial);
  const colegas = (filial: string) => new Set(
    registros.filter((r) => r.filial === filial).map((r) => r.identificacion)).size;
  const filas = FILIALES.map((filial) => ({
    clave: filial, nombre: filial, detalle: colegasTexto(colegas(filial)),
    ...(porFilial.get(filial) ?? { minutos: 0, registros: 0 }),
  })).sort((a, b) => b.minutos - a.minutos);
  const total = totalDe(registros);
  if (!total) return <SinDatos />;
  return (
    <div className="grid gap-5">
      <Titular>
        <strong>{filas[0].nombre}</strong> concentra el{' '}
        <strong className="text-primario">{porcentaje(filas[0].minutos, total)} %</strong> de las horas extras.
      </Titular>
      <BarrasHorizontales titulo="Horas extras por filial" filas={filas} total={total}
        elegidos={elegidos} alElegir={alElegir} />
    </div>
  );
}

export function ColegasConMasHoras({ registros, elegidos, alElegir, cuantos = 8 }: Interactiva & { cuantos?: number }) {
  const porColega = sumarPor(registros, (r) => r.identificacion);
  const datos = new Map(registros.map((r) => [r.identificacion, r]));
  const filas = [...porColega.entries()]
    .map(([cedula, total]) => ({
      clave: cedula,
      nombre: datos.get(cedula)?.nombre_completo ?? cedula,
      detalle: `${cedula} · ${datos.get(cedula)?.filial}`,
      ...total,
    }))
    .sort((a, b) => b.minutos - a.minutos)
    .slice(0, cuantos);
  if (!filas.length) return <SinDatos />;
  return (
    <div className="grid gap-5">
      <Titular>
        <strong>{filas[0].nombre}</strong> lleva más horas:{' '}
        <strong className="text-primario">{formatoHorasDecimal(filas[0].minutos)} h</strong>.
      </Titular>
      <BarrasHorizontales titulo="Colegas con más horas extras" filas={filas} conPosicion
        total={totalDe(registros)} elegidos={elegidos} alElegir={alElegir} />
    </div>
  );
}

/** Horas por director (o por coordinador): cuánto aprueba o tiene pendiente cada línea. */
export function HorasPorJefe({ registros, elegidos, alElegir, clave, cuantos = 8 }: Interactiva & {
  clave: (r: RegistroAdmin) => string;
  cuantos?: number;
}) {
  const porJefe = sumarPor(registros, clave);
  const colegas = (jefe: string) => new Set(
    registros.filter((r) => clave(r) === jefe).map((r) => r.identificacion)).size;
  const filas = [...porJefe.entries()]
    .map(([jefe, total]) => ({ clave: jefe, nombre: jefe, detalle: colegasTexto(colegas(jefe)), ...total }))
    .sort((a, b) => b.minutos - a.minutos)
    .slice(0, cuantos);
  return <BarrasHorizontales titulo="Horas extras por jefe" filas={filas} total={totalDe(registros)}
    elegidos={elegidos} alElegir={alElegir} />;
}

const COLOR_ESTADO: Record<EstadoVisible, string> = {
  pendiente: 'bg-alerta',
  aprobada: 'bg-estado-registrada',
  negada: 'bg-error',
  anulada: 'bg-estado-anulada',
};

/** Registros por estado, con las horas de cada uno: para ver de un vistazo lo que falta decidir. */
export function RegistrosPorEstado({ registros, elegidos, alElegir }: Interactiva) {
  const porEstado = sumarPor(registros, estadoVisible);
  const filas = ESTADOS.map(({ valor, nombre }) => ({
    clave: valor, nombre, color: COLOR_ESTADO[valor],
    ...(porEstado.get(valor) ?? { minutos: 0, registros: 0 }),
  }));
  const pendientes = porEstado.get('pendiente')?.registros ?? 0;
  if (!registros.length) return <SinDatos />;
  return (
    <div className="grid gap-5">
      <Titular>
        {pendientes
          ? <><strong className="text-primario">{registrosTexto(pendientes)}</strong> por decidir.</>
          : 'No hay registros pendientes de decidir.'}
      </Titular>
      <BarrasHorizontales titulo="Registros por estado" filas={filas} total={totalDe(registros)}
        elegidos={elegidos} alElegir={alElegir} />
    </div>
  );
}
