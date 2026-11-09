import { describe, expect, it } from 'vitest';
import { erroresLocales, jefesDeLaFilial, nombrePropio, SIN_COORDINADOR, type DatosRegistro, type Reglas } from '../src/lib/reglas';

const reglas: Reglas = {
  hoy: '2026-10-15',
  festivos: new Set(['2026-10-12']),
  finJornada: '17:00',
  finJornadaViernes: '16:30',
  finJornadaSufi: '21:00',
  topeDiarioMin: 120,
  topeFinSemanaMin: 120,
};

const valido: DatosRegistro = {
  identificacion: '900000001',
  nombre_completo: 'Colega Ficticio',
  cargo: 'Analista',
  nivel: 68,
  filial: 'Banco',
  coordinador: 'id-coordinador',
  director: '',
  fecha_horas_extras: '2026-10-05',
  hora_inicio: '17:00',
  hora_final: '19:00',
  justificacion: 'Cierre de mes',
};

const errores = (cambios: Partial<DatosRegistro>) => erroresLocales({ ...valido, ...cambios }, reglas);

describe('jefesDeLaFilial', () => {
  const jefes = [
    { id: 'sufi', filial: 'Sufi' },
    { id: 'banco', filial: 'Banco' },
    { id: 'todas', filial: null },
  ];

  it('deja a los de esa filial y a los que sirven para todas', () => {
    expect(jefesDeLaFilial(jefes, 'Sufi').map((j) => j.id)).toEqual(['sufi', 'todas']);
  });
});

describe('erroresLocales', () => {
  it('un registro válido no tiene errores', () => {
    expect(errores({})).toEqual({});
  });
  it('exige coordinador y, con Ninguno, director', () => {
    expect(errores({ coordinador: '' }).coordinador).toBeDefined();
    expect(errores({ coordinador: SIN_COORDINADOR }).director).toBeDefined();
    expect(errores({ coordinador: SIN_COORDINADOR, director: 'id-director' })).toEqual({});
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
  it('la fecha debe ser del mes anterior o del mes en curso', () => {
    expect(errores({ fecha_horas_extras: '2026-09-30' }).fecha_horas_extras).toBeUndefined();
    expect(errores({ fecha_horas_extras: '2026-08-31' }).fecha_horas_extras)
      .toMatch(/septiembre de 2026 o de octubre de 2026/);
    expect(errores({ fecha_horas_extras: '2026-11-03' }).fecha_horas_extras).toBeDefined();
    expect(errores({ fecha_horas_extras: '2025-10-15' }).fecha_horas_extras).toBeDefined();
  });

  it('en enero el mes anterior es diciembre del año pasado', () => {
    const enero = { ...reglas, hoy: '2027-01-05' };
    expect(erroresLocales({ ...valido, fecha_horas_extras: '2026-12-15' }, enero).fecha_horas_extras).toBeUndefined();
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
  it('en Sufi el domingo se registra como el sábado, a cualquier hora y hasta 2:00', () => {
    const domingo = { filial: 'Sufi', fecha_horas_extras: '2026-10-11' };
    expect(errores({ ...domingo, hora_inicio: '08:00', hora_final: '10:00' })).toEqual({});
    expect(errores({ ...domingo, hora_inicio: '08:00', hora_final: '10:30' }).hora_final).toMatch(/fin de semana/);
  });
  it('fuera de Sufi los domingos no se registran', () => {
    const domingo = { fecha_horas_extras: '2026-10-11', hora_inicio: '08:00', hora_final: '10:00' };
    for (const filial of ['Banco', 'Leasing', 'Empleados', '']) {
      expect(errores({ ...domingo, filial }).fecha_horas_extras).toMatch(/solo .* en Sufi/);
    }
  });
  describe('Sufi en día hábil', () => {
    const sufi = { filial: 'Sufi', hora_inicio: '12:00', hora_final: '21:00' };
    it('marca la jornada y aparte el total, sin inicio fijo', () => {
      expect(errores({ ...sufi, minutos_extras: 60 })).toEqual({});
    });
    it('la jornada termina máximo a las 9:00 PM', () => {
      expect(errores({ ...sufi, hora_final: '21:30', minutos_extras: 60 }).hora_final).toMatch(/9:00 PM/);
    });
    it('el total es obligatorio, con el tope diario y dentro de la jornada', () => {
      expect(errores(sufi).minutos_totales).toBeDefined();
      expect(errores({ ...sufi, minutos_extras: 150 }).minutos_totales).toMatch(/Máximo 2:00/);
      expect(errores({ ...sufi, hora_inicio: '20:30', minutos_extras: 60 }).minutos_totales).toMatch(/jornada/);
    });
    it('en sábado o festivo sigue la regla general', () => {
      expect(errores({ ...sufi, fecha_horas_extras: '2026-10-10', minutos_extras: 60 }).hora_final).toMatch(/fin de semana/);
      expect(errores({ ...sufi, fecha_horas_extras: '2026-10-12', minutos_extras: 60 }).hora_final).toMatch(/fin de semana/);
    });
    it('las demás filiales siguen con inicio fijo', () => {
      expect(errores({ ...sufi, filial: 'Banco', minutos_extras: 60 }).hora_inicio).toBeDefined();
    });
  });
  it('hoy se acepta y un día futuro del mes no', () => {
    expect(errores({ fecha_horas_extras: '2026-10-15', hora_inicio: '17:00', hora_final: '19:00' })).toEqual({});
    expect(errores({ fecha_horas_extras: '2026-10-16', hora_inicio: '16:30', hora_final: '18:30' })
      .fecha_horas_extras).toMatch(/posterior a hoy/);
  });
  it('la justificación es obligatoria', () => {
    expect(errores({ justificacion: '  ' }).justificacion).toBeDefined();
  });
});

describe('nombrePropio', () => {
  it('deja cada palabra con la primera letra en mayúscula', () => {
    expect(nombrePropio('angel ramos')).toBe('Angel Ramos');
    expect(nombrePropio('angel francisco ramos Castillo')).toBe('Angel Francisco Ramos Castillo');
    expect(nombrePropio('MARÍA ÁLVAREZ')).toBe('María Álvarez');
  });

  it('respeta los espacios mientras se escribe', () => {
    expect(nombrePropio('angel ')).toBe('Angel ');
  });
});
