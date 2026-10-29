import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Aviso, Boton, Campo, claseEntrada, Tarjeta } from '../componentes/ui';
import { formatoFecha } from '../lib/fechas';
import { mensajeDeError, supabase } from '../lib/supabase';
import type { Festivo, Usuario } from '../lib/tipos';

interface ValorConfig { clave: string; valor: string; descripcion: string }

export function Administracion({ alCambiarDatosBase }: { alCambiarDatosBase: () => void }) {
  const [error, setError] = useState('');
  return (
    <div className="flex flex-col gap-6">
      {error && <Aviso tipo="error">{error}</Aviso>}
      <Usuarios alError={setError} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Festivos alError={setError} alCambiar={alCambiarDatosBase} />
        <ConfiguracionGeneral alError={setError} alCambiar={alCambiarDatosBase} />
      </div>
    </div>
  );
}

function Usuarios({ alError }: { alError: (m: string) => void }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [nuevo, setNuevo] = useState({ email: '', nombre: '', es_admin: false });

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('usuarios')
      .select('id, email, nombre, es_admin, activo').order('nombre').returns<Usuario[]>();
    if (error) alError(mensajeDeError(error)); else setUsuarios(data);
  }, [alError]);

  useEffect(() => { cargar(); }, [cargar]);

  async function crear(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('usuarios').insert({
      email: nuevo.email.trim().toLowerCase(), nombre: nuevo.nombre.trim(), es_admin: nuevo.es_admin,
    });
    if (error) {
      alError(error.code === '23505' ? 'Ese correo ya está registrado.' : mensajeDeError(error));
      return;
    }
    alError('');
    setNuevo({ email: '', nombre: '', es_admin: false });
    cargar();
  }

  async function actualizar(id: string, cambios: Partial<Pick<Usuario, 'activo' | 'es_admin'>>) {
    const { error } = await supabase.from('usuarios').update(cambios).eq('id', id);
    if (error) alError(mensajeDeError(error)); else cargar();
  }

  return (
    <Tarjeta titulo="Usuarios que pueden entrar">
      <form onSubmit={crear} className="mb-4 grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
        <Campo etiqueta="Correo" htmlFor="nuevo-email">
          <input id="nuevo-email" type="email" required value={nuevo.email} className={claseEntrada}
            onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} />
        </Campo>
        <Campo etiqueta="Nombre" htmlFor="nuevo-nombre">
          <input id="nuevo-nombre" required value={nuevo.nombre} className={claseEntrada}
            onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
        </Campo>
        <label className="flex items-center gap-2 py-2 text-sm">
          <input type="checkbox" checked={nuevo.es_admin} className="accent-primario"
            onChange={(e) => setNuevo({ ...nuevo, es_admin: e.target.checked })} />
          Administrador
        </label>
        <Boton type="submit" disabled={!nuevo.email.trim() || !nuevo.nombre.trim()}>Agregar</Boton>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-borde text-texto-suave">
            <tr><th className="p-2">Nombre</th><th className="p-2">Correo</th><th className="p-2">Administrador</th><th className="p-2">Activo</th></tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-b border-borde">
                <td className="p-2">{u.nombre}</td>
                <td className="p-2">{u.email}</td>
                <td className="p-2">
                  <input type="checkbox" aria-label={`Administrador: ${u.nombre}`} checked={u.es_admin}
                    className="accent-primario" onChange={(e) => actualizar(u.id, { es_admin: e.target.checked })} />
                </td>
                <td className="p-2">
                  <input type="checkbox" aria-label={`Activo: ${u.nombre}`} checked={u.activo}
                    className="accent-primario" onChange={(e) => actualizar(u.id, { activo: e.target.checked })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Tarjeta>
  );
}

function Festivos({ alError, alCambiar }: { alError: (m: string) => void; alCambiar: () => void }) {
  const [festivos, setFestivos] = useState<Festivo[]>([]);
  const [nuevo, setNuevo] = useState({ fecha: '', nombre: '' });

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('festivos').select('fecha, nombre').order('fecha')
      .returns<Festivo[]>();
    if (error) alError(mensajeDeError(error)); else setFestivos(data);
  }, [alError]);

  useEffect(() => { cargar(); }, [cargar]);

  async function crear(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('festivos').insert({ fecha: nuevo.fecha, nombre: nuevo.nombre.trim() });
    if (error) {
      alError(error.code === '23505' ? 'Esa fecha ya está como festivo.' : mensajeDeError(error));
      return;
    }
    setNuevo({ fecha: '', nombre: '' });
    cargar();
    alCambiar();
  }

  async function quitar(fecha: string) {
    const { error } = await supabase.from('festivos').delete().eq('fecha', fecha);
    if (error) alError(mensajeDeError(error));
    else { cargar(); alCambiar(); }
  }

  return (
    <Tarjeta titulo="Festivos">
      <form onSubmit={crear} className="mb-4 grid items-end gap-3 sm:grid-cols-[auto_1fr_auto]">
        <Campo etiqueta="Fecha" htmlFor="festivo-fecha">
          <input id="festivo-fecha" type="date" required value={nuevo.fecha} className={claseEntrada}
            onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })} />
        </Campo>
        <Campo etiqueta="Nombre" htmlFor="festivo-nombre">
          <input id="festivo-nombre" required value={nuevo.nombre} className={claseEntrada}
            onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
        </Campo>
        <Boton type="submit" disabled={!nuevo.fecha || !nuevo.nombre.trim()}>Agregar</Boton>
      </form>
      <ul className="max-h-96 divide-y divide-borde overflow-y-auto text-sm">
        {festivos.map((f) => (
          <li key={f.fecha} className="flex items-center justify-between gap-2 py-2">
            <span><span className="font-mono">{formatoFecha(f.fecha)}</span> · {f.nombre}</span>
            <Boton variante="peligro" className="px-2 py-1" onClick={() => quitar(f.fecha)}>Quitar</Boton>
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}

function ConfiguracionGeneral({ alError, alCambiar }: { alError: (m: string) => void; alCambiar: () => void }) {
  const [valores, setValores] = useState<ValorConfig[]>([]);
  const [guardado, setGuardado] = useState('');

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('configuracion').select('clave, valor, descripcion')
      .order('clave').returns<ValorConfig[]>();
    if (error) alError(mensajeDeError(error)); else setValores(data);
  }, [alError]);

  useEffect(() => { cargar(); }, [cargar]);

  async function guardar(clave: string, valor: string) {
    const { error } = await supabase.from('configuracion').update({ valor: valor.trim() }).eq('clave', clave);
    if (error) { alError(mensajeDeError(error)); return; }
    setGuardado(clave);
    alCambiar();
  }

  return (
    <Tarjeta titulo="Configuración">
      <div className="flex flex-col gap-4">
        {valores.map((v) => (
          <Campo key={v.clave} etiqueta={v.descripcion} htmlFor={v.clave}
            ayuda={guardado === v.clave ? 'Guardado.' : v.clave === 'fin_jornada' ? 'Formato HH:MM (24 horas).' : 'En minutos (120 = 2:00 horas).'}>
            <div className="flex gap-2">
              <input id={v.clave} value={v.valor} className={claseEntrada}
                onChange={(e) => setValores(valores.map((x) => (x.clave === v.clave ? { ...x, valor: e.target.value } : x)))} />
              <Boton variante="secundario" onClick={() => guardar(v.clave, v.valor)}>Guardar</Boton>
            </div>
          </Campo>
        ))}
      </div>
    </Tarjeta>
  );
}
