import { describe, expect, it } from 'vitest';
import { formatoDuracion, formatoHoraAmPm, minutosEntre, opcionesDeHora } from '../src/lib/horas';

describe('minutosEntre', () => {
  it('calcula la duración en minutos', () => {
    expect(minutosEntre('17:00', '19:00')).toBe(120);
    expect(minutosEntre('17:00', '18:45')).toBe(105);
  });
  it('acepta las horas como las devuelve Postgres', () => {
    expect(minutosEntre('17:00:00', '18:30:00')).toBe(90);
  });
  it('da cero o negativo cuando la final no es posterior', () => {
    expect(minutosEntre('23:00', '01:00')).toBeLessThan(0);
    expect(minutosEntre('17:00', '17:00')).toBe(0);
  });
});

describe('formatoDuracion (H:MM)', () => {
  it.each([[0, '0:00'], [30, '0:30'], [60, '1:00'], [90, '1:30'], [120, '2:00'], [720, '12:00']])(
    '%i minutos → %s', (minutos, esperado) => expect(formatoDuracion(minutos)).toBe(esperado));
});

describe('formatoHoraAmPm', () => {
  it.each([['00:00', '12:00 AM'], ['08:05', '8:05 AM'], ['12:00', '12:00 PM'],
    ['17:00', '5:00 PM'], ['18:30:00', '6:30 PM'], ['23:45', '11:45 PM']])(
    '%s → %s', (hora, esperado) => expect(formatoHoraAmPm(hora)).toBe(esperado));
});

it('opcionesDeHora cubre el día completo cada media hora', () => {
  const opciones = opcionesDeHora();
  expect(opciones).toHaveLength(48);
  expect(opciones[0]).toBe('00:00');
  expect(opciones[1]).toBe('00:30');
  expect(opciones.at(-1)).toBe('23:30');
});
