import { useState } from 'react';

type Tema = 'claro' | 'oscuro';

const temaActual = (): Tema => (document.documentElement.dataset.tema === 'oscuro' ? 'oscuro' : 'claro');

/** Cambia entre claro y oscuro; index.html aplica el tema guardado antes de pintar. */
export function BotonTema() {
  const [tema, setTema] = useState<Tema>(temaActual);
  const siguiente: Tema = tema === 'oscuro' ? 'claro' : 'oscuro';

  function cambiar() {
    document.documentElement.dataset.tema = siguiente;
    try {
      localStorage.setItem('tema', siguiente);
    } catch {
      // Sin almacenamiento (ventana privada): el tema dura hasta recargar.
    }
    setTema(siguiente);
  }

  return (
    <button type="button" onClick={cambiar} aria-label={`Cambiar a modo ${siguiente}`} title={`Modo ${siguiente}`}
      className="grid size-9 place-items-center rounded-md border border-borde bg-superficie text-primario
        transition-colors hover:bg-suave">
      <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round">
        {tema === 'oscuro' ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        )}
      </svg>
    </button>
  );
}
