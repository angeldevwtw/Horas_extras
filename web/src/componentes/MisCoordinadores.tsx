import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react';
import { mensajeDeError, supabase } from '../lib/supabase';
import type { JefeAdmin } from '../lib/tipos';
import { SelectFilial } from './SelectFilial';
import { Aviso, Boton, Campo, claseEntrada, Tarjeta } from './ui';

type Coordinador = Pick<JefeAdmin, 'id' | 'nombre' | 'correo' | 'filial' | 'activo' | 'tiene_cuenta'>;

const VACIO = { nombre: '', correo: '', filial: null as string | null };

/** Coordinadores, filiales y contraseñas de la línea del director. */
export function MisCoordinadores({ filialInicial }: { filialInicial: string | null }) {
  const [coordinadores, setCoordinadores] = useState<Coordinador[]>([]);
  const [miFilial, setMiFilial] = useState(filialInicial);
  const [nuevo, setNuevo] = useState(VACIO);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [claveDe, setClaveDe] = useState<string | null>(null);
  const [clave, setClave] = useState('');
  const [trabajando, setTrabajando] = useState(false);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc('mis_coordinadores');
    if (error) { setError(mensajeDeError(error)); return; }
    setCoordinadores(data);
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  async function guardar(id: string | null, nombre: string, correo: string, activo: boolean, filial: string | null) {
    setTrabajando(true);
    const { data, error } = await supabase.rpc('guardar_coordinador', {
      p_id: id, p_nombre: nombre, p_correo: correo, p_activo: activo, p_filial: filial,
    });
    setTrabajando(false);
    if (error || !data.ok) { setError(error ? mensajeDeError(error) : data.mensaje); return false; }
    setError('');
    setExito('');
    await cargar();
    return true;
  }

  async function agregar(e: FormEvent) {
    e.preventDefault();
    if (await guardar(null, nuevo.nombre, nuevo.correo, true, nuevo.filial)) setNuevo(VACIO);
  }

  async function asignarClave(e: FormEvent, coordinador: Coordinador) {
    e.preventDefault();
    setTrabajando(true);
    const { data: { session } } = await supabase.auth.getSession();
    const respuesta = await fetch('/api/contrasena-coordinador', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ id: coordinador.id, contrasena: clave }),
    }).catch(() => null);
    const data = await respuesta?.json().catch(() => null);
    setTrabajando(false);
    if (!data?.ok) { setError(data?.mensaje ?? mensajeDeError(null)); return; }
    setError('');
    setExito(`Contraseña asignada a ${coordinador.nombre}. Entréguesela por un canal privado.`);
    setClaveDe(null);
    setClave('');
    await cargar();
  }

  async function cambiarMiFilial(filial: string | null) {
    setTrabajando(true);
    const { data, error } = await supabase.rpc('guardar_mi_filial', { p_filial: filial });
    setTrabajando(false);
    if (error || !data.ok) { setError(error ? mensajeDeError(error) : data.mensaje); return; }
    setError('');
    setMiFilial(filial);
  }

  return (
    <Tarjeta titulo="Mis coordinadores"
      descripcion="Cada jefe sale en el formulario solo para su filial. Para entrar a Mi equipo, asigne a cada coordinador una contraseña; entra con su correo y esa contraseña.">
      {error && <div className="mb-4"><Aviso tipo="error">{error}</Aviso></div>}
      {exito && <div className="mb-4"><Aviso tipo="exito">{exito}</Aviso></div>}

      <div className="mb-6 max-w-xs">
        <Campo etiqueta="Mi filial" htmlFor="mi-filial">
          <SelectFilial id="mi-filial" valor={miFilial} deshabilitado={trabajando} alCambiar={cambiarMiFilial} />
        </Campo>
      </div>

      <form onSubmit={agregar} className="mb-6 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <Campo etiqueta="Nombre" htmlFor="coordinador-nombre">
          <input id="coordinador-nombre" required value={nuevo.nombre} className={claseEntrada}
            onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
        </Campo>
        <Campo etiqueta="Correo" htmlFor="coordinador-correo">
          <input id="coordinador-correo" type="email" required value={nuevo.correo} className={claseEntrada}
            onChange={(e) => setNuevo({ ...nuevo, correo: e.target.value })} />
        </Campo>
        <Campo etiqueta="Filial" htmlFor="coordinador-filial">
          <SelectFilial id="coordinador-filial" valor={nuevo.filial}
            alCambiar={(filial) => setNuevo({ ...nuevo, filial })} />
        </Campo>
        <Boton type="submit" disabled={trabajando}>Agregar</Boton>
      </form>

      {!!coordinadores.length && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-borde text-xs uppercase tracking-wide text-texto-suave">
              <tr>
                <th className="px-3 py-2.5">Nombre</th>
                <th className="px-3 py-2.5">Correo</th>
                <th className="px-3 py-2.5">Filial</th>
                <th className="px-3 py-2.5">Cuenta</th>
                <th className="px-3 py-2.5"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {coordinadores.map((c) => (
                <Fragment key={c.id}>
                <tr className={`border-b border-borde last:border-b-0 ${c.activo ? '' : 'text-texto-suave'}`}>
                  <td className="px-3 py-2.5">{c.nombre}</td>
                  <td className="px-3 py-2.5">{c.correo}</td>
                  <td className="px-3 py-2.5">
                    <SelectFilial etiqueta={`Filial de ${c.nombre}`} valor={c.filial} deshabilitado={trabajando}
                      alCambiar={(filial) => guardar(c.id, c.nombre, c.correo, c.activo, filial)} />
                  </td>
                  <td className="px-3 py-2.5">{c.tiene_cuenta ? 'Creada' : 'Falta crearla'}</td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex justify-end gap-2">
                      {c.activo && (
                        <Boton variante="borde" className="px-2 py-1" disabled={trabajando}
                          onClick={() => { setClaveDe(claveDe === c.id ? null : c.id); setClave(''); }}>
                          {c.tiene_cuenta ? 'Cambiar contraseña' : 'Asignar contraseña'}
                        </Boton>
                      )}
                      <Boton variante={c.activo ? 'peligro' : 'borde'} className="px-2 py-1" disabled={trabajando}
                        onClick={() => guardar(c.id, c.nombre, c.correo, !c.activo, c.filial)}>
                        {c.activo ? 'Desactivar' : 'Activar'}
                      </Boton>
                    </div>
                  </td>
                </tr>
                {claveDe === c.id && (
                  <tr className="border-b border-borde">
                    <td colSpan={5} className="px-3 py-3">
                      <form onSubmit={(e) => asignarClave(e, c)} className="flex flex-wrap items-end gap-3">
                        <Campo etiqueta={`Nueva contraseña de ${c.nombre}`} htmlFor={`clave-${c.id}`}>
                          <input id={`clave-${c.id}`} type="password" required minLength={8} autoFocus
                            autoComplete="new-password" value={clave} className={claseEntrada}
                            onChange={(e) => setClave(e.target.value)} />
                        </Campo>
                        <Boton type="submit" disabled={trabajando || clave.length < 8}>Guardar</Boton>
                        <Boton type="button" variante="borde" onClick={() => { setClaveDe(null); setClave(''); }}>
                          Cancelar
                        </Boton>
                        <span className="text-xs text-texto-suave">
                          Mínimo 8 caracteres.{c.tiene_cuenta && ' Cierra las sesiones que tenga abiertas.'}
                        </span>
                      </form>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Tarjeta>
  );
}
