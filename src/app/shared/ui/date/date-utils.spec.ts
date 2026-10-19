import {
  addDays, addMonths, clamp, describe as describeDate, formatSpanish, isValidIso, monthGrid, parseSpanish, weekdayIndex,
} from './date-utils';

describe('date-utils', () => {
  it('lee fechas dd/mm/aaaa con distintos separadores y sin ceros', () => {
    expect(parseSpanish('05/10/2026')).toBe('2026-10-05');
    expect(parseSpanish('5-10-2026')).toBe('2026-10-05');
    expect(parseSpanish(' 5.1.2026 ')).toBe('2026-01-05');
  });

  it('rechaza formatos y fechas que no existen', () => {
    for (const text of ['', '2026-10-05', '5/10/26', '31/02/2026', '00/10/2026', '10/13/2026', 'hola']) {
      expect(parseSpanish(text), text).toBeNull();
    }
    expect(parseSpanish('29/02/2028')).toBe('2028-02-29');
    expect(parseSpanish('29/02/2027')).toBeNull();
  });

  it('da formato dd/mm/aaaa y valida el ISO', () => {
    expect(formatSpanish('2026-10-05')).toBe('05/10/2026');
    expect(formatSpanish(null)).toBe('');
    expect(isValidIso('2026-02-30')).toBe(false);
    expect(isValidIso('2026-02-28')).toBe(true);
  });

  it('describe la fecha en español para lectores de pantalla', () => {
    expect(describeDate('2026-10-05')).toBe('lunes, 5 de octubre de 2026');
    expect(describeDate('2026-10-11')).toBe('domingo, 11 de octubre de 2026');
  });

  it('suma días y meses sin salirse del calendario', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
  });

  it('la semana empieza en lunes', () => {
    expect(weekdayIndex('2026-10-05')).toBe(0);
    expect(weekdayIndex('2026-10-11')).toBe(6);
    const grid = monthGrid(2026, 10);
    expect(grid.length).toBe(6);
    expect(grid[0][0].iso).toBe('2026-09-28');
    expect(grid[0][3]).toEqual({ iso: '2026-10-01', day: 1, inMonth: true });
    expect(grid[0][0].inMonth).toBe(false);
  });

  it('lleva la fecha al rango', () => {
    expect(clamp('2026-01-01', '2026-02-01', null)).toBe('2026-02-01');
    expect(clamp('2026-12-01', null, '2026-10-31')).toBe('2026-10-31');
    expect(clamp('2026-05-01', '2026-02-01', '2026-10-31')).toBe('2026-05-01');
  });
});
