import { formatoFecha } from '../lib/fechas';
import { formatoDuracion } from '../lib/horas';

/** Barra de horas de la semana frente al tope: cambia de color al 80 % y al 100 %. */
export function ContadorSemana({ usadosMin, nuevosMin, topeMin, lunes, domingo }: {
  usadosMin: number;
  nuevosMin: number;
  topeMin: number;
  lunes: string;
  domingo: string;
}) {
  const total = usadosMin + nuevosMin;
  const porcentaje = Math.min(100, (total / topeMin) * 100);
  const colorBarra = total >= topeMin ? 'bg-error' : total >= topeMin * 0.8 ? 'bg-alerta' : 'bg-primario';

  return (
    <div className="grid gap-2 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-texto-suave">
          Semana {formatoFecha(lunes).slice(0, 5)} – {formatoFecha(domingo).slice(0, 5)}
        </span>
        <span className="font-semibold">
          {formatoDuracion(total)} <span className="font-normal text-texto-suave">/ {formatoDuracion(topeMin)}</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-fondo" role="progressbar"
        aria-label="Horas extras de la semana" aria-valuemin={0} aria-valuemax={topeMin} aria-valuenow={total}>
        <div className={`h-full rounded-full transition-[width] ${colorBarra}`} style={{ width: `${porcentaje}%` }} />
      </div>
      <p className="text-xs text-texto-suave">
        Lleva {formatoDuracion(usadosMin)}
        {nuevosMin > 0 && <> y este registro suma {formatoDuracion(nuevosMin)}</>}.
        Le quedan {formatoDuracion(Math.max(0, topeMin - total))} esta semana.
      </p>
    </div>
  );
}
