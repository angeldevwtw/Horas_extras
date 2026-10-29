import { describe, expect, it } from 'vitest';
import { erroresLocales, type DatosRegistro, type Reglas } from '../src/lib/reglas';

const reglas: Reglas = {
  hoy: '2026-10-15',
  festivos: new Set(['2026-10-12']),
  finJornada: '17:00',
  finJornadaViernes: '16:30',
  topeDiarioMin: 120,
  topeFinSemanaMin: 120,
};

const valido: DatosRegistro = {
  identificacion: '900000001',
  nombre_completo: 'Colega Ficticio',
  cargo: 'Analista',
  nivel: 68,
  filial: 'Banco',
  fecha_horas_extras: '2026-10-05',
  hora_inicio: '17:00',
  hora_final: '19:00',
  justificacion: 'Cierre de mes',
};

const errores = (cambios: Partial<DatosRegistro>) => erroresLocales({ ...valido, ...cambios }, reglas);

describe('erroresLocales', () => {
  it('un registro válido no tiene errores', () => {
    expect(errores({})).toEqual({});
  });
  it('rechaza niveles distintos de 68, 73 y 78', () => {
    expect(errores({ nivel: 70 }).nivel).toBeDefined();
    expect(errores({ nivel: 73 }).nivel).toBeUndefined();
  });
  it('día hábil: inicio a las 6:00 PM rompe la continuidad', () => {
    expect(errores({ hora_inicio: '18:00', hora_final: '20:00' }).hora_inicio).toMatch(/5:00 PM/);
  });
  it('día hábil: más de 2 horas se rechaza', () => {
    expect(errores({ hora_final: '19:15' }).hora_final).toMatch(/2:00/);
  });
  it('festivo en lunes: cualquier inicio, máximo 2 horas', () => {
    const festivo = { fecha_horas_extras: '2026-10-12', hora_inicio: '09:00' };
    expect(errores({ ...festivo, hora_final: '11:00' })).toEqual({});
    expect(errores({ ...festivo, hora_final: '11:30' }).hora_final).toMatch(/festivo/);
  });
  it('la fecha debe ser del mes y año en curso', () => {
    expect(errores({ fecha_horas_extras: '2026-09-30' }).fecha_horas_extras).toMatch(/octubre de 2026/);
    expect(errores({ fecha_horas_extras: '2025-10-15' }).fecha_horas_extras).toBeDefined();
  });
  it('la hora final debe ser posterior a la de inicio', () => {
    const cruzaMedianoche = { fecha_horas_extras: '2026-10-17', hora_inicio: '23:00', hora_final: '01:00' };
    expect(errores(cruzaMedianoche).hora_final).toMatch(/posterior/);
  });
  it('la filial debe ser una de las cuatro', () => {
    for (const filial of ['Banco', 'Sufi', 'Leasing', 'Empleados']) {
      expect(errores({ filial }).filial).toBeUndefined();
    }
    expect(errores({ filial: 'Otra' }).filial).toBeDefined();
    expect(errores({ filial: '' }).filial).toBeDefined();
  });
  it('los viernes las horas extras empiezan a las 4:30 PM', () => {
    const viernes = { fecha_horas_extras: '2026-10-09' };
    expect(errores({ ...viernes, hora_inicio: '16:30', hora_final: '18:30' })).toEqual({});
    expect(errores({ ...viernes, hora_inicio: '17:00', hora_final: '18:00' }).hora_inicio).toMatch(/4:30 PM/);
  });
  it('los domingos no se registran', () => {
    expect(errores({ fecha_horas_extras: '2026-10-11', hora_inicio: '08:00', hora_final: '09:00' })
      .fecha_horas_extras).toMatch(/domingos/);
  });
  it('la justificación es obligatoria', () => {
    expect(errores({ justificacion: '  ' }).justificacion).toBeDefined();
  });
});
