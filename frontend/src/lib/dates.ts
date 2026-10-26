/** Arithmetic on `YYYY-MM-DD` calendar dates, done in UTC to avoid local-time surprises. */

import type { IsoDate } from '../api/types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function parse(date: IsoDate): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

export const isIsoDate = (value: string): boolean => DATE_RE.test(value) && !Number.isNaN(parse(value).getTime());

export const isHhMm = (value: string): boolean => HHMM_RE.test(value);

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function clampDate(date: IsoDate, min: IsoDate, max: IsoDate): IsoDate {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

const calFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
const calLongFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const calTickFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' });

/** "Wed 14 Jan" */
export const formatCalendarDate = (date: IsoDate): string => calFmt.format(parse(date));
/** "Wednesday 14 January 2026" */
export const formatCalendarDateLong = (date: IsoDate): string => calLongFmt.format(parse(date));
/** "14 Jan" */
export const formatCalendarTick = (date: IsoDate): string => calTickFmt.format(parse(date));
