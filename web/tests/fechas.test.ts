import { describe, expect, it } from 'vitest';
import { diasDelMes, formatoFecha, hoyBogota, lunesDe, mesesPermitidos, primerDiaMesSiguiente, sumarDias, tipoDia } from '../src/lib/fechas';

const festivos = new Set(['2026-10-12', '2026-11-02']);

describe('semanas y meses', () => {
  it('lunesDe devuelve el lunes de la semana, aunque caiga en el mes anterior', () => {
    expect(lunesDe('2026-11-01')).toBe('2026-10-26');
    expect(lunesDe('2026-11-02')).toBe('2026-11-02');
    expect(lunesDe('2026-11-08')).toBe('2026-11-02');
  });
  it('sumarDias cruza meses y años', () => {
    expect(sumarDias('2026-12-28', 6)).toBe('2027-01-03');
  });
  it('mesesPermitidos son el anterior y el actual, también en enero', () => {
    expect(mesesPermitidos('2026-11-04')).toEqual(['2026-10-01', '2026-11-01']);
    expect(mesesPermitidos('2027-01-05')).toEqual(['2026-12-01', '2027-01-01']);
  });
});

describe('tipoDia', () => {
  it('distingue hábil, sábado y domingo', () => {
    expect(tipoDia('2026-10-05', festivos)).toBe('habil');
    expect(tipoDia('2026-10-03', festivos)).toBe('sabado');
    expect(tipoDia('2026-10-04', festivos)).toBe('domingo');
  });
  it('el festivo en lunes cuenta como festivo', () => {
    expect(tipoDia('2026-10-12', festivos)).toBe('festivo');
  });
});

describe('hoyBogota', () => {
  it('usa la hora de Bogotá y no la UTC', () => {
    // 1 de noviembre 03:00 UTC = 31 de octubre 10:00 PM en Bogotá.
    expect(hoyBogota(new Date('2026-11-01T03:00:00Z'))).toBe('2026-10-31');
    expect(hoyBogota(new Date('2026-11-01T05:00:00Z'))).toBe('2026-11-01');
  });
});

it('formatoFecha da dd/mm/aaaa', () => {
  expect(formatoFecha('2026-09-01')).toBe('01/09/2026');
});

it('diasDelMes respeta la longitud del mes', () => {
  expect(diasDelMes('2026-02-10')).toHaveLength(28);
  expect(diasDelMes('2026-10-29').at(-1)).toBe('2026-10-31');
});

it('primerDiaMesSiguiente pasa de diciembre a enero', () => {
  expect(primerDiaMesSiguiente('2026-12-15')).toBe('2027-01-01');
  expect(primerDiaMesSiguiente('2026-10-15')).toBe('2026-11-01');
});
