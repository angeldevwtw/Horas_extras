import type { PasoGuia } from '../componentes/Guia';
import { formatoDuracion, formatoHoraAmPm } from '../lib/horas';
import type { Configuracion } from '../lib/tipos';

/** Pasos del recorrido de ayuda por la página de registro. */
export function pasosGuiaRegistro(config: Configuracion): PasoGuia[] {
  return [
    {
      objetivo: 'colega',
      titulo: '1. Datos del colega',
      texto: (
        <>
          <p>Escriba la cédula y el nombre de quien hizo las horas extras. El nombre se ajusta solo a
            mayúscula inicial.</p>
          <p>Elija el cargo (si no está en la lista, use <strong>Otro</strong> y escríbalo), el nivel y la
            filial. Solo los niveles 68, 73 y 78 pueden registrar horas extras.</p>
        </>
      ),
    },
    {
      objetivo: 'fecha',
      titulo: '2. La fecha',
      texto: (
        <>
          <p>Solo se pueden elegir días del mes en curso. Los sábados y festivos están sombreados y los
            domingos tachados: no se registran.</p>
          <p>Un festivo solo se permite si el colega no trabajó su sábado. Si el colega ya tiene horas ese
            día, aparece un aviso en rojo.</p>
        </>
      ),
    },
    {
      objetivo: 'horario',
      titulo: '3. El horario',
      texto: (
        <>
          <p>De lunes a jueves las horas empiezan a las {formatoHoraAmPm(config.finJornada)} y los viernes a
            las {formatoHoraAmPm(config.finJornadaViernes)}, justo al terminar la jornada.</p>
          <p>Las horas van en punto o y media, con máximo {formatoDuracion(config.topeDiarioMin)} por día.</p>
        </>
      ),
    },
    {
      objetivo: 'motivo',
      titulo: '4. La justificación',
      texto: <p>Explique la causa concreta de las horas extras. Las razones genéricas o permanentes no sirven.</p>,
    },
    {
      objetivo: 'resumen',
      titulo: '5. Revisar y guardar',
      texto: (
        <>
          <p>Aquí ve el total del registro y cuánto lleva el colega en la semana (máximo{' '}
            {formatoDuracion(config.topeSemanalMin)} horas).</p>
          <p>El botón <strong>Guardar registro</strong> solo se activa cuando todo cumple las reglas.</p>
        </>
      ),
    },
    {
      objetivo: 'ventana',
      titulo: '6. Lo registrado y cómo anular',
      texto: (
        <>
          <p>Lo que guarde aparece aquí. Desde esta lista puede descargar el Excel y{' '}
            <strong>anular</strong> un registro con su motivo. Los registros no se editan: si hay un error, se
            anula y se registra de nuevo.</p>
          <p className="rounded-md bg-error-suave px-3 py-2 text-error">
            <strong>Importante:</strong> al cerrar la pestaña esta lista se borra y ya no podrá anular. Desde
            ese momento solo el administrador puede anular el registro.
          </p>
        </>
      ),
    },
  ];
}
