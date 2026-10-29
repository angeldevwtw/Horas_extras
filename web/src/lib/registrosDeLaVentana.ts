import type { Registro } from './tipos';

// Lo registrado en esta pestaña, con las claves para anular. Se guarda en sessionStorage para
// que sobreviva a recargar la página pero no quede en el equipo al cerrarla (hay cédulas).
const LLAVE = 'horas-extras:registros';

export function leerRegistros(): Registro[] {
  try {
    return JSON.parse(sessionStorage.getItem(LLAVE) ?? '[]');
  } catch {
    return [];
  }
}

export function guardarRegistros(registros: Registro[]) {
  try {
    sessionStorage.setItem(LLAVE, JSON.stringify(registros));
  } catch {
    // Sin almacenamiento la lista sigue en memoria mientras la pestaña esté abierta.
  }
}
