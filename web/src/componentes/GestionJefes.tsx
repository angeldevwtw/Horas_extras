import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { mensajeDeError, supabase } from '../lib/supabase';
import type { JefeAdmin, RolJefe } from '../lib/tipos';
import { SelectFilial } from './SelectFilial';
import { Aviso, Boton, Campo, claseEntrada, Tarjeta } from './ui';

const VACIO = { nombre: '', correo: '', rol: 'coordinador' as RolJefe, director: '', filial: null as string | null };

/** Lista de directores y coordinadores del super admin. Las cuentas se crean en Supabase. */
export function GestionJefes({ clave }: { clave: string }) {
  const [jefes, setJefes] = useState<JefeAdmin[]>([]);
  const [nuevo, setNuevo] = useState(VACIO);
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState(false);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc('jefes_admin', { p_clave: clave });
    if (error || !data.ok) { setError(error ? mensajeDeError(error) : data.mensaje); return; }
    setJefes(data.jefes);
  }, [clave]);

  useEffect(() => { void cargar(); }, [cargar]);

  async function guardar(id: string | null, nombre: string, correo: string, rol: RolJefe, director: string | null, activo: boolean, filial: string | null) {
    setTrabajando(true);
    const { data, error } = await supabase.rpc('guardar_jefe_admin', {
      p_clave: clave, p_id: id, p_nombre: nombre, p_correo: correo, p_rol: rol,
      p_director: director, p_activo: activo, p_filial: filial,
    });
    setTrabajando(false);
    if (error || !data.ok) { setError(error ? mensajeDeError(error) : data.mensaje); return false; }
    setError('');
    await cargar();
    return true;
  }

  async function agregar(e: FormEvent) {
    e.preventDefault();
    const { nombre, correo, rol, director, filial } = nuevo;
    if (await guardar(null, nombre, correo, rol, rol === 'coordinador' ? director : null, true, filial)) setNuevo(VACIO);
  }

  const directores = jefes.filter((j) => j.rol === 'director' && j.activo);
  const nombreDe = (id: string | null) => jefes.find((j) => j.id === id)?.nombre ?? '—';

  return (
    <Tarjeta titulo="Directores y coordinadores"
      descripcion="Cada jefe entra a Mi equipo con el correo de esta lista. Su cuenta se crea en Supabase: Authentication → Users → Add user, con ese mismo correo y confirmado.">
      {error && <div className="mb-4"><Aviso tipo="error">{error}</Aviso></div>}

      <form onSubmit={agregar} className="mb-6 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Campo etiqueta="Nombre" htmlFor="jefe-nombre">
          <input id="jefe-nombre" required value={nuevo.nombre} className={claseEntrada}
            onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
        </Campo>
        <Campo etiqueta="Correo" htmlFor="jefe-correo">
          <input id="jefe-correo" type="email" required value={nuevo.correo} className={claseEntrada}
            onChange={(e) => setNuevo({ ...nuevo, correo: e.target.value })} />
        </Campo>
        <Campo etiqueta="Rol" htmlFor="jefe-rol">
          <select id="jefe-rol" value={nuevo.rol} className={claseEntrada}
            onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value as RolJefe })}>
            <option value="coordinador">Coordinador</option>
            <option value="director">Director</option>
          </select>
        </Campo>
        <Campo etiqueta="Su director" htmlFor="jefe-director">
          <select id="jefe-director" value={nuevo.director} disabled={nuevo.rol === 'director'} className={claseEntrada}
            onChange={(e) => setNuevo({ ...nuevo, director: e.target.value })}>
            <option value="">{nuevo.rol === 'director' ? 'No aplica' : 'Seleccione…'}</option>
            {directores.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Filial" htmlFor="jefe-filial">
          <SelectFilial id="jefe-filial" valor={nuevo.filial} alCambiar={(filial) => setNuevo({ ...nuevo, filial })} />
        </Campo>
        <Boton type="submit" disabled={trabajando || (nuevo.rol === 'coordinador' && !nuevo.director)}>Agregar</Boton>
      </form>

      {!!jefes.length && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-borde text-xs uppercase tracking-wide text-texto-suave">
              <tr>
                <th className="px-3 py-2.5">Nombre</th>
                <th className="px-3 py-2.5">Correo</th>
                <th className="px-3 py-2.5">Rol</th>
                <th className="px-3 py-2.5">Su director</th>
                <th className="px-3 py-2.5">Filial</th>
                <th className="px-3 py-2.5">Cuenta</th>
                <th className="px-3 py-2.5"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {jefes.map((j) => (
                <tr key={j.id} className={`border-b border-borde last:border-b-0 ${j.activo ? '' : 'text-texto-suave'}`}>
                  <td className="px-3 py-2.5">{j.nombre}</td>
                  <td className="px-3 py-2.5">{j.correo}</td>
                  <td className="px-3 py-2.5 first-letter:uppercase">{j.rol}</td>
                  <td className="px-3 py-2.5">{nombreDe(j.director_id)}</td>
                  <td className="px-3 py-2.5">
                    <SelectFilial etiqueta={`Filial de ${j.nombre}`} valor={j.filial} deshabilitado={trabajando}
                      alCambiar={(filial) => guardar(j.id, j.nombre, j.correo, j.rol, j.director_id, j.activo, filial)} />
                  </td>
                  <td className="px-3 py-2.5">{j.tiene_cuenta ? 'Creada' : 'Falta crearla'}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Boton variante={j.activo ? 'peligro' : 'borde'} className="px-2 py-1" disabled={trabajando}
                      onClick={() => guardar(j.id, j.nombre, j.correo, j.rol, j.director_id, !j.activo, j.filial)}>
                      {j.activo ? 'Desactivar' : 'Activar'}
                    </Boton>
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
