import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { Boton } from './ui';

export interface PasoGuia {
  /** Valor del atributo data-guia del elemento que se resalta. */
  objetivo: string;
  titulo: string;
  texto: ReactNode;
}

const MARGEN = 8;
const ANCHO_TARJETA = 360;

/** Recorrido por la página: oscurece todo menos la parte que explica, paso a paso. */
export function Guia({ pasos, alCerrar }: { pasos: PasoGuia[]; alCerrar: () => void }) {
  const visibles = pasos.filter((p) => document.querySelector(`[data-guia="${p.objetivo}"]`));
  const [indice, setIndice] = useState(0);
  const [marco, setMarco] = useState<DOMRect | null>(null);
  const paso = visibles[indice];

  useLayoutEffect(() => {
    const elemento = document.querySelector(`[data-guia="${paso.objetivo}"]`);
    if (!elemento) return;
    elemento.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const medir = () => setMarco(elemento.getBoundingClientRect());
    medir();
    // El scroll suave tarda; se vuelve a medir mientras se mueve la página.
    window.addEventListener('scroll', medir, true);
    window.addEventListener('resize', medir);
    return () => {
      window.removeEventListener('scroll', medir, true);
      window.removeEventListener('resize', medir);
    };
  }, [paso.objetivo]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar();
      if (e.key === 'ArrowRight') setIndice((i) => Math.min(i + 1, visibles.length - 1));
      if (e.key === 'ArrowLeft') setIndice((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [alCerrar, visibles.length]);

  if (!marco) return null;

  const ancho = Math.min(ANCHO_TARJETA, window.innerWidth - 2 * MARGEN);
  // Debajo de la parte resaltada si cabe; si no, encima o al lado; si nada cabe, abajo de la pantalla.
  const ALTO = 280;
  const separacion = MARGEN * 2;
  const arriba = Math.min(Math.max(MARGEN, marco.top), window.innerHeight - ALTO - MARGEN);
  const alineada = Math.min(Math.max(MARGEN, marco.left), window.innerWidth - ancho - MARGEN);
  const posicion = marco.bottom + ALTO < window.innerHeight
    ? { top: marco.bottom + separacion, left: alineada }
    : marco.top - separacion - ALTO > MARGEN
      ? { bottom: window.innerHeight - marco.top + separacion, left: alineada }
      : window.innerWidth - marco.right >= ancho + separacion + MARGEN
      ? { top: arriba, left: marco.right + separacion }
      : marco.left >= ancho + separacion + MARGEN
        ? { top: arriba, left: marco.left - ancho - separacion }
        : { bottom: separacion, left: (window.innerWidth - ancho) / 2 };
  const ultimo = indice === visibles.length - 1;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="guia-titulo">
      <div className="absolute inset-0" onClick={alCerrar} />
      <div aria-hidden className="pointer-events-none absolute rounded-xl shadow-[0_0_0_9999px] shadow-texto/60
        ring-2 ring-blanco transition-all duration-200"
        style={{
          top: marco.top - MARGEN, left: marco.left - MARGEN,
          width: marco.width + 2 * MARGEN, height: marco.height + 2 * MARGEN,
        }} />
      <div className="absolute grid gap-3 rounded-xl bg-blanco p-5 shadow-lg transition-all duration-200"
        style={{
          width: ancho, ...posicion,
        }}>
        <p className="text-xs font-medium uppercase tracking-wide text-texto-suave">
          Paso {indice + 1} de {visibles.length}
        </p>
        <h2 id="guia-titulo" className="text-base font-semibold">{paso.titulo}</h2>
        <div className="grid gap-2 text-sm leading-relaxed">{paso.texto}</div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <button type="button" onClick={alCerrar} className="text-sm text-texto-suave hover:text-texto">
            Cerrar
          </button>
          <div className="flex gap-2">
            {indice > 0 && (
              <Boton variante="borde" onClick={() => setIndice(indice - 1)}>Anterior</Boton>
            )}
            <Boton autoFocus onClick={() => (ultimo ? alCerrar() : setIndice(indice + 1))}>
              {ultimo ? 'Entendido' : 'Siguiente'}
            </Boton>
          </div>
        </div>
      </div>
    </div>
  );
}
