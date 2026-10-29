// Las horas viajan como texto "HH:MM" (Postgres las devuelve como "HH:MM:SS").

export function minutosDelDia(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export function minutosEntre(inicio: string, final: string): number {
  return minutosDelDia(final) - minutosDelDia(inicio);
}

/** Duración como H:MM (ej. 90 → "1:30"). */
export function formatoDuracion(minutos: number): string {
  return `${Math.floor(minutos / 60)}:${String(minutos % 60).padStart(2, '0')}`;
}

/** Hora del día como h:mm AM/PM (ej. "17:00" → "5:00 PM"). */
export function formatoHoraAmPm(hora: string): string {
  const minutos = minutosDelDia(hora);
  const h = Math.floor(minutos / 60);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(minutos % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function horaDeMinutos(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

/** Opciones de los desplegables de hora, de 00:00 a 23:45. */
export function opcionesDeHora(pasoMinutos = 30): string[] {
  const opciones: string[] = [];
  for (let m = 0; m < 24 * 60; m += pasoMinutos) opciones.push(horaDeMinutos(m));
  return opciones;
}
