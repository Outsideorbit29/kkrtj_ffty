/**
 * Pure data shaping for the dashboard views (heatmap, cumulative energy, rankings, explorer).
 * Types-only imports, so `npm test` can run it directly under Node's built-in test runner.
 */
import type { DayStat, IsoDate, SeriesPoint } from '../api/types';

const londonDateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const londonHourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hourCycle: 'h23' });

/** Europe/London calendar date of a UTC instant, `YYYY-MM-DD`. */
export const londonDate = (iso: string | number): IsoDate => londonDateFmt.format(new Date(iso));
/** Europe/London hour of day of a UTC instant, 0-23. */
export const londonHourOf = (iso: string | number): number => Number(londonHourFmt.format(new Date(iso)));

/* ---------- Heatmap ---------- */

export interface HeatCell {
  date: IsoDate;
  hour: number;
  error: number | null;
  forecast: number;
  actual: number | null;
}

/** One row per delivery day, 24 hourly cells each (null where the hour is missing). */
export function heatmapRows(series: SeriesPoint[]): { date: IsoDate; cells: (HeatCell | null)[] }[] {
  const byDay = new Map<IsoDate, (HeatCell | null)[]>();
  for (const p of series) {
    const date = londonDate(p.startTime);
    const hour = londonHourOf(p.startTime);
    let cells = byDay.get(date);
    if (!cells) byDay.set(date, (cells = Array.from({ length: 24 }, () => null)));
    // Clock-change days have a repeated or missing hour; the first value for an hour wins.
    cells[hour] ??= { date, hour, error: p.error, forecast: p.forecast, actual: p.actual };
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, cells]) => ({ date, cells }));
}

/** Diverging bucket for a signed error: -steps..+steps, 0 within ±`zero` MW, clamped at ±`max`. */
export function divergingStep(value: number, max: number, steps: number, zero = 250): number {
  if (Math.abs(value) < zero) return 0;
  const k = Math.ceil((Math.min(Math.abs(value), max) / max) * steps);
  return Math.sign(value) * Math.max(1, Math.min(steps, k));
}

/* ---------- Energy ---------- */

export interface CumulativePoint {
  date: IsoDate;
  forecastGWh: number;
  actualGWh: number;
  gapGWh: number;
}

/** Running totals of daily forecast and actual energy, in GWh. */
export function cumulativeEnergy(days: DayStat[]): CumulativePoint[] {
  let forecast = 0;
  let actual = 0;
  return days.map((d) => {
    forecast += d.forecastMWh / 1000;
    actual += d.actualMWh / 1000;
    return { date: d.date, forecastGWh: forecast, actualGWh: actual, gapGWh: forecast - actual };
  });
}

export function energyTotals(days: DayStat[]): { forecastMWh: number; actualMWh: number; gapMWh: number; gapPct: number | null } {
  const forecastMWh = days.reduce((s, d) => s + d.forecastMWh, 0);
  const actualMWh = days.reduce((s, d) => s + d.actualMWh, 0);
  const gapMWh = forecastMWh - actualMWh;
  return { forecastMWh, actualMWh, gapMWh, gapPct: actualMWh > 0 ? (gapMWh / actualMWh) * 100 : null };
}

/* ---------- Direction split ---------- */

export function directionSplit(series: SeriesPoint[]): { n: number; over: number; under: number; overPct: number | null } {
  const errors = series.map((p) => p.error).filter((e): e is number => e !== null);
  const over = errors.filter((e) => e > 0).length;
  const under = errors.filter((e) => e < 0).length;
  return { n: errors.length, over, under, overPct: errors.length ? (over / errors.length) * 100 : null };
}

/** Hour with the largest absolute error. */
export function worstHour(series: SeriesPoint[]): SeriesPoint | undefined {
  let worst: SeriesPoint | undefined;
  for (const p of series) {
    if (p.error !== null && (worst?.error == null || Math.abs(p.error) > Math.abs(worst.error))) worst = p;
  }
  return worst;
}

/* ---------- Rankings ---------- */

export type DayRankKey = 'bias' | 'mae' | 'shortfall';

/** Top `n` delivery days by bias (most over-forecast first), MAE, or energy shortfall. */
export function rankDays(days: DayStat[], key: DayRankKey, n: number): DayStat[] {
  const score = (d: DayStat) => (key === 'shortfall' ? d.forecastMWh - d.actualMWh : d[key]);
  return [...days].sort((a, b) => score(b) - score(a)).slice(0, n);
}

/* ---------- Explorer ---------- */

export type Direction = 'all' | 'over' | 'under';
export type SortKey = 'startTime' | 'forecast' | 'actual' | 'error' | 'absError' | 'horizonHours';

export interface ExplorerRow extends SeriesPoint {
  date: IsoDate;
  hour: number;
  absError: number | null;
}

export interface ExplorerQuery {
  direction: Direction;
  minAbsError: number;
  /** -1 for every hour. */
  hour: number;
  /** Delivery day `YYYY-MM-DD`, or '' for every day. */
  date: IsoDate | '';
  sort: SortKey;
  desc: boolean;
}

export const toExplorerRows = (series: SeriesPoint[]): ExplorerRow[] =>
  series.map((p) => ({
    ...p,
    date: londonDate(p.startTime),
    hour: londonHourOf(p.startTime),
    absError: p.error === null ? null : Math.abs(p.error),
  }));

export function queryRows(rows: ExplorerRow[], q: ExplorerQuery): ExplorerRow[] {
  const kept = rows.filter((r) => {
    if (q.date && r.date !== q.date) return false;
    if (q.hour >= 0 && r.hour !== q.hour) return false;
    if (q.direction !== 'all' || q.minAbsError > 0) {
      if (r.error === null) return false;
      if (q.direction === 'over' && !(r.error > 0)) return false;
      if (q.direction === 'under' && !(r.error < 0)) return false;
      if (Math.abs(r.error) < q.minAbsError) return false;
    }
    return true;
  });
  const value = (r: ExplorerRow): number | string | null => r[q.sort];
  const dir = q.desc ? -1 : 1;
  return kept.sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    // Missing values always sort last, whichever the direction.
    if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
    return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
  });
}

/** MAE and bias over the rows that have an error, for the explorer's summary strip. */
export function summarise(rows: ExplorerRow[]): { n: number; mae: number | null; bias: number | null } {
  const errors = rows.map((r) => r.error).filter((e): e is number => e !== null);
  if (errors.length === 0) return { n: 0, mae: null, bias: null };
  return {
    n: errors.length,
    mae: errors.reduce((s, e) => s + Math.abs(e), 0) / errors.length,
    bias: errors.reduce((s, e) => s + e, 0) / errors.length,
  };
}
