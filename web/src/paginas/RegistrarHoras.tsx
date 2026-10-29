import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarioMes } from '../componentes/CalendarioMes';
import { ContadorSemana } from '../componentes/ContadorSemana';
import { Aviso, Boton, Campo, claseEntrada, Tarjeta } from '../componentes/ui';
import { formatoFecha, NOMBRE_TIPO_DIA, tipoDia } from '../lib/fechas';
import { formatoDuracion, formatoHoraAmPm, minutosEntre, opcionesDeHora } from '../lib/horas';
import { erroresLocales, NIVELES, type Campo as NombreCampo, type DatosRegistro, type Errores } from '../lib/reglas';
import { mensajeDeError, supabase } from '../lib/supabase';
import type { Configuracion, Registro } from '../lib/tipos';

const VACIO: DatosRegistro = {
  identificacion: '', nombre_completo: '', cargo: '', nivel: null, filial: '',
  fecha_horas_extras: '', hora_inicio: '', hora_final: '', justificacion: '',
};

const HORAS = opcionesDeHora();

export function RegistrarHoras({ hoy, config, festivos, alRegistrar }: {
  hoy: string;
  alRegistrar: (registro: Registro) => void;
  config: Configuracion;
  festivos: Map<string, string>;
}) {
  const [datos, setDatos] = useState<DatosRegistro>(VACIO);
  const [tocados, setTocados] = useState<Set<NombreCampo>>(new Set());
  const [erroresServidor, setErroresServidor] = useState<Errores>({});
  const [revisando, setRevisando] = useState(false);
  const [semana, setSemana] = useState<{ minutos: number; lunes: string; domingo: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<{ tipo: 'error' | 'exito'; texto: string } | null>(null);

  const fechasFestivas = useMemo(() => new Set(festivos.keys()), [festivos]);
  const tipo = datos.fecha_horas_extras ? tipoDia(datos.fecha_horas_extras, fechasFestivas) : null;
  const topeDia = tipo === 'habil' ? config.topeDiarioMin : config.topeFinSemanaMin;
  const minutos = datos.hora_inicio && datos.hora_final
    ? Math.max(0, minutosEntre(datos.hora_inicio, datos.hora_final)) : 0;

  const erroresLocal = erroresLocales(datos, { hoy, festivos: fechasFestivas, ...config });
  const errores: Errores = { ...erroresServidor, ...erroresLocal };
  const hayErrores = Object.keys(errores).length > 0;
  const identificacionValida = !erroresLocal.identificacion;

  const opcionesFinal = datos.hora_inicio
    ? HORAS.filter((h) => {
      const despues = minutosEntre(datos.hora_inicio, h);
      return despues > 0 && despues <= topeDia;
    })
    : [];

  function cambiar<K extends keyof DatosRegistro>(campo: K, valor: DatosRegistro[K]) {
    setDatos((d) => ({ ...d, [campo]: valor }));
    setTocados((t) => new Set(t).add(campo));
    setResultado(null);
  }

  function elegirFecha(fecha: string) {
    const esHabil = tipoDia(fecha, fechasFestivas) === 'habil';
    setDatos((d) => {
      const inicio = esHabil ? config.finJornada : d.hora_inicio;
      const tope = esHabil ? config.topeDiarioMin : config.topeFinSemanaMin;
      const finalValido = inicio && d.hora_final
        && minutosEntre(inicio, d.hora_final) > 0 && minutosEntre(inicio, d.hora_final) <= tope;
      return { ...d, fecha_horas_extras: fecha, hora_inicio: inicio, hora_final: finalValido ? d.hora_final : '' };
    });
    setTocados((t) => new Set(t).add('fecha_horas_extras'));
    setResultado(null);
  }

  useEffect(() => {
    setSemana(null);
    if (!identificacionValida || !datos.fecha_horas_extras) return;
    const espera = setTimeout(async () => {
      const { data } = await supabase.rpc('resumen_colega', {
        p_identificacion: datos.identificacion, p_fecha: datos.fecha_horas_extras,
      });
      const fila = data?.[0];
      if (fila) setSemana({ minutos: fila.minutos_semana, lunes: fila.lunes, domingo: fila.domingo });
    }, 300);
    return () => clearTimeout(espera);
  }, [datos.identificacion, datos.fecha_horas_extras, identificacionValida]);

  // Las reglas que dependen de otros registros (tope semanal, descanso, cruces) las revisa la base.
  const sinErroresLocales = Object.keys(erroresLocal).length === 0;
  useEffect(() => {
    setErroresServidor({});
    if (!sinErroresLocales) return;
    setRevisando(true);
    const espera = setTimeout(async () => {
      const { data, error } = await supabase.rpc('revisar_registro', {
        p_identificacion: datos.identificacion,
        p_nivel: datos.nivel,
        p_fecha: datos.fecha_horas_extras,
        p_hora_inicio: datos.hora_inicio,
        p_hora_final: datos.hora_final,
        p_justificacion: datos.justificacion,
      });
      const encontrados: Errores = {};
      for (const e of (data ?? []) as { campo: NombreCampo; mensaje: string }[]) {
        encontrados[e.campo] ??= e.mensaje;
      }
      if (error) encontrados.justificacion = mensajeDeError(error);
      setErroresServidor(encontrados);
      setRevisando(false);
    }, 400);
    return () => { clearTimeout(espera); setRevisando(false); };
  }, [datos, sinErroresLocales]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    const { data, error } = await supabase.rpc('registrar_horas', {
      p_identificacion: datos.identificacion,
      p_nombre_completo: datos.nombre_completo,
      p_cargo: datos.cargo,
      p_nivel: datos.nivel,
      p_filial: datos.filial,
      p_fecha: datos.fecha_horas_extras,
      p_hora_inicio: datos.hora_inicio,
      p_hora_final: datos.hora_final,
      p_justificacion: datos.justificacion,
    });
    setGuardando(false);
    if (error) {
      setResultado({ tipo: 'error', texto: mensajeDeError(error) });
      return;
    }
    alRegistrar({ ...data[0], estado: 'registrada' });
    setResultado({
      tipo: 'exito',
      texto: `Quedó registrado ${data[0].codigo}: ${datos.nombre_completo}, ${formatoFecha(datos.fecha_horas_extras)}, `
        + `${formatoHoraAmPm(datos.hora_inicio)} a ${formatoHoraAmPm(datos.hora_final)}.`,
    });
    // Se conservan los datos del colega, que suele tener varios días por registrar.
    setDatos((d) => ({ ...VACIO, identificacion: d.identificacion, nombre_completo: d.nombre_completo,
      cargo: d.cargo, nivel: d.nivel, filial: d.filial }));
    setTocados(new Set(['identificacion', 'nombre_completo', 'cargo', 'nivel', 'filial']));
  }

  const errorVisible = (campo: NombreCampo) => (tocados.has(campo) ? errores[campo] : undefined);

  return (
    <form onSubmit={guardar} className="grid gap-6 lg:grid-cols-2" noValidate>
      <Tarjeta titulo="Colega">
        <div className="flex flex-col gap-4">
          <Campo etiqueta="No. identificación" htmlFor="identificacion" error={errorVisible('identificacion')}>
            <input id="identificacion" value={datos.identificacion} inputMode="numeric"
              aria-invalid={!!errorVisible('identificacion')}
              onChange={(e) => cambiar('identificacion', e.target.value)} className={claseEntrada} />
          </Campo>
          <Campo etiqueta="Nombre y apellidos" htmlFor="nombre" error={errorVisible('nombre_completo')}>
            <input id="nombre" value={datos.nombre_completo} aria-invalid={!!errorVisible('nombre_completo')}
              onChange={(e) => cambiar('nombre_completo', e.target.value)} className={claseEntrada} />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Cargo" htmlFor="cargo" error={errorVisible('cargo')}>
              <input id="cargo" value={datos.cargo} aria-invalid={!!errorVisible('cargo')}
                onChange={(e) => cambiar('cargo', e.target.value)} className={claseEntrada} />
            </Campo>
            <Campo etiqueta="Nivel" htmlFor="nivel" error={errorVisible('nivel')}>
              <select id="nivel" value={datos.nivel ?? ''} aria-invalid={!!errorVisible('nivel')}
                onChange={(e) => cambiar('nivel', e.target.value ? Number(e.target.value) : null)}
                className={claseEntrada}>
                <option value="">Seleccione…</option>
                {NIVELES.map((n) => <option key={n.valor} value={n.valor}>{n.nombre}</option>)}
              </select>
            </Campo>
          </div>
          <Campo etiqueta="Filial" htmlFor="filial" error={errorVisible('filial')}>
            <input id="filial" value={datos.filial} aria-invalid={!!errorVisible('filial')}
              onChange={(e) => cambiar('filial', e.target.value)} className={claseEntrada} />
          </Campo>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Horas extras">
        <div className="flex flex-col gap-4">
          <Campo etiqueta="Fecha" error={errorVisible('fecha_horas_extras')}>
            <CalendarioMes hoy={hoy} festivos={festivos} seleccionada={datos.fecha_horas_extras}
              alElegir={elegirFecha} />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Hora de inicio" htmlFor="inicio" error={errorVisible('hora_inicio')}
              ayuda={tipo === 'habil' ? `Día hábil: inicia al terminar la jornada (${formatoHoraAmPm(config.finJornada)}).` : undefined}>
              <select id="inicio" value={datos.hora_inicio} disabled={!tipo || tipo === 'habil'}
                aria-invalid={!!errorVisible('hora_inicio')}
                onChange={(e) => cambiar('hora_inicio', e.target.value)} className={claseEntrada}>
                <option value="">Seleccione…</option>
                {(tipo === 'habil' ? [config.finJornada] : HORAS.slice(0, -1)).map((h) => (
                  <option key={h} value={h}>{formatoHoraAmPm(h)}</option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Hora final" htmlFor="final" error={errorVisible('hora_final')}
              ayuda={tipo ? `Hasta ${formatoDuracion(topeDia)} horas este día.` : undefined}>
              <select id="final" value={datos.hora_final} disabled={!datos.hora_inicio}
                aria-invalid={!!errorVisible('hora_final')}
                onChange={(e) => cambiar('hora_final', e.target.value)} className={claseEntrada}>
                <option value="">Seleccione…</option>
                {opcionesFinal.map((h) => <option key={h} value={h}>{formatoHoraAmPm(h)}</option>)}
              </select>
            </Campo>
          </div>

          <dl className="grid grid-cols-2 gap-2 rounded-md bg-suave p-3 text-sm">
            <dt className="text-texto-suave">Tipo de día</dt>
            <dd className="font-semibold">
              {tipo ? NOMBRE_TIPO_DIA[tipo] : '—'}
              {datos.fecha_horas_extras && festivos.get(datos.fecha_horas_extras)
                ? ` (${festivos.get(datos.fecha_horas_extras)})` : ''}
            </dd>
            <dt className="text-texto-suave">Total horas extras</dt>
            <dd className="font-semibold">{formatoDuracion(minutos)}</dd>
          </dl>

          {semana && (
            <ContadorSemana usadosMin={semana.minutos} nuevosMin={minutos} topeMin={config.topeSemanalMin}
              lunes={semana.lunes} domingo={semana.domingo} />
          )}

          <Campo etiqueta="Justificación" htmlFor="justificacion" error={errorVisible('justificacion')}>
            <textarea id="justificacion" rows={3} value={datos.justificacion}
              aria-invalid={!!errorVisible('justificacion')}
              onChange={(e) => cambiar('justificacion', e.target.value)} className={claseEntrada} />
          </Campo>

          {resultado && <Aviso tipo={resultado.tipo}>{resultado.texto}</Aviso>}

          <Boton type="submit" disabled={hayErrores || revisando || guardando}>
            {guardando ? 'Guardando…' : revisando ? 'Revisando reglas…' : 'Guardar'}
          </Boton>
          {[...tocados].some((campo) => errores[campo]) && (
            <p className="text-sm text-texto-suave">Corrija los campos marcados para poder guardar.</p>
          )}
        </div>
      </Tarjeta>
    </form>
  );
}

