import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { MisCoordinadores } from '../componentes/MisCoordinadores';
import { Aviso, Boton, Campo, claseEntrada, InsigniaEstado, Tarjeta } from '../componentes/ui';
import { descargarFormato } from '../exportar/formatoServicesCentral';
import { formatoFecha, NOMBRE_TIPO_DIA, nombreMes } from '../lib/fechas';
import { formatoDuracion, formatoHoraAmPm } from '../lib/horas';
import { mensajeDeError, supabase } from '../lib/supabase';
import type { RegistroAdmin, RolJefe } from '../lib/tipos';

interface Perfil { nombre: string; rol: RolJefe; filial: string | null }

const SIN_ACCESO = 'Esta cuenta no es de un director ni de un coordinador activo.';

/** Director y coordinador entran con su cuenta: ven y deciden solo lo de su línea. */
export function MiEquipo({ hoy }: { hoy: string }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');

  const leerPerfil = useCallback(async () => {
    const { data, error } = await supabase.rpc('mi_perfil');
    if (error || !data) {
      await supabase.auth.signOut();
      setError(error ? mensajeDeError(error) : SIN_ACCESO);
      return;
    }
    setPerfil(data);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) await leerPerfil();
      setCargando(false);
    });
  }, [leerPerfil]);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: contrasena });
    setContrasena('');
    if (error) setError('El correo o la contraseña no son correctos.');
    else await leerPerfil();
    setCargando(false);
  }

  async function salir() {
    await supabase.auth.signOut();
    setPerfil(null);
  }

  if (perfil) return <PanelEquipo perfil={perfil} hoy={hoy} alSalir={salir} />;

  return (
    <div className="mx-auto w-full max-w-md">
      <Tarjeta titulo="Mi equipo" descripcion="Para directores y coordinadores: aprobar o negar las horas extras de su equipo.">
        <form onSubmit={entrar} className="grid gap-4">
          <Campo etiqueta="Correo" htmlFor="equipo-correo">
            <input id="equipo-correo" type="email" required autoFocus autoComplete="username" value={correo}
              onChange={(e) => setCorreo(e.target.value)} className={claseEntrada} />
          </Campo>
          <Campo etiqueta="Contraseña" htmlFor="equipo-contrasena">
            <input id="equipo-contrasena" type="password" required autoComplete="current-password" value={contrasena}
              onChange={(e) => setContrasena(e.target.value)} className={claseEntrada} />
          </Campo>
          {error && <Aviso tipo="error">{error}</Aviso>}
          <Boton type="submit" disabled={cargando || !correo || !contrasena}>{cargando ? 'Entrando…' : 'Entrar'}</Boton>
        </form>
      </Tarjeta>
    </div>
  );
}

function PanelEquipo({ perfil, hoy, alSalir }: { perfil: Perfil; hoy: string; alSalir: () => void }) {
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [registros, setRegistros] = useState<RegistroAdmin[]>([]);
  const [pendientes, setPendientes] = useState<RegistroAdmin[]>([]);
  const [aviso, setAviso] = useState<{ tipo: 'error' | 'exito'; texto: string } | null>(null);
  const [negando, setNegando] = useState<{ codigo: string; motivo: string } | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc('registros_equipo', { p_mes: `${mes}-01` });
    if (error) { setAviso({ tipo: 'error', texto: mensajeDeError(error) }); return; }
    setRegistros(data.registros);
    setPendientes(data.pendientes);
  }, [mes]);

  useEffect(() => { void cargar(); }, [cargar]);

  async function decidir(codigos: string[], decision: 'aprobada' | 'negada', motivo?: string) {
    setTrabajando(true);
    const { error } = await supabase.rpc('decidir_registros', {
      p_codigos: codigos, p_decision: decision, p_motivo: motivo ?? null,
    });
    setTrabajando(false);
    if (error) setAviso({ tipo: 'error', texto: mensajeDeError(error) });
    else {
      setNegando(null);
      setAviso({ tipo: 'exito', texto: decision === 'aprobada'
        ? `Se aprobaron ${codigos.length} registro(s).`
        : `Se negó ${codigos[0]}. Sus horas quedaron libres.` });
    }
    await cargar();
  }

  const aprobados = registros.filter((r) => r.estado === 'registrada' && r.aprobacion === 'aprobada');
  const esDirector = perfil.rol === 'director';

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mi equipo</h1>
          <p className="mt-1 text-sm text-texto-suave">
            {perfil.nombre} · {esDirector ? 'Director' : 'Coordinador'}
          </p>
        </div>
        <Boton variante="borde" onClick={alSalir}>Salir</Boton>
      </div>

      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}

      <Tarjeta titulo={`Pendientes por decidir (${pendientes.length})`}
        descripcion="Vale la primera decisión, suya o de otro jefe de la línea. Si hay un error después, el administrador anula el registro."
        acciones={pendientes.length > 1 ? (
          <Boton disabled={trabajando} onClick={() => decidir(pendientes.map((r) => r.codigo), 'aprobada')}>
            Aprobar todos
          </Boton>
        ) : undefined}>
        {!pendientes.length ? <Vacio texto="No tiene registros pendientes." /> : (
          <TablaRegistros registros={pendientes} esDirector={esDirector} acciones={(r) => (
            negando?.codigo === r.codigo ? (
              <div className="flex min-w-56 flex-col gap-2">
                <input autoFocus aria-label="Motivo para negar" placeholder="Motivo" value={negando.motivo}
                  className={claseEntrada} onChange={(e) => setNegando({ codigo: r.codigo, motivo: e.target.value })} />
                <div className="flex gap-2">
                  <Boton variante="peligro" className="px-2 py-1" disabled={trabajando || !negando.motivo.trim()}
                    onClick={() => decidir([r.codigo], 'negada', negando.motivo)}>Confirmar</Boton>
                  <Boton variante="borde" className="px-2 py-1" onClick={() => setNegando(null)}>Cancelar</Boton>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Boton className="px-2 py-1" disabled={trabajando} onClick={() => decidir([r.codigo], 'aprobada')}>Aprobar</Boton>
                <Boton variante="peligro" className="px-2 py-1" disabled={trabajando}
                  onClick={() => setNegando({ codigo: r.codigo, motivo: '' })}>Negar</Boton>
              </div>
            )
          )} />
        )}
      </Tarjeta>

      <Tarjeta titulo="Registros del mes" descripcion={nombreMes(`${mes}-01`)}
        acciones={(
          <div className="flex flex-wrap items-end gap-3">
            <Campo etiqueta="Mes" htmlFor="mes-equipo">
              <input id="mes-equipo" type="month" value={mes} max={hoy.slice(0, 7)} className={claseEntrada}
                onChange={(e) => e.target.value && setMes(e.target.value)} />
            </Campo>
            <Boton disabled={!aprobados.length}
              onClick={() => descargarFormato(aprobados, `horas-extras-equipo-${mes}.xlsx`)}>
              Descargar Excel ({aprobados.length} aprobados)
            </Boton>
          </div>
        )}>
        {!registros.length ? <Vacio texto="No hay registros en este mes." />
          : <TablaRegistros registros={registros} esDirector={esDirector} />}
      </Tarjeta>

      {esDirector && <MisCoordinadores filialInicial={perfil.filial} />}
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return (
    <p className="rounded-lg border border-dashed border-borde py-8 text-center text-sm text-texto-suave">{texto}</p>
  );
}

function TablaRegistros({ registros, esDirector, acciones }: {
  registros: RegistroAdmin[];
  esDirector: boolean;
  acciones?: (registro: RegistroAdmin) => ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b border-borde text-xs uppercase tracking-wide text-texto-suave">
          <tr>
            <th className="px-3 py-2.5">Código</th>
            <th className="px-3 py-2.5">Fecha</th>
            <th className="px-3 py-2.5">Colega</th>
            {esDirector && <th className="px-3 py-2.5">Coordinador</th>}
            <th className="px-3 py-2.5">Horario</th>
            <th className="px-3 py-2.5">Total</th>
            <th className="px-3 py-2.5">Justificación</th>
            <th className="px-3 py-2.5">Estado</th>
            {acciones && <th className="px-3 py-2.5"><span className="sr-only">Acciones</span></th>}
          </tr>
        </thead>
        <tbody>
          {registros.map((r) => (
            <tr key={r.codigo} className="border-b border-borde align-top last:border-b-0 hover:bg-fondo">
              <td className="px-3 py-2.5 font-mono">{r.codigo}</td>
              <td className="px-3 py-2.5">
                {formatoFecha(r.fecha_horas_extras)}
                <div className="text-xs text-texto-suave">{NOMBRE_TIPO_DIA[r.tipo_dia]}</div>
              </td>
              <td className="px-3 py-2.5">
                {r.nombre_completo}
                <div className="text-xs text-texto-suave">{r.identificacion} · {r.filial}</div>
              </td>
              {esDirector && <td className="px-3 py-2.5">{r.coordinador ?? 'Sin coordinador'}</td>}
              <td className="px-3 py-2.5 whitespace-nowrap">
                {formatoHoraAmPm(r.hora_inicio)} – {formatoHoraAmPm(r.hora_final)}
              </td>
              <td className="px-3 py-2.5">{formatoDuracion(r.minutos_totales)}</td>
              <td className="max-w-64 px-3 py-2.5">{r.justificacion}</td>
              <td className="px-3 py-2.5">
                <InsigniaEstado estado={r.estado} aprobacion={r.aprobacion} />
                {(r.motivo_anulacion ?? r.motivo_decision) && (
                  <div className="mt-1 max-w-48 text-xs text-texto-suave">{r.motivo_anulacion ?? r.motivo_decision}</div>
                )}
                {r.decidido_por && <div className="mt-1 text-xs text-texto-suave">Por {r.decidido_por}</div>}
              </td>
              {acciones && <td className="px-3 py-2.5">{acciones(r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
