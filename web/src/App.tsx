import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { Aviso, Boton } from './componentes/ui';
import { hoyBogota } from './lib/fechas';
import { mensajeDeError, supabase } from './lib/supabase';
import type { Configuracion, Festivo, Usuario } from './lib/tipos';
import { Administracion } from './paginas/Administracion';
import { Login } from './paginas/Login';
import { RegistrarHoras } from './paginas/RegistrarHoras';
import { Registros } from './paginas/Registros';

type Pagina = 'registrar' | 'registros' | 'administracion';

interface DatosBase { config: Configuracion; festivos: Map<string, string> }

async function leerDatosBase(): Promise<DatosBase> {
  const [config, festivos] = await Promise.all([
    supabase.from('configuracion').select('clave, valor').returns<{ clave: string; valor: string }[]>(),
    supabase.from('festivos').select('fecha, nombre').returns<Festivo[]>(),
  ]);
  if (config.error) throw new Error(mensajeDeError(config.error));
  if (festivos.error) throw new Error(mensajeDeError(festivos.error));
  const valor = (clave: string) => config.data.find((c) => c.clave === clave)?.valor ?? '';
  return {
    config: {
      finJornada: valor('fin_jornada'),
      topeDiarioMin: Number(valor('tope_diario_min')),
      topeFinSemanaMin: Number(valor('tope_fin_semana_min')),
      topeSemanalMin: Number(valor('tope_semanal_min')),
    },
    festivos: new Map(festivos.data.map((f) => [f.fecha, f.nombre])),
  };
}

export function App() {
  const [sesion, setSesion] = useState<Session | null | undefined>(undefined);
  const [usuario, setUsuario] = useState<Usuario | null | undefined>(undefined);
  const [datosBase, setDatosBase] = useState<DatosBase | null>(null);
  const [error, setError] = useState('');
  const [pagina, setPagina] = useState<Pagina>('registrar');
  const hoy = hoyBogota();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session));
    const { data } = supabase.auth.onAuthStateChange((_evento, nueva) => setSesion(nueva));
    return () => data.subscription.unsubscribe();
  }, []);

  const recargarDatosBase = useCallback(() => {
    leerDatosBase().then(setDatosBase).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!sesion) { setUsuario(undefined); return; }
    supabase.from('usuarios').select('id, email, nombre, es_admin, activo')
      .eq('auth_id', sesion.user.id).eq('activo', true).maybeSingle<Usuario>()
      .then(({ data }) => setUsuario(data));
    recargarDatosBase();
  }, [sesion, recargarDatosBase]);

  if (sesion === undefined) return null;
  if (!sesion) return <Login />;

  const salir = () => supabase.auth.signOut();

  if (usuario === null) {
    return (
      <main className="mx-auto mt-16 max-w-md px-4">
        <Aviso tipo="error">Su correo no está habilitado para usar la aplicación. Pida acceso al administrador.</Aviso>
        <Boton variante="borde" className="mt-4" onClick={salir}>Salir</Boton>
      </main>
    );
  }

  const paginas: { id: Pagina; nombre: string }[] = [
    { id: 'registrar', nombre: 'Registrar horas' },
    { id: 'registros', nombre: 'Registros y Excel' },
    ...(usuario?.es_admin ? [{ id: 'administracion' as const, nombre: 'Administración' }] : []),
  ];

  return (
    <div className="min-h-screen">
      <header className="bg-primario text-blanco">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <h1 className="text-lg font-semibold">Horas extras</h1>
          <div className="flex items-center gap-3 text-sm">
            <span>{usuario?.nombre}</span>
            <button onClick={salir} className="rounded-md border border-blanco px-3 py-1 hover:bg-primario-hover">
              Salir
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
          {paginas.map((p) => (
            <button key={p.id} onClick={() => setPagina(p.id)} aria-current={pagina === p.id ? 'page' : undefined}
              className={`whitespace-nowrap rounded-t-md px-4 py-2 text-sm font-semibold
                ${pagina === p.id ? 'bg-fondo text-primario' : 'hover:bg-primario-hover'}`}>
              {p.nombre}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {error && <div className="mb-4"><Aviso tipo="error">{error}</Aviso></div>}
        {usuario && datosBase && (
          <>
            {pagina === 'registrar' && <RegistrarHoras hoy={hoy} {...datosBase} />}
            {pagina === 'registros' && <Registros hoy={hoy} />}
            {pagina === 'administracion' && <Administracion alCambiarDatosBase={recargarDatosBase} />}
          </>
        )}
      </main>
    </div>
  );
}
