import { useEffect, useState } from 'react';
import { Guia } from './componentes/Guia';
import { Aviso } from './componentes/ui';
import { hoyBogota, nombreMes } from './lib/fechas';
import { formatoHoraAmPm } from './lib/horas';
import { iniciales } from './lib/reglas';
import { guardarRegistros, leerRegistros } from './lib/registrosDeLaVentana';
import { mensajeDeError, supabase } from './lib/supabase';
import type { Configuracion, Festivo, JefeOpcion, Registro } from './lib/tipos';
import { Administracion } from './paginas/Administracion';
import { pasosGuiaRegistro } from './paginas/guiaRegistro';
import { MiEquipo } from './paginas/MiEquipo';
import { RegistrarHoras } from './paginas/RegistrarHoras';
import { RegistrosDeLaVentana } from './paginas/RegistrosDeLaVentana';

interface DatosBase { config: Configuracion; festivos: Map<string, string>; jefes: JefeOpcion[] }

async function leerDatosBase(): Promise<DatosBase> {
  const [config, festivos, jefes] = await Promise.all([
    supabase.from('configuracion').select('clave, valor').returns<{ clave: string; valor: string }[]>(),
    supabase.from('festivos').select('fecha, nombre').returns<Festivo[]>(),
    supabase.rpc('jefes_formulario'),
  ]);
  if (config.error) throw new Error(mensajeDeError(config.error));
  if (festivos.error) throw new Error(mensajeDeError(festivos.error));
  if (jefes.error) throw new Error(mensajeDeError(jefes.error));
  const valor = (clave: string) => config.data.find((c) => c.clave === clave)?.valor ?? '';
  return {
    config: {
      finJornada: valor('fin_jornada'),
      finJornadaViernes: valor('fin_jornada_viernes'),
      finJornadaSufi: valor('fin_jornada_sufi'),
      topeDiarioMin: Number(valor('tope_diario_min')),
      topeFinSemanaMin: Number(valor('tope_fin_semana_min')),
      topeSemanalMin: Number(valor('tope_semanal_min')),
    },
    festivos: new Map(festivos.data.map((f) => [f.fecha, f.nombre])),
    jefes: jefes.data as JefeOpcion[],
  };
}

const vistaDeLaDireccion = () => (location.hash === '#admin' ? 'admin' : location.hash === '#equipo' ? 'equipo' : 'registro');

export function App() {
  const [datosBase, setDatosBase] = useState<DatosBase | null>(null);
  const [error, setError] = useState('');
  const [registros, setRegistros] = useState<Registro[]>(leerRegistros);
  const hoy = hoyBogota();

  useEffect(() => {
    leerDatosBase().then(setDatosBase).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => { guardarRegistros(registros); }, [registros]);

  // Jefe con la sesión abierta, para mostrarlo en el encabezado.
  const [jefe, setJefe] = useState<{ nombre: string } | null>(null);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      if (!sesion) { setJefe(null); return; }
      // Fuera del callback: supabase-js no admite otra llamada a la API dentro de él.
      setTimeout(async () => {
        const { data: perfil } = await supabase.rpc('mi_perfil');
        setJefe(perfil ?? null);
      });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // La decisión del jefe llega desde la base: al abrir la página y al volver a la pestaña.
  useEffect(() => {
    async function actualizarEstados() {
      const vigentes = leerRegistros().filter((r) => r.estado === 'registrada');
      if (!vigentes.length) return;
      const { data, error } = await supabase.rpc('estado_en_la_ventana', {
        p_registros: vigentes.map((r) => ({ id: r.id, clave: r.clave_anulacion })),
      });
      // Si falla, la lista sigue con el último estado conocido.
      if (error) return;
      const porId = new Map((data as Pick<Registro, 'id' | 'estado' | 'aprobacion'>[]).map((d) => [d.id, d]));
      setRegistros((lista) => lista.map((r) => {
        const actual = porId.get(r.id);
        return actual ? { ...r, estado: actual.estado, aprobacion: actual.aprobacion } : r;
      }));
    }
    void actualizarEstados();
    window.addEventListener('focus', actualizarEstados);
    return () => window.removeEventListener('focus', actualizarEstados);
  }, []);

  // Sin router: #admin abre la administración, #equipo la de los jefes y cualquier otra, el registro.
  const [vista, setVista] = useState(vistaDeLaDireccion);
  const [conGuia, setConGuia] = useState(false);
  useEffect(() => {
    const alCambiar = () => setVista(vistaDeLaDireccion());
    window.addEventListener('hashchange', alCambiar);
    return () => window.removeEventListener('hashchange', alCambiar);
  }, []);

  return (
    <div className="min-h-screen">
      <header className="border-b border-borde bg-blanco">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid size-9 place-items-center rounded-lg bg-primario text-sm font-bold text-blanco">
              {jefe ? iniciales(jefe.nombre) : 'HE'}
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Horas extras</p>
              <p className="text-xs text-texto-suave">{jefe ? jefe.nombre : 'Cuenta Bancolombia'}</p>
            </div>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            <span className="hidden rounded-full bg-suave px-3 py-1 text-xs font-medium text-primario first-letter:uppercase sm:inline">
              {nombreMes(hoy)}
            </span>
            {vista === 'registro' && datosBase && (
              <button type="button" onClick={() => setConGuia(true)} aria-label="Ayuda: cómo funciona la página"
                className="flex items-center gap-2 rounded-md border border-borde bg-blanco px-3 py-2 text-sm
                  font-semibold text-primario transition-colors hover:bg-suave">
                <span aria-hidden className="grid size-5 place-items-center rounded-full bg-primario text-xs
                  text-blanco">?</span>
                Ayuda
              </button>
            )}
            {vista !== 'registro' ? (
              <a href="#" className="rounded-md bg-primario px-4 py-2 text-sm font-semibold text-blanco transition-colors hover:bg-primario-hover">
                ← Volver al registro
              </a>
            ) : (
              <>
                <a href="#equipo" className="rounded-md border border-borde bg-blanco px-4 py-2 text-sm font-semibold text-primario transition-colors hover:bg-suave">
                  Mi equipo
                </a>
                <a href="#admin" className="rounded-md bg-primario px-4 py-2 text-sm font-semibold text-blanco transition-colors hover:bg-primario-hover">
                  Administración
                </a>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
        {vista === 'admin' && <Administracion hoy={hoy} festivos={new Set(datosBase?.festivos.keys())} />}
        {vista === 'equipo' && <MiEquipo hoy={hoy} />}
        {vista === 'registro' && (
          <>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Registrar horas extras</h1>
              {datosBase && <ReglasEnBreve config={datosBase.config} />}
            </div>
            {error && <Aviso tipo="error">{error}</Aviso>}
            {datosBase && (
              <RegistrarHoras hoy={hoy} {...datosBase}
                alRegistrar={(nuevo) => setRegistros((lista) => [...lista, nuevo])} />
            )}
            <RegistrosDeLaVentana registros={registros}
              alAnular={(id) => setRegistros((lista) =>
                lista.map((r) => (r.id === id ? { ...r, estado: 'anulada' } : r)))} />
          </>
        )}
      </main>
      {conGuia && datosBase && (
        <Guia pasos={pasosGuiaRegistro(datosBase.config)} alCerrar={() => setConGuia(false)} />
      )}
    </div>
  );
}

const enHoras = (minutos: number) => `${(minutos / 60).toLocaleString('es-CO')} horas`;

function ReglasEnBreve({ config }: { config: Configuracion }) {
  const reglas = [
    `Máximo ${enHoras(config.topeDiarioMin)} por día y ${enHoras(config.topeSemanalMin)} por semana`,
    `Lunes a jueves desde las ${formatoHoraAmPm(config.finJornada)}; viernes desde las ${formatoHoraAmPm(config.finJornadaViernes)}`,
    'Domingo solo en Sufi, si se descansa el sábado; festivo solo si no se trabajó ese fin de semana',
    `Sufi: se marca la jornada, hasta las ${formatoHoraAmPm(config.finJornadaSufi)}, y el total de horas extras`,
  ];
  return (
    <ul className="mt-3 flex flex-wrap gap-2 text-xs text-texto-suave">
      {reglas.map((r) => (
        <li key={r} className="rounded-full border border-borde bg-blanco px-3 py-1">{r}</li>
      ))}
    </ul>
  );
}
