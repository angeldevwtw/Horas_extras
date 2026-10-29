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

/** Horas de cada día del mes; los domingos quedan vacíos porque no se registran. */
export function HorasPorDia({ registros, mes }: { registros: RegistroAdmin[]; mes: string }) {
  const porDia = sumarPor(registros, (r) => r.fecha_horas_extras);
  const dias = diasDelMes(`${mes}-01`);
  const mayor = Math.max(0, ...[...porDia.values()].map((t) => t.minutos));
  // El eje llega a la hora entera siguiente, con al menos 2:00, para que las barras no toquen el techo.
  const techo = Math.max(120, Math.ceil(mayor / 60) * 60);
  const lineas = [techo, techo / 2, 0];

  return (
    <figure>
      <figcaption className="sr-only">Horas extras por día del mes</figcaption>
      <div className="flex gap-2">
        <div aria-hidden className="flex h-48 flex-col justify-between text-right text-xs text-texto-suave">
          {lineas.map((m) => <span key={m} className="-my-2 leading-4">{formatoDuracion(m)}</span>)}
        </div>
        <div className="relative h-48 flex-1">
          <div aria-hidden className="absolute inset-0 flex flex-col justify-between">
            {lineas.map((m) => <div key={m} className="border-t border-borde" />)}
          </div>
          <div className="relative flex h-full items-end gap-0.5">
            {dias.map((fecha) => {
              const total = porDia.get(fecha);
              const nombreDia = DIAS[diaDeSemana(fecha)];
              return (
                <div key={fecha} tabIndex={total ? 0 : -1}
                  aria-label={total ? `${nombreDia} ${formatoFecha(fecha)}: ${formatoDuracion(total.minutos)} horas` : undefined}
                  className="group relative flex h-full flex-1 items-end justify-center rounded-sm hover:bg-fondo focus-visible:bg-fondo">
                  {total && (
                    <>
                      <div className="w-full max-w-5 rounded-t bg-primario group-hover:bg-secundario"
                        style={{ height: `${(total.minutos / techo) * 100}%` }} />
                      <Detalle>
                        <strong>{nombreDia} {formatoFecha(fecha).slice(0, 5)}</strong> · {formatoDuracion(total.minutos)} h
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
      <div aria-hidden className="ml-10 mt-1 flex gap-0.5 text-center text-xs text-texto-suave">
        {dias.map((fecha) => {
          const dia = Number(fecha.slice(8));
          return <span key={fecha} className="flex-1">{dia === 1 || dia % 5 === 0 ? dia : ''}</span>;
        })}
      </div>
    </figure>
  );
}

function BarrasHorizontales({ titulo, filas }: {
  titulo: string;
  filas: { nombre: string; detalle?: string; minutos: number; registros: number }[];
}) {
  const mayor = Math.max(1, ...filas.map((f) => f.minutos));
  return (
    <figure>
      <figcaption className="sr-only">{titulo}</figcaption>
      <ul className="grid gap-3">
        {filas.map((f) => (
          <li key={f.detalle ?? f.nombre} tabIndex={0} className="group relative grid gap-1 rounded-md outline-offset-4">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">
                {f.nombre}
                {f.detalle && <span className="ml-1.5 text-xs text-texto-suave">{f.detalle}</span>}
              </span>
              <span className="shrink-0 font-semibold">{formatoDuracion(f.minutos)} h</span>
            </div>
            <div className="h-2 rounded-full bg-fondo">
              <div className="h-full rounded-full bg-primario group-hover:bg-secundario"
                style={{ width: `${(f.minutos / mayor) * 100}%` }} />
            </div>
            <Detalle>{f.nombre} · {formatoDuracion(f.minutos)} h · {registrosTexto(f.registros)}</Detalle>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function HorasPorFilial({ registros }: { registros: RegistroAdmin[] }) {
  const porFilial = sumarPor(registros, (r) => r.filial);
  return (
    <BarrasHorizontales titulo="Horas extras por filial" filas={FILIALES.map((filial) => ({
      nombre: filial, ...(porFilial.get(filial) ?? { minutos: 0, registros: 0 }),
    }))} />
  );
}

export function ColegasConMasHoras({ registros, cuantos = 8 }: { registros: RegistroAdmin[]; cuantos?: number }) {
  const porColega = sumarPor(registros, (r) => r.identificacion);
  const nombres = new Map(registros.map((r) => [r.identificacion, r.nombre_completo]));
  const filas = [...porColega.entries()]
    .map(([cedula, total]) => ({ nombre: nombres.get(cedula) ?? cedula, detalle: cedula, ...total }))
    .sort((a, b) => b.minutos - a.minutos)
    .slice(0, cuantos);
  return <BarrasHorizontales titulo="Colegas con más horas extras" filas={filas} />;
}
