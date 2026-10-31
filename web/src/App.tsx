import { useEffect, useState } from 'react';
import { Guia } from './componentes/Guia';
import { Aviso } from './componentes/ui';
import { hoyBogota, nombreMes } from './lib/fechas';
import { formatoDuracion, formatoHoraAmPm } from './lib/horas';
import { guardarRegistros, leerRegistros } from './lib/registrosDeLaVentana';
import { mensajeDeError, supabase } from './lib/supabase';
import type { Configuracion, Festivo, Registro } from './lib/tipos';
import { Administracion } from './paginas/Administracion';
import { pasosGuiaRegistro } from './paginas/guiaRegistro';
import { RegistrarHoras } from './paginas/RegistrarHoras';
import { RegistrosDeLaVentana } from './paginas/RegistrosDeLaVentana';

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
      finJornadaViernes: valor('fin_jornada_viernes'),
      topeDiarioMin: Number(valor('tope_diario_min')),
      topeFinSemanaMin: Number(valor('tope_fin_semana_min')),
      topeSemanalMin: Number(valor('tope_semanal_min')),
    },
    festivos: new Map(festivos.data.map((f) => [f.fecha, f.nombre])),
  };
}

export function App() {
  const [datosBase, setDatosBase] = useState<DatosBase | null>(null);
  const [error, setError] = useState('');
  const [registros, setRegistros] = useState<Registro[]>(leerRegistros);
  const hoy = hoyBogota();

  useEffect(() => {
    leerDatosBase().then(setDatosBase).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => { guardarRegistros(registros); }, [registros]);

  // Sin router: #admin abre la administración y cualquier otra dirección, el registro.
  const [enAdmin, setEnAdmin] = useState(() => location.hash === '#admin');
  const [conGuia, setConGuia] = useState(false);
  useEffect(() => {
    const alCambiar = () => setEnAdmin(location.hash === '#admin');
    window.addEventListener('hashchange', alCambiar);
    return () => window.removeEventListener('hashchange', alCambiar);
  }, []);

  return (
    <div className="min-h-screen">
      <header className="border-b border-borde bg-blanco">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid size-9 place-items-center rounded-lg bg-primario text-sm font-bold text-blanco">
              HE
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Horas extras</p>
              <p className="text-xs text-texto-suave">Cuenta Bancolombia</p>
            </div>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            <span className="hidden rounded-full bg-suave px-3 py-1 text-xs font-medium text-primario first-letter:uppercase sm:inline">
              {nombreMes(hoy)}
            </span>
            {!enAdmin && datosBase && (
              <button type="button" onClick={() => setConGuia(true)} aria-label="Ayuda: cómo funciona la página"
                className="flex items-center gap-2 rounded-md border border-borde bg-blanco px-3 py-2 text-sm
                  font-semibold text-primario transition-colors hover:bg-suave">
                <span aria-hidden className="grid size-5 place-items-center rounded-full bg-primario text-xs
                  text-blanco">?</span>
                Ayuda
              </button>
            )}
            <a href={enAdmin ? '#' : '#admin'}
              className="rounded-md bg-primario px-4 py-2 text-sm font-semibold text-blanco transition-colors hover:bg-primario-hover">
              {enAdmin ? '← Volver al registro' : 'Administración'}
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
        {enAdmin ? <Administracion hoy={hoy} festivos={new Set(datosBase?.festivos.keys())} /> : (
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
            <RegistrosDeLaVentana registros={registros} hoy={hoy}
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

function ReglasEnBreve({ config }: { config: Configuracion }) {
  const reglas = [
    `Máximo ${formatoDuracion(config.topeDiarioMin)} por día y ${formatoDuracion(config.topeSemanalMin)} por semana`,
    `Lunes a jueves desde las ${formatoHoraAmPm(config.finJornada)}; viernes desde las ${formatoHoraAmPm(config.finJornadaViernes)}`,
    'Festivos solo si no se trabajó el sábado; domingos no',
  ];
  return (
    <ul className="mt-3 flex flex-wrap gap-2 text-xs text-texto-suave">
      {reglas.map((r) => (
        <li key={r} className="rounded-full border border-borde bg-blanco px-3 py-1">{r}</li>
      ))}
    </ul>
  );
}
