import { useState, type FormEvent } from 'react';
import { Aviso, Boton, Campo, claseEntrada, Tarjeta } from '../componentes/ui';
import { descargarFormato } from '../exportar/formatoServicesCentral';
import { nombreMes } from '../lib/fechas';
import { mensajeDeError, supabase } from '../lib/supabase';
import type { FilaFormato } from '../lib/tipos';

type Respuesta = { ok: true; registros: FilaFormato[] } | { ok: false; mensaje: string };

/** Excel con todo lo registrado en el mes, por cualquier persona. Pide la clave de descarga. */
export function DescargaConsolidada({ hoy }: { hoy: string }) {
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [clave, setClave] = useState('');
  const [descargando, setDescargando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'error' | 'exito'; texto: string } | null>(null);

  async function descargar(e: FormEvent) {
    e.preventDefault();
    setDescargando(true);
    setAviso(null);
    const { data, error } = await supabase.rpc('descargar_registros', {
      p_clave: clave, p_mes: `${mes}-01`,
    });
    setDescargando(false);
    if (error) { setAviso({ tipo: 'error', texto: mensajeDeError(error) }); return; }

    const respuesta = data as Respuesta;
    if (!respuesta.ok) { setAviso({ tipo: 'error', texto: respuesta.mensaje }); return; }
    if (!respuesta.registros.length) {
      setAviso({ tipo: 'error', texto: `No hay registros en ${nombreMes(`${mes}-01`)}.` });
      return;
    }
    await descargarFormato(respuesta.registros, `horas-extras-consolidado-${mes}.xlsx`);
    setAviso({ tipo: 'exito', texto: `Se descargaron ${respuesta.registros.length} registros.` });
    setClave('');
  }

  return (
    <Tarjeta titulo="Descarga consolidada">
      <p className="mb-4 text-sm text-texto-suave">
        Excel con todo lo registrado en el mes, por cualquier persona. Requiere la clave de descarga.
      </p>
      <form onSubmit={descargar} className="grid items-end gap-3 sm:grid-cols-[auto_1fr_auto]">
        <Campo etiqueta="Mes" htmlFor="mes-descarga">
          <input id="mes-descarga" type="month" required value={mes} max={hoy.slice(0, 7)}
            onChange={(e) => setMes(e.target.value)} className={claseEntrada} />
        </Campo>
        <Campo etiqueta="Clave de descarga" htmlFor="clave-descarga">
          <input id="clave-descarga" type="password" required autoComplete="off" value={clave}
            onChange={(e) => setClave(e.target.value)} className={claseEntrada} />
        </Campo>
        <Boton type="submit" variante="secundario" disabled={descargando || !clave || !mes}>
          {descargando ? 'Descargando…' : 'Descargar Excel del mes'}
        </Boton>
      </form>
      {aviso && <div className="mt-3"><Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso></div>}
    </Tarjeta>
  );
}
