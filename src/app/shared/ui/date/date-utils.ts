/**
 * Utilidades de fechas para `tha-date`. Las fechas viajan como texto ISO `aaaa-mm-dd` (sin hora ni zona), así
 * que no hay desfases por zona horaria y se pueden comparar como texto.
 */

export const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** La semana empieza en lunes. */
export const WEEKDAYS = [
  { short: 'L', full: 'lunes' },
  { short: 'M', full: 'martes' },
  { short: 'X', full: 'miércoles' },
  { short: 'J', full: 'jueves' },
  { short: 'V', full: 'viernes' },
  { short: 'S', full: 'sábado' },
  { short: 'D', full: 'domingo' },
];

export interface CalendarDay {
  iso: string;
  day: number;
  inMonth: boolean;
}

const pad = (n: number, size = 2) => String(n).padStart(size, '0');

export function toIso(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

export function isValidIso(iso: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** `dd/mm/aaaa` (también con `-` o `.` y sin ceros) → ISO; null si no es una fecha real. */
export function parseSpanish(text: string): string | null {
  const match = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*$/.exec(text);
  if (!match) return null;
  const iso = toIso(Number(match[3]), Number(match[2]), Number(match[1]));
  return isValidIso(iso) ? iso : null;
}

export function formatSpanish(iso: string | null): string {
  if (!iso || !isValidIso(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Texto largo para lectores de pantalla: «lunes, 5 de octubre de 2026». */
export function describe(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return `${WEEKDAYS[weekday].full}, ${d} de ${MONTHS[m - 1]} de ${y}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return toIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** Suma meses conservando el día; si no existe en el mes de destino (31 → febrero) usa el último día. */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const year = target.getUTCFullYear();
  const month = target.getUTCMonth() + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return toIso(year, month, Math.min(d, last));
}

/** Lunes de la semana de la fecha (0 = lunes … 6 = domingo para el día de la semana). */
export function weekdayIndex(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** Seis semanas de siete días que contienen el mes, empezando en lunes. */
export function monthGrid(year: number, month: number): CalendarDay[][] {
  const first = toIso(year, month, 1);
  const start = addDays(first, -weekdayIndex(first));
  const weeks: CalendarDay[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const iso = addDays(start, w * 7 + d);
      const [y, m, day] = iso.split('-').map(Number);
      week.push({ iso, day, inMonth: y === year && m === month });
    }
    weeks.push(week);
  }
  return weeks;
}

/** Hoy, en la zona horaria del navegador, como ISO. */
export function todayIso(): string {
  const now = new Date();
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** Lleva la fecha al rango [min, max] (cualquiera de los dos puede faltar). */
export function clamp(iso: string, min: string | null, max: string | null): string {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}
