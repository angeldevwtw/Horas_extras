import { useState } from 'react';
import { claseEntrada } from './ui';
import { CARGOS } from '../lib/reglas';

const OTRO = '__otro__';

/** Desplegable de cargos; con "Otro" se escribe el cargo a mano. */
export function SelectorCargo({ valor, invalido, alCambiar }: {
  valor: string;
  invalido: boolean;
  alCambiar: (cargo: string) => void;
}) {
  const enLista = CARGOS.some((c) => c === valor);
  const [escribiendo, setEscribiendo] = useState(valor !== '' && !enLista);

  return (
    <div className="flex flex-col gap-2">
      <select id="cargo" value={escribiendo ? OTRO : valor} aria-invalid={invalido && !escribiendo}
        onChange={(e) => {
          const otro = e.target.value === OTRO;
          setEscribiendo(otro);
          alCambiar(otro ? '' : e.target.value);
        }}
        className={claseEntrada}>
        <option value="">Seleccione…</option>
        {CARGOS.map((c) => <option key={c}>{c}</option>)}
        <option value={OTRO}>Otro</option>
      </select>
      {escribiendo && (
        <input autoFocus aria-label="Escriba el cargo" placeholder="Escriba el cargo" value={valor}
          aria-invalid={invalido} onChange={(e) => alCambiar(e.target.value)} className={claseEntrada} />
      )}
    </div>
  );
}
