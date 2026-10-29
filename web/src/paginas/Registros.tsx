import { useCallback, useEffect, useMemo, useState } from 'react';
import { Aviso, Boton, claseEntrada, InsigniaEstado, Tarjeta } from '../componentes/ui';
import { descargarFormato } from '../exportar/formatoServicesCentral';
import { formatoFecha, NOMBRE_TIPO_DIA, primerDiaMesSiguiente } from '../lib/fechas';
import { formatoDuracion, formatoHoraAmPm } from '../lib/horas';
import { mensajeDeError, supabase } from '../lib/supabase';
import type { Registro } from '../lib/tipos';

const COLUMNAS_REGISTRO = 'id, codigo, identificacion, nombre_completo, cargo, nivel, filial, '
  + 'fecha_horas_extras, hora_inicio, hora_final, minutos_totales, tipo_dia, justificacion, estado, '
  + 'motivo_anulacion';

type FiltroEstado = 'registrada' | 'anulada' | 'todas';

export function Registros({ hoy }: { hoy: string }) {
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [texto, setTexto] = useState('');
  const [filial, setFilial] = useState('');
  const [estado, setEstado] = useState<FiltroEstado>('registrada');
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [anulando, setAnulando] = useState<{ id: number; motivo: string } | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const desde = `${mes}-01`;
    const { data, error } = await supabase.from('registros').select(COLUMNAS_REGISTRO)
      .gte('fecha_horas_extras', desde).lt('fecha_horas_extras', primerDiaMesSiguiente(desde))
      .order('fecha_horas_extras').order('nombre_completo')
      .returns<Registro[]>();
    setCargando(false);
    setSeleccion(new Set());
    if (error) setError(mensajeDeError(error));
    else { setError(''); setRegistros(data); }
  }, [mes]);

  useEffect(() => { cargar(); }, [cargar]);

  const filiales = useMemo(() => [...new Set(registros.map((r) => r.filial))].sort(), [registros]);

  // El filtro por colega se hace aquí y no en la consulta, para no mandar cédulas en la URL.
  const visibles = registros.filter((r) => {
    const buscado = texto.trim().toLowerCase();
    return (estado === 'todas' || r.estado === estado)
      && (!filial || r.filial === filial)
      && (!buscado || r.identificacion.toLowerCase().includes(buscado)
        || r.nombre_completo.toLowerCase().includes(buscado));
  });
  const exportables = visibles.filter((r) => r.estado === 'registrada');
  const elegidos = exportables.filter((r) => seleccion.has(r.id));
  const aExportar = elegidos.length ? elegidos : exportables;
  const totalMinutos = exportables.reduce((suma, r) => suma + r.minutos_totales, 0);

  function alternar(id: number) {
    setSeleccion((s) => {
      const nueva = new Set(s);
      if (nueva.has(id)) nueva.delete(id); else nueva.add(id);
      return nueva;
    });
  }

  async function confirmarAnulacion() {
    if (!anulando) return;
    const { error } = await supabase.rpc('anular_registro', { p_id: anulando.id, p_motivo: anulando.motivo });
    if (error) { setError(mensajeDeError(error)); return; }
    setAnulando(null);
    cargar();
  }

  return (
    <Tarjeta
      titulo="Registros"
      acciones={(
        <Boton disabled={!aExportar.length}
          onClick={() => descargarFormato(aExportar, `horas-extras-${mes}.xlsx`)}>
          Descargar Excel ({aExportar.length})
        </Boton>
      )}>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input type="month" aria-label="Mes" value={mes} max={hoy.slice(0, 7)}
          onChange={(e) => e.target.value && setMes(e.target.value)} className={claseEntrada} />
        <input type="search" aria-label="Buscar colega" placeholder="Colega o cédula" value={texto}
          onChange={(e) => setTexto(e.target.value)} className={claseEntrada} />
        <select aria-label="Filial" value={filial} onChange={(e) => setFilial(e.target.value)}
          className={claseEntrada}>
          <option value="">Todas las filiales</option>
          {filiales.map((f) => <option key={f}>{f}</option>)}
        </select>
        <select aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value as FiltroEstado)}
          className={claseEntrada}>
          <option value="registrada">Registradas</option>
          <option value="anulada">Anuladas</option>
          <option value="todas">Todas</option>
        </select>
      </div>

      <p className="mb-3 text-sm text-texto-suave">
        {elegidos.length
          ? `Se descargarán los ${elegidos.length} registros marcados.`
          : 'Sin registros marcados se descargan todos los registrados que se ven en la tabla.'}
        {' '}Total registrado en la vista: {formatoDuracion(totalMinutos)} horas.
      </p>

      {error && <div className="mb-3"><Aviso tipo="error">{error}</Aviso></div>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-borde text-texto-suave">
            <tr>
              <th className="p-2"><span className="sr-only">Marcar</span></th>
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
            {cargando && <tr><td colSpan={10} className="p-4 text-center text-texto-suave">Cargando…</td></tr>}
            {!cargando && !visibles.length && (
              <tr><td colSpan={10} className="p-4 text-center text-texto-suave">No hay registros con esos filtros.</td></tr>
            )}
            {!cargando && visibles.map((r) => (
              <tr key={r.id} className={`border-b border-borde align-top ${seleccion.has(r.id) ? 'bg-seleccion' : ''}`}>
                <td className="p-2">
                  {r.estado === 'registrada' && (
                    <input type="checkbox" aria-label={`Marcar ${r.codigo}`} checked={seleccion.has(r.id)}
                      onChange={() => alternar(r.id)} className="accent-primario" />
                  )}
                </td>
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
                <td className="p-2">
                  <InsigniaEstado estado={r.estado} />
                  {r.motivo_anulacion && <div className="mt-1 text-xs text-texto-suave">{r.motivo_anulacion}</div>}
                </td>
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
                          onClick={confirmarAnulacion}>
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
    </Tarjeta>
  );
}
