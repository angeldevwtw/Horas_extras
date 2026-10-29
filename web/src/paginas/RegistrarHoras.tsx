import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarioMes } from '../componentes/CalendarioMes';
import { ContadorSemana } from '../componentes/ContadorSemana';
import { SelectorCargo } from '../componentes/SelectorCargo';
import { Aviso, Boton, Campo, claseEntrada, Paso } from '../componentes/ui';
import { formatoFecha, NOMBRE_TIPO_DIA, tipoDia } from '../lib/fechas';
import { formatoDuracion, formatoHoraAmPm, minutosEntre, opcionesDeHora } from '../lib/horas';
import { erroresLocales, FILIALES, finJornadaDe, NIVELES, nombrePropio, type Campo as NombreCampo, type DatosRegistro, type Errores } from '../lib/reglas';
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
  const [semana, setSemana] = useState<{
    minutos: number; lunes: string; domingo: string; minutosDia: number; codigosDia: string | null;
  } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<{ tipo: 'error' | 'exito'; texto: string } | null>(null);

  const fechasFestivas = useMemo(() => new Set(festivos.keys()), [festivos]);
  const tipo = datos.fecha_horas_extras ? tipoDia(datos.fecha_horas_extras, fechasFestivas) : null;
  const topeDia = tipo === 'habil' ? config.topeDiarioMin : config.topeFinSemanaMin;
  const finJornada = tipo === 'habil' ? finJornadaDe(datos.fecha_horas_extras, config) : null;
  const minutos = datos.hora_inicio && datos.hora_final
    ? Math.max(0, minutosEntre(datos.hora_inicio, datos.hora_final)) : 0;

  const erroresLocal = erroresLocales(datos, { hoy, festivos: fechasFestivas, ...config });
  // Se avisa apenas se elige la fecha, sin esperar a que el resto del formulario esté lleno.
  const diaLleno = semana && semana.minutosDia > 0 && (tipo === 'habil' || semana.minutosDia >= topeDia);
  const errorDia: Errores = diaLleno ? {
    fecha_horas_extras: `El colega ya tiene horas extras registradas el ${formatoFecha(datos.fecha_horas_extras)} `
      + `(${semana.codigosDia}). Ese día no admite más.`,
  } : {};
  const errores: Errores = { ...erroresServidor, ...errorDia, ...erroresLocal };
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
      const inicio = esHabil ? finJornadaDe(fecha, config) : d.hora_inicio;
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
      if (fila) {
        setSemana({ minutos: fila.minutos_semana, lunes: fila.lunes, domingo: fila.domingo,
          minutosDia: fila.minutos_dia, codigosDia: fila.codigos_dia });
      }
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

  const festivo = datos.fecha_horas_extras ? festivos.get(datos.fecha_horas_extras) : undefined;

  return (
    <form onSubmit={guardar} noValidate
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="rounded-xl border border-borde bg-blanco shadow-xs">
        <Paso numero={1} titulo="Colega" descripcion="Datos de quien hizo las horas extras.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="No. identificación" htmlFor="identificacion" error={errorVisible('identificacion')}>
              <input id="identificacion" value={datos.identificacion} inputMode="numeric"
                aria-invalid={!!errorVisible('identificacion')}
                onChange={(e) => cambiar('identificacion', e.target.value)} className={claseEntrada} />
            </Campo>
            <Campo etiqueta="Nombre y apellidos" htmlFor="nombre" error={errorVisible('nombre_completo')}>
              <input id="nombre" value={datos.nombre_completo} aria-invalid={!!errorVisible('nombre_completo')}
                onChange={(e) => cambiar('nombre_completo', nombrePropio(e.target.value))} className={claseEntrada} />
            </Campo>
            <Campo etiqueta="Cargo" htmlFor="cargo" error={errorVisible('cargo')}>
              <SelectorCargo valor={datos.cargo} invalido={!!errorVisible('cargo')}
                alCambiar={(cargo) => cambiar('cargo', cargo)} />
            </Campo>
            <Campo etiqueta="Nivel" htmlFor="nivel" error={errorVisible('nivel')}>
              <select id="nivel" value={datos.nivel ?? ''} aria-invalid={!!errorVisible('nivel')}
                onChange={(e) => cambiar('nivel', e.target.value ? Number(e.target.value) : null)}
                className={claseEntrada}>
                <option value="">Seleccione…</option>
                {NIVELES.map((n) => <option key={n.valor} value={n.valor}>{n.nombre}</option>)}
              </select>
            </Campo>
            <Campo etiqueta="Filial" htmlFor="filial" error={errorVisible('filial')}>
              <select id="filial" value={datos.filial} aria-invalid={!!errorVisible('filial')}
                onChange={(e) => cambiar('filial', e.target.value)} className={claseEntrada}>
                <option value="">Seleccione…</option>
                {FILIALES.map((f) => <option key={f}>{f}</option>)}
              </select>
            </Campo>
          </div>
        </Paso>

        <Paso numero={2} titulo="Fecha y horario" descripcion="Solo días del mes en curso.">
          <Campo etiqueta="Fecha" error={diaLleno ? undefined : errorVisible('fecha_horas_extras')}>
            <CalendarioMes hoy={hoy} festivos={festivos} seleccionada={datos.fecha_horas_extras}
              alElegir={elegirFecha} />
          </Campo>
          {diaLleno && (
            <div role="alert" className="flex gap-3 rounded-lg border border-error bg-error-suave p-4 text-error">
              <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-error
                text-sm font-bold text-blanco">!</span>
              <div>
                <p className="font-semibold">Este día ya está registrado</p>
                <p className="mt-1 text-sm">{errorDia.fecha_horas_extras} Elija otra fecha.</p>
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Hora de inicio" htmlFor="inicio" error={errorVisible('hora_inicio')}
              ayuda={finJornada ? `Día hábil: inicia al terminar la jornada (${formatoHoraAmPm(finJornada)}).` : undefined}>
              <select id="inicio" value={datos.hora_inicio} disabled={!tipo || tipo === 'habil'}
                aria-invalid={!!errorVisible('hora_inicio')}
                onChange={(e) => cambiar('hora_inicio', e.target.value)} className={claseEntrada}>
                <option value="">Seleccione…</option>
                {(finJornada ? [finJornada] : HORAS.slice(0, -1)).map((h) => (
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
        </Paso>

        <Paso numero={3} titulo="Motivo">
          <p id="nota-justificacion" className="rounded-md border-l-4 border-primario bg-suave px-4 py-3 text-sm">
            <strong>Importante:</strong> explique la causa concreta (picos de producción, emergencias
            técnicas, entregas urgentes o ausencias imprevistas del personal), evitando razones
            genéricas o permanentes.
          </p>
          <Campo etiqueta="Justificación" htmlFor="justificacion" error={errorVisible('justificacion')}>
            <textarea id="justificacion" rows={4} value={datos.justificacion}
              aria-invalid={!!errorVisible('justificacion')} aria-describedby="nota-justificacion"
              onChange={(e) => cambiar('justificacion', e.target.value)} className={claseEntrada} />
          </Campo>
        </Paso>
      </div>

      <aside className="grid gap-5 rounded-xl border border-borde bg-blanco p-5 shadow-xs lg:sticky lg:top-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-texto-suave">Total del registro</p>
          <p className="mt-1 text-4xl font-semibold text-primario">
            {formatoDuracion(minutos)}<span className="ml-1 text-base font-medium text-texto-suave">horas</span>
          </p>
        </div>

        <dl className="grid gap-3 border-y border-borde py-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-texto-suave">Colega</dt>
            <dd className="text-right font-medium">{datos.nombre_completo.trim() || '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-texto-suave">Fecha</dt>
            <dd className="text-right font-medium">
              {datos.fecha_horas_extras ? formatoFecha(datos.fecha_horas_extras) : '—'}
              {tipo && (
                <span className="block text-xs font-normal text-texto-suave">
                  {NOMBRE_TIPO_DIA[tipo]}{festivo ? ` · ${festivo}` : ''}
                </span>
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-texto-suave">Horario</dt>
            <dd className="text-right font-medium">
              {datos.hora_inicio && datos.hora_final
                ? `${formatoHoraAmPm(datos.hora_inicio)} – ${formatoHoraAmPm(datos.hora_final)}` : '—'}
            </dd>
          </div>
        </dl>

        {semana && (
          <ContadorSemana usadosMin={semana.minutos} nuevosMin={minutos} topeMin={config.topeSemanalMin}
            lunes={semana.lunes} domingo={semana.domingo} />
        )}

        {resultado && <Aviso tipo={resultado.tipo}>{resultado.texto}</Aviso>}
        {diaLleno && (
          <p className="rounded-md bg-error-suave px-3 py-2 text-sm font-medium text-error">
            Ese día ya está registrado para este colega.
          </p>
        )}

        <div className="grid gap-2">
          <Boton type="submit" className="py-2.5" disabled={hayErrores || revisando || guardando}>
            {guardando ? 'Guardando…' : revisando ? 'Revisando reglas…' : 'Guardar registro'}
          </Boton>
          {[...tocados].some((campo) => errores[campo]) && (
            <p className="text-center text-xs text-texto-suave">Corrija los campos marcados para poder guardar.</p>
          )}
        </div>
      </aside>
    </form>
  );
}
