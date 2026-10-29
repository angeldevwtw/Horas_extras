import { useEffect, useState } from 'react';
import { Aviso } from './componentes/ui';
import { hoyBogota } from './lib/fechas';
import { guardarRegistros, leerRegistros } from './lib/registrosDeLaVentana';
import { mensajeDeError, supabase } from './lib/supabase';
import type { Configuracion, Festivo, Registro } from './lib/tipos';
import { DescargaConsolidada } from './paginas/DescargaConsolidada';
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

  return (
    <div className="min-h-screen">
      <header className="bg-primario text-blanco">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <h1 className="text-lg font-semibold">Registro de horas extras</h1>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        {error && <Aviso tipo="error">{error}</Aviso>}
        {datosBase && (
          <RegistrarHoras hoy={hoy} {...datosBase}
            alRegistrar={(nuevo) => setRegistros((lista) => [...lista, nuevo])} />
        )}
        <RegistrosDeLaVentana registros={registros} hoy={hoy}
          alAnular={(id) => setRegistros((lista) =>
            lista.map((r) => (r.id === id ? { ...r, estado: 'anulada' } : r)))} />
        <DescargaConsolidada hoy={hoy} />
      </main>
    </div>
  );
}
