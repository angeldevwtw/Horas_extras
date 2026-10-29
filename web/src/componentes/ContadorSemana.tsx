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
    <div className="rounded-md border border-borde bg-suave p-3 text-sm">
      <p>
        Semana del {formatoFecha(lunes)} al {formatoFecha(domingo)}: lleva{' '}
        <strong>{formatoDuracion(usadosMin)}</strong> de {formatoDuracion(topeMin)} horas y le
        quedan <strong>{formatoDuracion(Math.max(0, topeMin - usadosMin))}</strong>.
      </p>
      {nuevosMin > 0 && (
        <p className="text-texto-suave">Con este registro quedaría en {formatoDuracion(total)}.</p>
      )}
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-blanco" role="progressbar"
        aria-valuemin={0} aria-valuemax={topeMin} aria-valuenow={total}>
        <div className={`h-full ${colorBarra}`} style={{ width: `${porcentaje}%` }} />
      </div>
    </div>
  );
}
