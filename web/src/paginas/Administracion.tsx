import { useState, type FormEvent } from 'react';
import { ColegasConMasHoras, HorasPorDia, HorasPorFilial } from '../componentes/Graficas';
import { Aviso, Boton, Campo, claseEntrada, InsigniaEstado, Tarjeta } from '../componentes/ui';
import { descargarFormato } from '../exportar/formatoServicesCentral';
import { formatoFecha, NOMBRE_TIPO_DIA, nombreMes } from '../lib/fechas';
import { formatoDuracion, formatoHoraAmPm } from '../lib/horas';
import { mensajeDeError, supabase } from '../lib/supabase';
import type { RegistroAdmin } from '../lib/tipos';

type Respuesta<T> = ({ ok: true } & T) | { ok: false; mensaje: string };

async function llamar<T>(funcion: string, parametros: object): Promise<Respuesta<T>> {
  const { data, error } = await supabase.rpc(funcion, parametros);
  if (error) return { ok: false, mensaje: mensajeDeError(error) };
  return data as Respuesta<T>;
}

/** Con la clave de descarga: todos los registros del mes, el Excel y la anulación de cualquiera. */
export function Administracion({ hoy }: { hoy: string }) {
  const [clave, setClave] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [registros, setRegistros] = useState<RegistroAdmin[] | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'error' | 'exito'; texto: string } | null>(null);

  async function cargar(claveUsada: string, mesElegido: string) {
    const respuesta = await llamar<{ registros: RegistroAdmin[] }>('registros_admin', {
      p_clave: claveUsada, p_mes: `${mesElegido}-01`,
    });
    if (!respuesta.ok) { setAviso({ tipo: 'error', texto: respuesta.mensaje }); return false; }
    setRegistros(respuesta.registros);
    return true;
  }

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setEntrando(true);
    setAviso(null);
    await cargar(clave, mes);
    setEntrando(false);
  }

  function salir() {
    setClave('');
    setRegistros(null);
    setAviso(null);
  }

  if (!registros) {
    return (
      <div className="mx-auto w-full max-w-md">
        <Tarjeta titulo="Administración"
          descripcion="Para descargar el Excel del mes y anular registros. Requiere la clave de administración.">
          <form onSubmit={entrar} className="grid gap-4">
            <Campo etiqueta="Clave" htmlFor="clave-admin">
              <input id="clave-admin" type="password" required autoFocus autoComplete="off" value={clave}
                onChange={(e) => setClave(e.target.value)} className={claseEntrada} />
            </Campo>
            {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
            <Boton type="submit" disabled={entrando || !clave}>{entrando ? 'Entrando…' : 'Entrar'}</Boton>
          </form>
        </Tarjeta>
      </div>
    );
  }

  return (
    <PanelAdministracion mes={mes} hoy={hoy} registros={registros} aviso={aviso}
      alCambiarMes={async (nuevo) => { setMes(nuevo); setAviso(null); await cargar(clave, nuevo); }}
      alAnular={async (codigo, motivo) => {
        const respuesta = await llamar('anular_con_clave', { p_clave: clave, p_codigo: codigo, p_motivo: motivo });
        if (!respuesta.ok) { setAviso({ tipo: 'error', texto: respuesta.mensaje }); return false; }
        await cargar(clave, mes);
        setAviso({ tipo: 'exito', texto: `Se anuló ${codigo}. Ya no cuenta para los topes ni sale en el Excel.` });
        return true;
      }}
      alSalir={salir} />
  );
}

function PanelAdministracion({ mes, hoy, registros, aviso, alCambiarMes, alAnular, alSalir }: {
  mes: string;
  hoy: string;
  registros: RegistroAdmin[];
  aviso: { tipo: 'error' | 'exito'; texto: string } | null;
  alCambiarMes: (mes: string) => Promise<void>;
  alAnular: (codigo: string, motivo: string) => Promise<boolean>;
  alSalir: () => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [anulando, setAnulando] = useState<{ codigo: string; motivo: string } | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const vigentes = registros.filter((r) => r.estado === 'registrada');
  const minutosVigentes = vigentes.reduce((suma, r) => suma + r.minutos_totales, 0);
  const texto = busqueda.trim().toLowerCase();
  const visibles = texto
    ? registros.filter((r) => [r.codigo, r.identificacion, r.nombre_completo]
      .some((valor) => valor.toLowerCase().includes(texto)))
    : registros;

  async function confirmar() {
    if (!anulando) return;
    setTrabajando(true);
    if (await alAnular(anulando.codigo, anulando.motivo)) setAnulando(null);
    setTrabajando(false);
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Administración</h1>
          <p className="mt-1 text-sm text-texto-suave first-letter:uppercase">{nombreMes(`${mes}-01`)}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Campo etiqueta="Mes" htmlFor="mes-admin">
            <input id="mes-admin" type="month" value={mes} max={hoy.slice(0, 7)} className={claseEntrada}
              onChange={(e) => e.target.value && alCambiarMes(e.target.value)} />
          </Campo>
          <Boton disabled={!vigentes.length}
            onClick={() => descargarFormato(vigentes, `horas-extras-consolidado-${mes}.xlsx`)}>
            Descargar Excel ({vigentes.length})
          </Boton>
          <Boton variante="borde" onClick={alSalir}>Salir</Boton>
        </div>
      </div>

      <dl className="grid gap-4 sm:grid-cols-3">
        {[
          ['Registros vigentes', String(vigentes.length)],
          ['Horas extras del mes', formatoDuracion(minutosVigentes)],
          ['Anulados', String(registros.length - vigentes.length)],
        ].map(([nombre, valor]) => (
          <div key={nombre} className="rounded-xl border border-borde bg-blanco p-5 shadow-xs">
            <dt className="text-xs font-medium uppercase tracking-wide text-texto-suave">{nombre}</dt>
            <dd className="mt-1 text-3xl font-semibold text-primario">{valor}</dd>
          </div>
        ))}
      </dl>

      {vigentes.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <Tarjeta titulo="Horas por día" descripcion="Total de horas extras registradas cada día del mes.">
              <HorasPorDia registros={vigentes} mes={mes} />
            </Tarjeta>
          </div>
          <Tarjeta titulo="Horas por filial">
            <HorasPorFilial registros={vigentes} />
          </Tarjeta>
          <Tarjeta titulo="Colegas con más horas" descripcion="Los 8 con más horas extras en el mes.">
            <ColegasConMasHoras registros={vigentes} />
          </Tarjeta>
        </div>
      )}

      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}

      <Tarjeta titulo="Registros del mes"
        acciones={(
          <input type="search" aria-label="Buscar por código, cédula o nombre"
            placeholder="Buscar por código, cédula o nombre" value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)} className={`${claseEntrada} sm:w-72`} />
        )}>
        {!visibles.length ? (
          <p className="rounded-lg border border-dashed border-borde py-8 text-center text-sm text-texto-suave">
            {registros.length ? 'Ningún registro coincide con la búsqueda.' : 'No hay registros en este mes.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
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
                {visibles.map((r) => (
                  <tr key={r.codigo} className="border-b border-borde align-top last:border-b-0 hover:bg-fondo">
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
                    <td className="px-3 py-2.5">
                      <InsigniaEstado estado={r.estado} />
                      {r.motivo_anulacion && (
                        <div className="mt-1 max-w-48 text-xs text-texto-suave">{r.motivo_anulacion}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.estado === 'registrada' && anulando?.codigo !== r.codigo && (
                        <Boton variante="peligro" className="px-2 py-1"
                          onClick={() => setAnulando({ codigo: r.codigo, motivo: '' })}>
                          Anular
                        </Boton>
                      )}
                      {anulando?.codigo === r.codigo && (
                        <div className="flex min-w-56 flex-col gap-2">
                          <p className="text-xs text-texto-suave">
                            Anular {r.codigo} de {r.nombre_completo} ({formatoFecha(r.fecha_horas_extras)}).
                          </p>
                          <input autoFocus aria-label="Motivo de la anulación" placeholder="Motivo"
                            value={anulando.motivo} className={claseEntrada}
                            onChange={(e) => setAnulando({ codigo: r.codigo, motivo: e.target.value })} />
                          <div className="flex gap-2">
                            <Boton variante="peligro" className="px-2 py-1"
                              disabled={trabajando || !anulando.motivo.trim()} onClick={confirmar}>
                              {trabajando ? 'Anulando…' : 'Confirmar'}
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
    </div>
  );
}
