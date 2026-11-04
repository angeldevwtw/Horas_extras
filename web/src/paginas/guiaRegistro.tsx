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
      titulo: '2. Los días',
      texto: (
        <>
          <p>Marque uno o varios días del mes anterior o del mes en curso; un segundo clic lo desmarca y
            arriba del calendario se cambia de mes. Los sábados y festivos están sombreados y los domingos
            tachados: no se registran.</p>
          <p>Los días que el colega ya tiene registrados salen en rojo y no se pueden marcar. Un festivo
            solo se permite si el colega no trabajó su sábado.</p>
        </>
      ),
    },
    {
      objetivo: 'horario',
      titulo: '3. El horario',
      texto: (
        <>
          <p>Los días marcados se agrupan por semana (lunes a domingo). En cada semana elija las horas por
            día y se aplican a los días de esa semana. De lunes a jueves empiezan a
            las {formatoHoraAmPm(config.finJornada)} y los viernes a
            las {formatoHoraAmPm(config.finJornadaViernes)}, justo al terminar la jornada; en sábado o
            festivo se elige la hora de inicio.</p>
          <p>En la lista de días puede ajustar el horario de cualquiera o quitarlo. Las horas van en punto o
            y media, con máximo {formatoDuracion(config.topeDiarioMin)} por día.</p>
        </>
      ),
    },
    {
      objetivo: 'motivo',
      titulo: '4. La justificación',
      texto: (
        <>
          <p>Explique la causa concreta de las horas extras. Las razones genéricas o permanentes no sirven.</p>
          <p>Con varios días marcados puede usar <strong>la misma para todos</strong> o escribir{' '}
            <strong>una por día</strong>.</p>
        </>
      ),
    },
    {
      objetivo: 'resumen',
      titulo: '5. Revisar y guardar',
      texto: (
        <>
          <p>Aquí ve el total de la selección y cuánto lleva el colega en cada semana (máximo{' '}
            {formatoDuracion(config.topeSemanalMin)} horas), contando los días marcados.</p>
          <p>El botón para guardar solo se activa cuando todos los días cumplen las reglas. Se guardan
            todos juntos o ninguno, y cada día queda como un registro con su propio código.</p>
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
