import type { ButtonHTMLAttributes, ReactNode } from 'react';

const VARIANTES = {
  primario: 'bg-primario text-blanco hover:bg-primario-hover',
  secundario: 'bg-secundario text-blanco hover:bg-primario',
  borde: 'border border-borde bg-blanco text-primario hover:bg-suave',
  peligro: 'border border-error bg-blanco text-error hover:bg-error-suave',
};

export function Boton({
  variante = 'primario',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: keyof typeof VARIANTES }) {
  return (
    <button
      className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors
        disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variante]} ${className}`}
      {...props}
    />
  );
}

export function Campo({ etiqueta, error, ayuda, htmlFor, children }: {
  etiqueta: string;
  error?: string;
  ayuda?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-semibold">{etiqueta}</label>
      {children}
      {error
        ? <p role="alert" className="text-sm text-error">{error}</p>
        : ayuda && <p className="text-sm text-texto-suave">{ayuda}</p>}
    </div>
  );
}

export const claseEntrada = `w-full rounded-md border border-borde bg-blanco px-3 py-2 text-sm
  disabled:bg-fondo disabled:text-texto-suave aria-invalid:border-error`;

export function Tarjeta({ titulo, children, acciones }: {
  titulo?: string;
  children: ReactNode;
  acciones?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-borde bg-blanco p-4 sm:p-6">
      {(titulo || acciones) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {titulo && <h2 className="text-lg font-semibold text-primario">{titulo}</h2>}
          {acciones}
        </div>
      )}
      {children}
    </section>
  );
}

export function Aviso({ tipo, children }: { tipo: 'error' | 'exito'; children: ReactNode }) {
  const clase = tipo === 'error'
    ? 'border-error bg-error-suave text-error'
    : 'border-estado-registrada bg-blanco text-estado-registrada';
  return <div role="status" className={`rounded-md border px-4 py-3 text-sm ${clase}`}>{children}</div>;
}

export function InsigniaEstado({ estado }: { estado: 'registrada' | 'anulada' }) {
  const clase = estado === 'registrada' ? 'bg-estado-registrada' : 'bg-estado-anulada';
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold text-blanco ${clase}`}>
      {estado === 'registrada' ? 'Registrada' : 'Anulada'}
    </span>
  );
}
