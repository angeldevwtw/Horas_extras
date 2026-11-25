import { expect, it } from 'vitest';
import { alternar, aplicarFiltros, estadoVisible, opcionesDe, paraHoras } from '../src/lib/filtrosAdmin';
import type { RegistroAdmin } from '../src/lib/tipos';

const base: RegistroAdmin = {
  codigo: 'HE-00001', identificacion: '900000001', nombre_completo: 'Colega Uno', cargo: 'Asistente',
  nivel: 73, filial: 'Banco', fecha_horas_extras: '2026-11-03', hora_inicio: '17:00:00', hora_final: '18:00:00',
  minutos_totales: 60, justificacion: 'Cierre', tipo_dia: 'habil', estado: 'registrada', aprobacion: 'pendiente',
  motivo_anulacion: null, motivo_decision: null, coordinador: 'Coord A', director: 'Dir A', decidido_por: null,
};

const registros: RegistroAdmin[] = [
  base,
  { ...base, codigo: 'HE-00002', filial: 'Sufi', aprobacion: 'aprobada', director: 'Dir B', coordinador: null },
  { ...base, codigo: 'HE-00003', estado: 'negada', aprobacion: 'negada', motivo_decision: 'Sin soporte' },
  { ...base, codigo: 'HE-00004', estado: 'anulada', identificacion: '900000002', nombre_completo: 'Colega Dos' },
];

it('el estado visible distingue pendiente, aprobada, negada y anulada', () => {
  expect(registros.map(estadoVisible)).toEqual(['pendiente', 'aprobada', 'negada', 'anulada']);
});

it('combina filtros de varios ejes y la búsqueda de texto', () => {
  expect(aplicarFiltros(registros, { filial: ['Banco'] }).map((r) => r.codigo))
    .toEqual(['HE-00001', 'HE-00003', 'HE-00004']);
  expect(aplicarFiltros(registros, { filial: ['Banco'], estado: ['negada', 'anulada'] }).map((r) => r.codigo))
    .toEqual(['HE-00003', 'HE-00004']);
  expect(aplicarFiltros(registros, {}, 'soporte').map((r) => r.codigo)).toEqual(['HE-00003']);
  expect(aplicarFiltros(registros, { coordinador: ['Sin coordinador'] }).map((r) => r.codigo)).toEqual(['HE-00002']);
});

it('con excepto ignora el filtro de ese eje', () => {
  expect(aplicarFiltros(registros, { filial: ['Sufi'] }, '', 'filial')).toHaveLength(4);
});

it('sin filtro de estado, las horas solo cuentan lo vigente', () => {
  expect(paraHoras(registros, {}).map((r) => r.codigo)).toEqual(['HE-00001', 'HE-00002']);
  expect(paraHoras(registros, { estado: ['negada'] })).toHaveLength(4);
});

it('alternar elige, reemplaza y quita', () => {
  expect(alternar({}, 'filial', 'Banco')).toEqual({ filial: ['Banco'] });
  expect(alternar({ filial: ['Banco'] }, 'filial', 'Sufi')).toEqual({ filial: ['Sufi'] });
  expect(alternar({ filial: ['Banco'] }, 'filial', 'Banco')).toEqual({ filial: [] });
  expect(alternar({ estado: ['pendiente'] }, 'estado', 'negada', true)).toEqual({ estado: ['pendiente', 'negada'] });
});

it('las opciones cuentan con los demás filtros y conservan lo elegido aunque quede en cero', () => {
  const opciones = opcionesDe(registros, { estado: ['aprobada'], colega: ['900000002'] }, '', 'colega');
  expect(opciones).toEqual([{ valor: '900000002', nombre: '900000002', detalle: '900000002', registros: 0 },
    { valor: '900000001', nombre: 'Colega Uno', detalle: '900000001', registros: 1 }]);
});
