import { DateRange, IsoDate } from '../api/models';

/**
 * Las fechas se manejan como texto ISO y se interpretan en UTC, para que ningún huso
 * horario del navegador mueva un día. La API ya entrega las fechas en hora de Perú.
 */

const PERU_UTC_OFFSET_HOURS = -5;
const MS_PER_DAY = 86_400_000;

const LONG_DATE = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const SHORT_DATE = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const WEEKDAY = new Intl.DateTimeFormat('es-PE', { weekday: 'long', timeZone: 'UTC' });
const TIME = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

export const MONTH_ABBREVIATIONS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'] as const;

/** Lunes primero, como en los calendarios de Perú. */
export const WEEKDAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

export function toDate(iso: IsoDate): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function toIso(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function isoOf(year: number, month: number, day: number): IsoDate {
  return toIso(new Date(Date.UTC(year, month - 1, day)));
}

export function yearOf(iso: IsoDate): number {
  return Number(iso.slice(0, 4));
}

export function monthOf(iso: IsoDate): number {
  return Number(iso.slice(5, 7));
}

export function dayOf(iso: IsoDate): number {
  return Number(iso.slice(8, 10));
}

export function yearRange(year: number): DateRange {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  return toIso(new Date(toDate(iso).getTime() + days * MS_PER_DAY));
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Posición del día 1 del mes en una semana que empieza en lunes (0 = lunes). */
export function firstWeekdayOffset(year: number, month: number): number {
  return (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
}

/** Día del año contado sobre un año bisiesto (0–365): el 1 de marzo siempre es el 60. */
export function leapDayIndex(iso: IsoDate): number {
  const start = Date.UTC(2000, 0, 1);
  return Math.round((Date.UTC(2000, monthOf(iso) - 1, dayOf(iso)) - start) / MS_PER_DAY);
}

/** "13 de setiembre de 2024" (así lo escribe el español de Perú) */
export function formatLongDate(iso: IsoDate): string {
  return LONG_DATE.format(toDate(iso));
}

/** "13 set" */
export function formatShortDate(iso: IsoDate): string {
  return SHORT_DATE.format(toDate(iso)).replace('.', '');
}

/** "viernes" */
export function formatWeekday(iso: IsoDate): string {
  return WEEKDAY.format(toDate(iso));
}

/** Hora de Perú ("14:08") a partir de un instante UTC sin zona ("2024-09-13T19:08:00"). */
export function formatPeruTime(utcDateTime: string): string {
  const utc = new Date(`${utcDateTime}Z`);
  return TIME.format(new Date(utc.getTime() + PERU_UTC_OFFSET_HOURS * 3_600_000));
}
