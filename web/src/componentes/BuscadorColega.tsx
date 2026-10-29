import { useEffect, useState } from 'react';
import { claseEntrada } from './ui';
import { supabase } from '../lib/supabase';

export interface ColegaEncontrado {
  identificacion: string;
  nombre_completo: string;
  cargo: string;
  nivel: number;
  filial: string;
}

/** Busca entre los colegas que el usuario ya ha registrado, por cédula o nombre. */
export function BuscadorColega({ alElegir }: { alElegir: (colega: ColegaEncontrado) => void }) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<ColegaEncontrado[]>([]);

  useEffect(() => {
    if (texto.trim().length < 3) {
      setResultados([]);
      return;
    }
    const espera = setTimeout(async () => {
      const { data } = await supabase.rpc('buscar_colegas', { p_texto: texto });
      setResultados(data ?? []);
    }, 300);
    return () => clearTimeout(espera);
  }, [texto]);

  return (
    <div className="relative">
      <label htmlFor="buscar-colega" className="text-sm font-semibold">
        Buscar colega ya registrado
      </label>
      <input id="buscar-colega" type="search" autoComplete="off" value={texto}
        placeholder="Cédula o nombre (mínimo 3 caracteres)"
        onChange={(e) => setTexto(e.target.value)} className={`${claseEntrada} mt-1`} />
      {resultados.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-borde bg-blanco shadow-lg">
          {resultados.map((c) => (
            <li key={c.identificacion}>
              <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-seleccion"
                onClick={() => { alElegir(c); setTexto(''); }}>
                <span className="font-semibold">{c.nombre_completo}</span>
                <span className="text-texto-suave"> · {c.identificacion} · {c.cargo}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
