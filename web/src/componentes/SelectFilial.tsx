import { FILIALES } from '../lib/reglas';
import { claseEntrada } from './ui';

/** Filial de un jefe. Sin filial, sale en el formulario para todas. */
export function SelectFilial({ id, valor, deshabilitado, alCambiar, etiqueta }: {
  id?: string;
  valor: string | null;
  deshabilitado?: boolean;
  alCambiar: (filial: string | null) => void;
  etiqueta?: string;
}) {
  return (
    <select id={id} aria-label={etiqueta} value={valor ?? ''} disabled={deshabilitado} className={claseEntrada}
      onChange={(e) => alCambiar(e.target.value || null)}>
      <option value="">Todas las filiales</option>
      {FILIALES.map((f) => <option key={f}>{f}</option>)}
    </select>
  );
}
