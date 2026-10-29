import type { ReactNode } from 'react';
import { diaDeSemana, diasDelMes, formatoFecha } from '../lib/fechas';
import { formatoDuracion } from '../lib/horas';
import { FILIALES } from '../lib/reglas';
import type { RegistroAdmin } from '../lib/tipos';

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const registrosTexto = (n: number) => `${n} ${n === 1 ? 'registro' : 'registros'}`;

/** Recuadro que aparece al pasar el mouse o al enfocar la barra con el teclado. */
function Detalle({ children }: { children: ReactNode }) {
  return (
    <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2
      -translate-x-1/2 whitespace-nowrap rounded-md bg-texto px-2.5 py-1.5 text-xs text-blanco opacity-0
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

/** Horas de cada día del mes, con sábados y festivos sombreados y el valor encima de cada barra. */
export function HorasPorDia({ registros, mes, festivos }: {
  registros: RegistroAdmin[];
  mes: string;
  festivos: Set<string>;
}) {
  const porDia = sumarPor(registros, (r) => r.fecha_horas_extras);
  const dias = diasDelMes(`${mes}-01`);
  const conHoras = [...porDia.entries()].filter(([fecha]) => fecha.startsWith(mes));
  const totalMes = conHoras.reduce((suma, [, t]) => suma + t.minutos, 0);
  const pico = conHoras.reduce<[string, { minutos: number }] | null>(
    (mayor, actual) => (!mayor || actual[1].minutos > mayor[1].minutos ? actual : mayor), null);
  // El eje llega a la hora entera siguiente, con al menos 2:00, y deja espacio para el valor encima.
  const techo = Math.max(120, Math.ceil(((pico?.[1].minutos ?? 0) + 30) / 60) * 60);
  const lineas = Array.from({ length: techo / 60 + 1 }, (_, i) => techo - i * 60);

  const datos = [
    ['Día con más horas', pico ? `${nombreCorto(pico[0])} · ${formatoDuracion(pico[1].minutos)} h` : '—'],
    ['Días con horas extras', `${conHoras.length} de ${dias.filter((d) => diaDeSemana(d) !== 0).length}`],
    ['Promedio por día con horas', conHoras.length ? `${formatoDuracion(Math.round(totalMes / conHoras.length))} h` : '—'],
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

      <div>
        <div className="flex gap-2">
          <div aria-hidden className="flex h-56 w-9 shrink-0 flex-col justify-between text-right text-xs text-texto-suave">
            {lineas.map((m) => <span key={m} className="-my-2 leading-4">{formatoDuracion(m)}</span>)}
          </div>
          <div className="relative h-56 flex-1">
            <div aria-hidden className="absolute inset-0 flex flex-col justify-between">
              {lineas.map((m) => <div key={m} className={`border-t ${m ? 'border-dashed' : ''} border-borde`} />)}
            </div>
            <div className="relative flex h-full items-end gap-0.5">
              {dias.map((fecha) => {
                const total = porDia.get(fecha);
                const especial = diaDeSemana(fecha) === 6 || festivos.has(fecha);
                return (
                  <div key={fecha} tabIndex={total ? 0 : -1}
                    aria-label={total ? `${nombreCorto(fecha)}: ${formatoDuracion(total.minutos)} horas` : undefined}
                    className={`group relative flex h-full flex-1 flex-col items-center justify-end rounded-t-sm
                      ${especial ? 'bg-seleccion' : ''}`}>
                    {total && (
                      <>
                        <span className="mb-1 text-[11px] font-semibold leading-none">{formatoDuracion(total.minutos)}</span>
                        <div className="w-full max-w-6 rounded-t bg-primario group-hover:bg-secundario"
                          style={{ height: `${(total.minutos / techo) * 100}%` }} />
                        <Detalle>
                          <strong>{nombreCorto(fecha)}</strong> · {formatoDuracion(total.minutos)} h
                          · {registrosTexto(total.registros)}
                        </Detalle>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div aria-hidden className="mt-1.5 flex gap-2">
          <span className="w-9 shrink-0" />
          <div className="flex flex-1 gap-0.5 text-center text-[11px] leading-tight text-texto-suave">
            {dias.map((fecha) => {
              const dia = diaDeSemana(fecha);
              return (
                <span key={fecha} className={`flex-1 ${dia === 0 ? 'opacity-50' : ''}`}>
                  <span className="block font-medium text-texto">{Number(fecha.slice(8))}</span>
                  {DIAS[dia][0]}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-texto-suave">
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-sm bg-primario" />Horas extras del día
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-sm bg-seleccion ring-1 ring-inset ring-borde" />Sábado o festivo
        </li>
        <li>Los domingos no se registran.</li>
      </ul>
    </figure>
  );
}

const nombreCorto = (fecha: string) => `${DIAS[diaDeSemana(fecha)]} ${formatoFecha(fecha).slice(0, 5)}`;

interface Fila { clave: string; nombre: string; detalle?: string; minutos: number; registros: number }

const porcentaje = (parte: number, total: number) => (total ? Math.round((parte / total) * 100) : 0);

/** Frase destacada sobre la gráfica, con la cifra en morado. */
function Titular({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-fondo px-4 py-3 text-sm">{children}</p>;
}

/** Barras frente al mayor; el porcentaje es sobre el total del mes, aunque se muestren solo algunas. */
function BarrasHorizontales({ titulo, filas, total, conPosicion = false }: {
  titulo: string;
  filas: Fila[];
  total: number;
  conPosicion?: boolean;
}) {
  const mayor = Math.max(1, ...filas.map((f) => f.minutos));
  return (
    <figure>
      <figcaption className="sr-only">{titulo}</figcaption>
      <ol className="grid gap-4">
        {filas.map((f, i) => (
          <li key={f.clave} tabIndex={0} className="group relative flex items-center gap-3 rounded-md outline-offset-4">
            {conPosicion && (
              <span aria-hidden className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold
                ${i === 0 ? 'bg-primario text-blanco' : 'bg-suave text-primario'}`}>{i + 1}</span>
            )}
            <div className="grid min-w-0 flex-1 gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-medium">
                  {f.nombre}
                  {f.detalle && <span className="ml-1.5 text-xs font-normal text-texto-suave">{f.detalle}</span>}
                </span>
                <span className="shrink-0 text-sm">
                  <span className="font-semibold">{formatoDuracion(f.minutos)} h</span>
                  <span className="ml-1.5 text-xs text-texto-suave">{porcentaje(f.minutos, total)} %</span>
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-fondo">
                <div className="h-full rounded-full bg-primario transition-[width] group-hover:bg-secundario"
                  style={{ width: `${(f.minutos / mayor) * 100}%` }} />
              </div>
              <span className="text-xs text-texto-suave">{registrosTexto(f.registros)}</span>
            </div>
            <Detalle>
              <strong>{f.nombre}</strong> · {formatoDuracion(f.minutos)} h · {porcentaje(f.minutos, total)} % del mes
            </Detalle>
          </li>
        ))}
      </ol>
    </figure>
  );
}

export function HorasPorFilial({ registros }: { registros: RegistroAdmin[] }) {
  const porFilial = sumarPor(registros, (r) => r.filial);
  const colegas = (filial: string) => new Set(
    registros.filter((r) => r.filial === filial).map((r) => r.identificacion)).size;
  const filas = FILIALES.map((filial) => ({
    clave: filial, nombre: filial, ...(porFilial.get(filial) ?? { minutos: 0, registros: 0 }),
  })).map((f) => ({ ...f, detalle: `${colegas(f.nombre)} ${colegas(f.nombre) === 1 ? 'colega' : 'colegas'}` }))
    .sort((a, b) => b.minutos - a.minutos);
  const total = filas.reduce((suma, f) => suma + f.minutos, 0);
  return (
    <div className="grid gap-5">
      <Titular>
        <strong>{filas[0].nombre}</strong> concentra el{' '}
        <strong className="text-primario">{porcentaje(filas[0].minutos, total)} %</strong> de las horas extras del mes.
      </Titular>
      <BarrasHorizontales titulo="Horas extras por filial" filas={filas} total={total} />
    </div>
  );
}

export function ColegasConMasHoras({ registros, cuantos = 8 }: { registros: RegistroAdmin[]; cuantos?: number }) {
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
  return (
    <div className="grid gap-5">
      <Titular>
        <strong>{filas[0].nombre}</strong> lleva más horas en el mes:{' '}
        <strong className="text-primario">{formatoDuracion(filas[0].minutos)} h</strong>.
      </Titular>
      <BarrasHorizontales titulo="Colegas con más horas extras" filas={filas} conPosicion
        total={registros.reduce((suma, r) => suma + r.minutos_totales, 0)} />
    </div>
  );
}
