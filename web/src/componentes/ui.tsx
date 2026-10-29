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
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">{etiqueta}</label>
      {children}
      {error
        ? <p role="alert" className="text-sm text-error">{error}</p>
        : ayuda && <p className="text-xs text-texto-suave">{ayuda}</p>}
    </div>
  );
}

export const claseEntrada = `w-full rounded-md border border-borde bg-blanco px-3 py-2 text-sm
  transition-colors hover:border-texto-suave focus:border-primario focus:outline-none
  focus:ring-3 focus:ring-primario/15 disabled:bg-fondo disabled:text-texto-suave
  disabled:hover:border-borde aria-invalid:border-error`;

export function Tarjeta({ titulo, descripcion, children, acciones }: {
  titulo?: string;
  descripcion?: string;
  children: ReactNode;
  acciones?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-borde bg-blanco p-5 shadow-xs sm:p-6">
      {(titulo || acciones) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {titulo && <h2 className="text-base font-semibold">{titulo}</h2>}
            {descripcion && <p className="mt-1 text-sm text-texto-suave">{descripcion}</p>}
          </div>
          {acciones}
        </div>
      )}
      {children}
    </section>
  );
}

/** Paso numerado dentro del formulario. */
export function Paso({ numero, titulo, descripcion, children }: {
  numero: number;
  titulo: string;
  descripcion?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`paso-${numero}`}
      className="grid gap-5 border-t border-borde px-5 py-6 first:border-t-0 sm:px-6">
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-suave
          text-sm font-semibold text-primario">{numero}</span>
        <div>
          <h2 id={`paso-${numero}`} className="text-base font-semibold">{titulo}</h2>
          {descripcion && <p className="mt-0.5 text-sm text-texto-suave">{descripcion}</p>}
        </div>
      </div>
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
