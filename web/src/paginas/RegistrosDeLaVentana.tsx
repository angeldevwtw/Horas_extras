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
      descripcion="Esta lista se borra al cerrar la pestaña. Lo registrado sí queda guardado, cuenta para los topes y sale en el Excel del mes, en Administración."
      acciones={(
        <Boton disabled={!vigentes.length}
          onClick={() => descargarFormato(vigentes, `horas-extras-${hoy}.xlsx`)}>
          Descargar Excel ({vigentes.length})
        </Boton>
      )}>
      {error && <div className="mb-3"><Aviso tipo="error">{error}</Aviso></div>}

      {!registros.length ? (
        <p className="rounded-lg border border-dashed border-borde py-8 text-center text-sm text-texto-suave">
          Aún no hay registros en esta ventana.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-borde text-xs uppercase tracking-wide text-texto-suave">
              <tr>
                <th className="px-3 py-2.5">Código</th>
                <th className="px-3 py-2.5">Fecha</th>
                <th className="px-3 py-2.5">Colega</th>
                <th className="px-3 py-2.5">Cargo / nivel</th>
                <th className="px-3 py-2.5">Filial</th>
                <th className="px-3 py-2.5">Horario</th>
                <th className="px-3 py-2.5">Total</th>
                <th className="px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id} className="border-b border-borde align-top last:border-b-0 hover:bg-fondo">
                  <td className="px-3 py-2.5 font-mono">{r.codigo}</td>
                  <td className="px-3 py-2.5">
                    {formatoFecha(r.fecha_horas_extras)}
                    <div className="text-xs text-texto-suave">{NOMBRE_TIPO_DIA[r.tipo_dia]}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    {r.nombre_completo}
                    <div className="text-xs text-texto-suave">{r.identificacion}</div>
                  </td>
                  <td className="px-3 py-2.5">{r.cargo}<div className="text-xs text-texto-suave">Nivel {r.nivel}</div></td>
                  <td className="px-3 py-2.5">{r.filial}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {formatoHoraAmPm(r.hora_inicio)} – {formatoHoraAmPm(r.hora_final)}
                  </td>
                  <td className="px-3 py-2.5">{formatoDuracion(r.minutos_totales)}</td>
                  <td className="px-3 py-2.5"><InsigniaEstado estado={r.estado} /></td>
                  <td className="px-3 py-2.5">
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
