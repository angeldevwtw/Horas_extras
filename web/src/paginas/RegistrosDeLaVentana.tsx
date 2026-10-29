import { useState } from 'react';
import { Aviso, Boton, claseEntrada, InsigniaEstado, Tarjeta } from '../componentes/ui';
import { descargarFormato } from '../exportar/formatoServicesCentral';
import { formatoFecha, NOMBRE_TIPO_DIA } from '../lib/fechas';
import { formatoDuracion, formatoHoraAmPm } from '../lib/horas';
import { mensajeDeError, supabase } from '../lib/supabase';
import type { Registro } from '../lib/tipos';

export function RegistrosDeLaVentana({ registros, hoy, alAnular }: {
  registros: Registro[];
  hoy: string;
  alAnular: (id: number) => void;
}) {
  const [anulando, setAnulando] = useState<{ id: number; motivo: string } | null>(null);
  const [error, setError] = useState('');

  const vigentes = registros.filter((r) => r.estado === 'registrada');

  async function confirmarAnulacion(registro: Registro) {
    if (!anulando) return;
    const { error } = await supabase.rpc('anular_registro', {
      p_id: registro.id, p_clave: registro.clave_anulacion, p_motivo: anulando.motivo,
    });
    if (error) { setError(mensajeDeError(error)); return; }
    setError('');
    setAnulando(null);
    alAnular(registro.id);
  }

  return (
    <Tarjeta
      titulo="Registrado en esta ventana"
      acciones={(
        <Boton disabled={!vigentes.length}
          onClick={() => descargarFormato(vigentes, `horas-extras-${hoy}.xlsx`)}>
          Descargar Excel ({vigentes.length})
        </Boton>
      )}>
      <p className="mb-3 text-sm text-texto-suave">
        Descargue el Excel antes de cerrar la pestaña: esta lista no se puede recuperar después.
        Lo registrado sí queda guardado y cuenta para los topes.
      </p>
      {error && <div className="mb-3"><Aviso tipo="error">{error}</Aviso></div>}

      {!registros.length ? (
        <p className="py-4 text-center text-sm text-texto-suave">Aún no hay registros.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-borde text-texto-suave">
              <tr>
                <th className="p-2">Código</th>
                <th className="p-2">Fecha</th>
                <th className="p-2">Colega</th>
                <th className="p-2">Cargo / nivel</th>
                <th className="p-2">Filial</th>
                <th className="p-2">Horario</th>
                <th className="p-2">Total</th>
                <th className="p-2">Estado</th>
                <th className="p-2"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id} className="border-b border-borde align-top">
                  <td className="p-2 font-mono">{r.codigo}</td>
                  <td className="p-2">
                    {formatoFecha(r.fecha_horas_extras)}
                    <div className="text-xs text-texto-suave">{NOMBRE_TIPO_DIA[r.tipo_dia]}</div>
                  </td>
                  <td className="p-2">
                    {r.nombre_completo}
                    <div className="text-xs text-texto-suave">{r.identificacion}</div>
                  </td>
                  <td className="p-2">{r.cargo}<div className="text-xs text-texto-suave">Nivel {r.nivel}</div></td>
                  <td className="p-2">{r.filial}</td>
                  <td className="p-2 whitespace-nowrap">
                    {formatoHoraAmPm(r.hora_inicio)} – {formatoHoraAmPm(r.hora_final)}
                  </td>
                  <td className="p-2">{formatoDuracion(r.minutos_totales)}</td>
                  <td className="p-2"><InsigniaEstado estado={r.estado} /></td>
                  <td className="p-2">
                    {r.estado === 'registrada' && anulando?.id !== r.id && (
                      <Boton variante="peligro" className="px-2 py-1"
                        onClick={() => setAnulando({ id: r.id, motivo: '' })}>
                        Anular
                      </Boton>
                    )}
                    {anulando?.id === r.id && (
                      <div className="flex min-w-48 flex-col gap-2">
                        <input autoFocus aria-label="Motivo de la anulación" placeholder="Motivo"
                          value={anulando.motivo} className={claseEntrada}
                          onChange={(e) => setAnulando({ id: r.id, motivo: e.target.value })} />
                        <div className="flex gap-2">
                          <Boton variante="peligro" className="px-2 py-1" disabled={!anulando.motivo.trim()}
                            onClick={() => confirmarAnulacion(r)}>
                            Confirmar
                          </Boton>
                          <Boton variante="borde" className="px-2 py-1" onClick={() => setAnulando(null)}>
                            Cancelar
                          </Boton>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Tarjeta>
  );
}
