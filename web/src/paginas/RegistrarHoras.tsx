import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { BloqueSemana, type HorarioSemana } from '../componentes/BloqueSemana';
import { CalendarioMes } from '../componentes/CalendarioMes';
import { ContadorSemana } from '../componentes/ContadorSemana';
import { SelectorCargo } from '../componentes/SelectorCargo';
import { Aviso, Boton, Campo, claseEntrada, Paso } from '../componentes/ui';
import { diaDeSemana, diasDelMes, formatoFecha, lunesDe, mesesPermitidos, sumarDias, tipoDia } from '../lib/fechas';
import { formatoDuracion, formatoHoraAmPm, horaDeMinutos, minutosDelDia, minutosEntre } from '../lib/horas';
import { domingoPermitido, erroresColega, erroresDia, FILIALES, finJornadaDe, NIVELES, nombrePropio, tieneHorarioEspecial, topeDelDia, type Campo as NombreCampo, type DatosColega, type DiaRegistro, type Errores } from '../lib/reglas';
import { mensajeDeError, supabase } from '../lib/supabase';
import type { Configuracion, Registro } from '../lib/tipos';

const VACIO: DatosColega = {
  identificacion: '', nombre_completo: '', cargo: '', nivel: null, filial: '', justificacion: '',
};

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function RegistrarHoras({ hoy, config, festivos, alRegistrar }: {
  hoy: string;
  alRegistrar: (registro: Registro) => void;
  config: Configuracion;
  festivos: Map<string, string>;
}) {
  const [datos, setDatos] = useState<DatosColega>(VACIO);
  const [dias, setDias] = useState<DiaRegistro[]>([]);
  // Horario común de cada semana (por su lunes): se aplica a cada día al marcarlo y a todos
  // los de la semana al cambiarlo.
  const [horarios, setHorarios] = useState<Record<string, HorarioSemana>>({});
  // Con varios días: una justificación para todos o una por día.
  const [modoJustificacion, setModoJustificacion] = useState<'general' | 'dia'>('general');
  const [justificaciones, setJustificaciones] = useState<Record<string, string>>({});
  const [tocados, setTocados] = useState<Set<NombreCampo>>(new Set());
  const [erroresServidor, setErroresServidor] = useState<{ colega: Errores; dias: Record<string, Errores> }>(
    { colega: {}, dias: {} });
  const [revisando, setRevisando] = useState(false);
  const [registrados, setRegistrados] = useState<Map<string, { minutos: number; codigos: string }>>(new Map());
  const [version, setVersion] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<{ tipo: 'error' | 'exito'; texto: string } | null>(null);

  const fechasFestivas = useMemo(() => new Set(festivos.keys()), [festivos]);
  const reglas = { hoy, festivos: fechasFestivas, ...config };
  const topeDe = (fecha: string) => topeDelDia(fecha, reglas);
  const finDe = (fecha: string) => finJornadaDe(fecha, config);
  const esEspecial = (fecha: string, filial = datos.filial) => tieneHorarioEspecial(filial, fecha, fechasFestivas);
  const minutosDe = (d: DiaRegistro) => {
    if (esEspecial(d.fecha_horas_extras)) return d.minutos_extras ?? 0;
    return d.hora_inicio && d.hora_final ? Math.max(0, minutosEntre(d.hora_inicio, d.hora_final)) : 0;
  };
  const hayJornadaEspecial = dias.some((d) => esEspecial(d.fecha_horas_extras));
  const duraciones = Array.from({ length: Math.max(config.topeDiarioMin, config.topeFinSemanaMin) / 30 },
    (_, i) => (i + 1) * 30);

  // Hábil: lleno con cualquier registro; fin de semana o festivo, con el tope completo.
  const llenos = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const [fecha, r] of registrados) {
      const habil = tipoDia(fecha, fechasFestivas) === 'habil';
      if (r.minutos > 0 && (habil || r.minutos >= config.topeFinSemanaMin)) mapa.set(fecha, r.codigos);
    }
    return mapa;
  }, [registrados, fechasFestivas, config.topeFinSemanaMin]);

  const porDia = dias.length > 1 && modoJustificacion === 'dia';
  const locColega = erroresColega(datos);
  if (porDia) delete locColega.justificacion;
  const aParametro = (d: DiaRegistro) => ({
    fecha: d.fecha_horas_extras, inicio: d.hora_inicio, final: d.hora_final,
    ...(esEspecial(d.fecha_horas_extras) ? { minutos: d.minutos_extras } : {}),
    ...(porDia ? { justificacion: justificaciones[d.fecha_horas_extras] ?? '' } : {}),
  });
  const faltaJustificacion = (fecha: string) => porDia && !(justificaciones[fecha] ?? '').trim();
  const erroresDelColega: Errores = { ...erroresServidor.colega, ...locColega };
  const erroresPorDia: Record<string, Errores> = {};
  for (const d of dias) {
    const fecha = d.fecha_horas_extras;
    const lleno = llenos.get(fecha);
    const locales = erroresDia(d, reglas, datos.filial);
    // Sin horario completo todavía no es un error: se avisa junto al botón.
    if (!d.hora_inicio || !d.hora_final) delete locales.hora_final;
    if (!d.minutos_extras) delete locales.minutos_totales;
    erroresPorDia[fecha] = {
      ...erroresServidor.dias[fecha],
      ...(lleno ? { fecha_horas_extras: `El colega ya tiene horas extras registradas este día (${lleno}). Quítelo de la selección.` } : {}),
      ...locales,
      ...(faltaJustificacion(fecha) ? { justificacion: 'Escriba la justificación de este día.' } : {}),
    };
  }
  const diasConError = dias.filter((d) => Object.keys(erroresPorDia[d.fecha_horas_extras])
    .some((campo) => campo !== 'justificacion' || !faltaJustificacion(d.fecha_horas_extras))).length;
  const sinJustificacion = dias.filter((d) => faltaJustificacion(d.fecha_horas_extras)).length;
  const sinHorario = dias.filter((d) => !d.hora_inicio || !d.hora_final
    || (esEspecial(d.fecha_horas_extras) && !d.minutos_extras)).length;
  const hayErrores = Object.keys(erroresDelColega).length > 0 || diasConError > 0 || sinHorario > 0
    || sinJustificacion > 0
    || dias.length === 0;
  const identificacionValida = !locColega.identificacion;
  const totalMinutos = dias.reduce((s, d) => s + minutosDe(d), 0);

  const horarioDeSemana = (lunes: string): HorarioSemana => horarios[lunes] ?? { duracion: 0, inicio: '', inicioJornada: '', finalJornada: '' };

  function horarioDe(fecha: string, horario = horarioDeSemana(lunesDe(fecha)), filial = datos.filial): DiaRegistro {
    const { duracion: dur, inicio: inicioSab } = horario;
    if (esEspecial(fecha, filial)) {
      return { fecha_horas_extras: fecha, hora_inicio: horario.inicioJornada, hora_final: horario.finalJornada,
        minutos_extras: dur };
    }
    const habil = tipoDia(fecha, fechasFestivas) === 'habil';
    const inicio = habil ? finDe(fecha) : inicioSab;
    const fin = inicio && dur ? minutosDelDia(inicio) + dur : 0;
    const final = fin && dur <= topeDe(fecha) && fin < 24 * 60 ? horaDeMinutos(fin) : '';
    return { fecha_horas_extras: fecha, hora_inicio: inicio, hora_final: final };
  }

  function cambiar<K extends keyof DatosColega>(campo: K, valor: DatosColega[K]) {
    setDatos((d) => ({ ...d, [campo]: valor }));
    setTocados((t) => new Set(t).add(campo));
    setResultado(null);
  }

  // El horario de Sufi se marca distinto: los días elegidos se arman de nuevo con la filial nueva.
  function cambiarFilial(filial: string) {
    cambiar('filial', filial);
    setDias((lista) => lista.map((d) =>
      horarioDe(d.fecha_horas_extras, horarioDeSemana(lunesDe(d.fecha_horas_extras)), filial)));
  }

  function alternarDia(fecha: string) {
    setDias((lista) => lista.some((d) => d.fecha_horas_extras === fecha)
      ? lista.filter((d) => d.fecha_horas_extras !== fecha)
      : [...lista, horarioDe(fecha)].sort((a, b) => a.fecha_horas_extras.localeCompare(b.fecha_horas_extras)));
    setResultado(null);
  }

  function cambiarDia(fecha: string, cambios: Partial<DiaRegistro>) {
    setDias((lista) => lista.map((d) => {
      if (d.fecha_horas_extras !== fecha) return d;
      const nuevo = { ...d, ...cambios };
      // Si cambia el inicio, la hora final se conserva solo si sigue siendo válida.
      const despues = nuevo.hora_inicio && nuevo.hora_final ? minutosEntre(nuevo.hora_inicio, nuevo.hora_final) : 0;
      if (despues <= 0 || (!esEspecial(fecha) && despues > topeDe(fecha))) nuevo.hora_final = '';
      return nuevo;
    }));
    setResultado(null);
  }

  function aplicarASemana(lunes: string, horario: HorarioSemana) {
    setHorarios((h) => ({ ...h, [lunes]: horario }));
    setDias((lista) => lista.map((d) =>
      lunesDe(d.fecha_horas_extras) === lunes ? horarioDe(d.fecha_horas_extras, horario) : d));
    setResultado(null);
  }

  // Lo que el colega ya tiene en los dos meses permitidos, para bloquear días y sumar semanas.
  useEffect(() => {
    setRegistrados(new Map());
    if (!identificacionValida) return;
    const [desde, actual] = mesesPermitidos(hoy);
    const hasta = diasDelMes(actual).at(-1)!;
    const espera = setTimeout(async () => {
      const { data } = await supabase.rpc('dias_del_colega', {
        p_identificacion: datos.identificacion, p_desde: desde, p_hasta: hasta,
      });
      setRegistrados(new Map((data ?? []).map((f: { fecha: string; minutos: number; codigos: string }) =>
        [f.fecha, { minutos: f.minutos, codigos: f.codigos }])));
    }, 300);
    return () => clearTimeout(espera);
  }, [datos.identificacion, identificacionValida, hoy, version]);

  // Las reglas que dependen de otros registros (tope semanal, descanso, cruces) las revisa la base.
  const listoParaRevisar = dias.length > 0 && sinHorario === 0 && Object.keys(locColega).length === 0
    && dias.every((d) => Object.keys(erroresDia(d, reglas, datos.filial)).length === 0 && !faltaJustificacion(d.fecha_horas_extras));
  useEffect(() => {
    setErroresServidor({ colega: {}, dias: {} });
    if (!listoParaRevisar) return;
    setRevisando(true);
    const espera = setTimeout(async () => {
      const { data, error } = await supabase.rpc('revisar_varios', {
        p_identificacion: datos.identificacion,
        p_nivel: datos.nivel,
        p_dias: dias.map(aParametro),
        p_justificacion: datos.justificacion,
        p_filial: datos.filial,
      });
      const colega: Errores = {};
      const porDia: Record<string, Errores> = {};
      for (const e of (data ?? []) as { fecha: string | null; campo: NombreCampo; mensaje: string }[]) {
        const destino = e.fecha ? (porDia[e.fecha] ??= {}) : colega;
        destino[e.campo] ??= e.mensaje;
      }
      if (error) colega.justificacion = mensajeDeError(error);
      setErroresServidor({ colega, dias: porDia });
      setRevisando(false);
    }, 400);
    return () => { clearTimeout(espera); setRevisando(false); };
  }, [datos, dias, listoParaRevisar, porDia, justificaciones]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    const { data, error } = await supabase.rpc('registrar_varios', {
      p_identificacion: datos.identificacion,
      p_nombre_completo: datos.nombre_completo,
      p_cargo: datos.cargo,
      p_nivel: datos.nivel,
      p_filial: datos.filial,
      p_dias: dias.map(aParametro),
      p_justificacion: datos.justificacion,
    });
    setGuardando(false);
    if (error) {
      setResultado({ tipo: 'error', texto: `No se guardó ningún día. ${mensajeDeError(error)}` });
      return;
    }
    const nuevos = data as Omit<Registro, 'estado'>[];
    for (const r of nuevos) alRegistrar({ ...r, estado: 'registrada' });
    const [primero] = nuevos;
    setResultado({
      tipo: 'exito',
      texto: nuevos.length === 1
        ? `Quedó registrado ${primero.codigo}: ${datos.nombre_completo}, ${formatoFecha(primero.fecha_horas_extras)}, `
          + `${formatoHoraAmPm(primero.hora_inicio)} a ${formatoHoraAmPm(primero.hora_final)}.`
        : `Quedaron registrados ${nuevos.length} días para ${datos.nombre_completo} `
          + `(${formatoDuracion(totalMinutos)} horas): ${nuevos.map((r) => r.codigo).join(', ')}.`,
    });
    // Se conservan los datos del colega por si tiene más días por registrar.
    setDatos((d) => ({ ...d, justificacion: '' }));
    setDias([]);
    setJustificaciones({});
    setTocados(new Set(['identificacion', 'nombre_completo', 'cargo', 'nivel', 'filial']));
    setVersion((v) => v + 1);
  }

  function elegirModoJustificacion(modo: 'general' | 'dia') {
    // Al pasar a una por día, cada día arranca con lo que ya se había escrito en la general.
    if (modo === 'dia') {
      setJustificaciones((j) => Object.fromEntries(dias.map((d) =>
        [d.fecha_horas_extras, j[d.fecha_horas_extras] ?? datos.justificacion])));
    }
    setModoJustificacion(modo);
    setResultado(null);
  }

  const errorVisible = (campo: NombreCampo) => (tocados.has(campo) ? erroresDelColega[campo] : undefined);

  // Un contador por cada semana que toca la selección.
  const semanas = [...new Set(dias.map((d) => lunesDe(d.fecha_horas_extras)))].sort().map((lunes) => {
    const domingo = sumarDias(lunes, 6);
    const enSemana = (f: string) => f >= lunes && f <= domingo;
    let usados = 0;
    for (const [fecha, r] of registrados) if (enSemana(fecha)) usados += r.minutos;
    const delaSemana = dias.filter((d) => enSemana(d.fecha_horas_extras));
    const nuevos = delaSemana.reduce((s, d) => s + minutosDe(d), 0);
    return { lunes, domingo, usados, nuevos, dias: delaSemana };
  });

  return (
    <form onSubmit={guardar} noValidate
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="rounded-xl border border-borde bg-blanco shadow-xs">
        <Paso numero={1} titulo="Colega" descripcion="Datos de quien hizo las horas extras." guia="colega">
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
                onChange={(e) => cambiarFilial(e.target.value)} className={claseEntrada}>
                <option value="">Seleccione…</option>
                {FILIALES.map((f) => <option key={f}>{f}</option>)}
              </select>
            </Campo>
          </div>
        </Paso>

        <Paso numero={2} titulo="Días y horario"
          descripcion="Marque uno o varios días del mes anterior o del mes en curso, hasta hoy.">
          <div data-guia="fecha">
            <Campo etiqueta="Días">
              <CalendarioMes hoy={hoy} festivos={festivos} llenos={llenos}
                domingoPermitido={domingoPermitido(datos.filial)}
                seleccionadas={new Set(dias.map((d) => d.fecha_horas_extras))} alElegir={alternarDia} />
            </Campo>
          </div>
          <div className="grid gap-4" data-guia="horario">
            {dias.length > 0 ? (
              <div className="grid gap-3">
                <p className="text-sm font-medium">
                  {dias.length === 1 ? '1 día seleccionado' : `${dias.length} días seleccionados`}
                  <span className="font-normal text-texto-suave">
                    {' '}· {hayJornadaEspecial
                      ? 'en día hábil marque la jornada y el total de horas extras; puede ajustar cada día'
                      : 'en día hábil las horas empiezan al terminar la jornada; puede ajustar cada día'}
                  </span>
                </p>
                {semanas.map((s) => (
                  <BloqueSemana key={s.lunes} lunes={s.lunes} dias={s.dias} horario={horarioDeSemana(s.lunes)}
                    duraciones={duraciones} topeSemanalMin={config.topeSemanalMin} usadosMin={s.usados}
                    festivos={festivos} finJornadaDe={finDe} finJornadaSufi={config.finJornadaSufi} topeDe={topeDe}
                    esEspecial={esEspecial} minutosDe={minutosDe} errores={erroresPorDia}
                    alCambiarHorario={(h) => aplicarASemana(s.lunes, h)} alCambiarDia={cambiarDia}
                    alQuitar={alternarDia} />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-borde px-4 py-6 text-center text-sm text-texto-suave">
                Marque en el calendario los días que va a registrar.
              </p>
            )}
          </div>
        </Paso>

        <Paso numero={3} titulo="Motivo" guia="motivo">
          <p id="nota-justificacion" className="rounded-md border-l-4 border-primario bg-suave px-4 py-3 text-sm">
            <strong>Importante:</strong> explique la causa concreta (picos de producción, emergencias
            técnicas, entregas urgentes o ausencias imprevistas del personal), evitando razones
            genéricas o permanentes.
          </p>
          {dias.length > 1 && (
            <div role="group" aria-label="Justificación" className="inline-flex w-fit rounded-lg bg-suave p-1">
              {([['general', 'La misma para todos'], ['dia', 'Una por día']] as const).map(([modo, texto]) => (
                <button key={modo} type="button" onClick={() => elegirModoJustificacion(modo)}
                  aria-pressed={modoJustificacion === modo}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors
                    ${modoJustificacion === modo ? 'bg-primario text-blanco' : 'text-texto-suave hover:text-texto'}`}>
                  {texto}
                </button>
              ))}
            </div>
          )}
          {porDia ? (
            <div className="grid gap-4">
              {dias.map((d) => {
                const fecha = d.fecha_horas_extras;
                const id = `justificacion-${fecha}`;
                const error = erroresPorDia[fecha]?.justificacion;
                return (
                  <Campo key={fecha} etiqueta={`${DIAS_SEMANA[diaDeSemana(fecha)]} ${formatoFecha(fecha)}`}
                    htmlFor={id} error={error}>
                    <textarea id={id} rows={2} value={justificaciones[fecha] ?? ''} aria-invalid={!!error}
                      aria-describedby="nota-justificacion" className={claseEntrada}
                      onChange={(e) => {
                        setJustificaciones((j) => ({ ...j, [fecha]: e.target.value }));
                        setResultado(null);
                      }} />
                  </Campo>
                );
              })}
            </div>
          ) : (
            <Campo etiqueta="Justificación" htmlFor="justificacion" error={errorVisible('justificacion')}
              ayuda={dias.length > 1 ? 'Se usa la misma justificación para todos los días.' : undefined}>
              <textarea id="justificacion" rows={4} value={datos.justificacion}
                aria-invalid={!!errorVisible('justificacion')} aria-describedby="nota-justificacion"
                onChange={(e) => cambiar('justificacion', e.target.value)} className={claseEntrada} />
            </Campo>
          )}
        </Paso>
      </div>

      <aside data-guia="resumen" className="grid gap-5 rounded-xl border border-borde bg-blanco p-5 shadow-xs lg:sticky lg:top-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-texto-suave">Total de la selección</p>
          <p className="mt-1 text-4xl font-semibold text-primario">
            {formatoDuracion(totalMinutos)}<span className="ml-1 text-base font-medium text-texto-suave">horas</span>
          </p>
        </div>

        <dl className="grid gap-3 border-y border-borde py-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-texto-suave">Colega</dt>
            <dd className="text-right font-medium">{datos.nombre_completo.trim() || '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-texto-suave">Días</dt>
            <dd className="text-right font-medium">
              {dias.length === 0 ? '—' : dias.length === 1 ? formatoFecha(dias[0].fecha_horas_extras)
                : `${dias.length} días`}
              {dias.length > 1 && (
                <span className="block text-xs font-normal text-texto-suave">
                  {dias.map((d) => formatoFecha(d.fecha_horas_extras).slice(0, 5)).join(', ')}
                </span>
              )}
            </dd>
          </div>
        </dl>

        {semanas.map((s) => (
          <ContadorSemana key={s.lunes} usadosMin={s.usados} nuevosMin={s.nuevos} topeMin={config.topeSemanalMin}
            lunes={s.lunes} domingo={s.domingo} />
        ))}

        {resultado && <Aviso tipo={resultado.tipo}>{resultado.texto}</Aviso>}

        <div className="grid gap-2">
          <Boton type="submit" className="py-2.5" disabled={hayErrores || revisando || guardando}>
            {guardando ? 'Guardando…' : revisando ? 'Revisando reglas…'
              : dias.length > 1 ? `Guardar ${dias.length} registros` : 'Guardar registro'}
          </Boton>
          {diasConError > 0 ? (
            <p className="text-center text-xs text-error">
              {diasConError === 1 ? 'Un día no cumple las reglas' : `${diasConError} días no cumplen las reglas`}:
              corríjalos o quítelos. No se guarda ninguno hasta que todos cumplan.
            </p>
          ) : sinHorario > 0 ? (
            <p className="text-center text-xs text-texto-suave">
              Falta el horario de {sinHorario === 1 ? 'un día' : `${sinHorario} días`}.
            </p>
          ) : sinJustificacion > 0 ? (
            <p className="text-center text-xs text-texto-suave">
              Falta la justificación de {sinJustificacion === 1 ? 'un día' : `${sinJustificacion} días`}.
            </p>
          ) : [...tocados].some((campo) => erroresDelColega[campo]) && (
            <p className="text-center text-xs text-texto-suave">Corrija los campos marcados para poder guardar.</p>
          )}
        </div>
      </aside>
    </form>
  );
}
