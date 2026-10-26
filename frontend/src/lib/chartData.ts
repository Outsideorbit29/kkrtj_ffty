/**
 * Pure data shaping for charts and KPI tiles. This module has no runtime imports (types only),
 * so `npm test` can run it directly under Node's built-in test runner.
 */
import type { ForecastLevelBucket, ForecastRun, HalfHourlyActual, HourlyRow, LeadTimePoint } from '../api/types';

export const HOUR_MS = 3_600_000;
export const HALF_HOUR_MS = HOUR_MS / 2;

const ms = (iso: string): number => Date.parse(iso);

/* ---------- Decision chart ---------- */

export interface DecisionPoint {
  t: number;
  forecast?: number;
  p50?: number;
  band?: [number, number];
  actual?: number | null;
  halfHourly?: number;
}

/**
 * Hourly values are averages over [H, H+1), so they are drawn as steps. Each series closes one
 * hour (half-hour for the half-hourly actuals) after its own last non-null row, so its final
 * period stays visible even when the decision run ends before midnight. A closing point only
 * sets its own series' field and never overwrites values on the next hour's point.
 */
export function buildDecisionPoints(hourly: HourlyRow[], halfHourly: HalfHourlyActual[]): DecisionPoint[] {
  const byTime = new Map<number, DecisionPoint>();
  const at = (t: number): DecisionPoint => {
    let p = byTime.get(t);
    if (!p) byTime.set(t, (p = { t }));
    return p;
  };

  hourly.forEach((row) =>
    Object.assign(at(ms(row.startTime)), {
      forecast: row.forecast ?? undefined,
      p50: row.p50 ?? undefined,
      band: row.p10 !== null && row.p90 !== null ? [row.p10, row.p90] : undefined,
      actual: row.actual,
    }),
  );
  const lastWith = (pred: (r: HourlyRow) => boolean) => [...hourly].reverse().find(pred);
  const closeAt = (row: HourlyRow) => at(ms(row.startTime) + HOUR_MS);
  const lastF = lastWith((r) => r.forecast !== null);
  if (lastF) closeAt(lastF).forecast = lastF.forecast ?? undefined;
  const lastP50 = lastWith((r) => r.p50 != null);
  if (lastP50) closeAt(lastP50).p50 = lastP50.p50 ?? undefined;
  const lastB = lastWith((r) => r.p10 !== null && r.p90 !== null);
  if (lastB && lastB.p10 !== null && lastB.p90 !== null) closeAt(lastB).band = [lastB.p10, lastB.p90];
  const lastA = lastWith((r) => r.actual !== null);
  if (lastA) closeAt(lastA).actual = lastA.actual;

  halfHourly.forEach((row) => (at(ms(row.startTime)).halfHourly = row.generation));
  const lastHalf = halfHourly.at(-1);
  if (lastHalf) at(ms(lastHalf.startTime) + HALF_HOUR_MS).halfHourly = lastHalf.generation;

  return [...byTime.values()].sort((a, b) => a.t - b.t);
}

/* ---------- Runs chart ---------- */

export type RunsPoint = { t: number; actual?: number | null } & Record<string, number | null | undefined>;

export const runKey = (i: number) => `run${i}`;

/**
 * One point per delivery hour with the actual and every run's value, plus a closing point one
 * hour after the last hour (copying its values) so stepAfter lines end at midnight like the
 * decision chart. `byHour` holds only the real hour-start points, for tooltips and scaling.
 */
export function buildRunsPoints(runs: ForecastRun[], hourly: HourlyRow[]): { points: RunsPoint[]; byHour: Map<number, RunsPoint> } {
  const byHour = new Map<number, RunsPoint>();
  hourly.forEach((row) => byHour.set(ms(row.startTime), { t: ms(row.startTime), actual: row.actual }));
  // Runs can extend beyond D; keep only the delivery day's hours.
  runs.forEach((run, i) =>
    run.points.forEach((pt) => {
      const point = byHour.get(ms(pt.startTime));
      if (point) point[runKey(i)] = pt.forecast;
    }),
  );
  const points = [...byHour.values()].sort((a, b) => a.t - b.t);
  const last = points.at(-1);
  if (last) points.push({ ...last, t: last.t + HOUR_MS });
  return { points, byHour };
}

/* ---------- KPI helpers ---------- */

/** Sum of the non-null values, or null when there are none. */
export function sumOrNull(values: (number | null | undefined)[]): number | null {
  const present = values.filter((v): v is number => v != null);
  return present.length ? present.reduce((sum, v) => sum + v, 0) : null;
}

/** Backtest of the P10–P90 band on one day: hours with band and actual, and how many fell inside. */
export function bandBacktest(hourly: HourlyRow[]): { n: number; inBand: number } {
  const rows = hourly.filter((r) => r.p10 !== null && r.p90 !== null && r.actual !== null);
  const inBand = rows.filter((r) => r.p10! <= r.actual! && r.actual! <= r.p90!).length;
  return { n: rows.length, inBand };
}

/** Energy totals over the hours that have a P50 (and so a band), so the figures are comparable. */
export function expectedEnergy(hourly: HourlyRow[]): {
  hours: number;
  p50MWh: number | null;
  p10MWh: number | null;
  forecastMWh: number | null;
} {
  const rows = hourly.filter((r) => r.p50 != null && r.forecast !== null);
  return {
    hours: rows.length,
    p50MWh: sumOrNull(rows.map((r) => r.p50)),
    p10MWh: sumOrNull(rows.map((r) => r.p10)),
    forecastMWh: sumOrNull(rows.map((r) => r.forecast)),
  };
}

/* ---------- Lead time ---------- */

/** Standard deviation of the error, i.e. the part of RMSE that is not a constant offset. */
export const errorSpread = (p: { rmse: number; bias: number }): number => Math.sqrt(Math.max(p.rmse ** 2 - p.bias ** 2, 0));

export interface LeadTimeSummary {
  /** Shortest lead-time bucket with data (normally 0–3 h). */
  first: LeadTimePoint;
  /** Hour-weighted MAE and bias over the buckets that overlap the decision horizon. */
  window: { mae: number; bias: number } | undefined;
}

export function leadTimeSummary(points: LeadTimePoint[], horizon?: { from: number; to: number }): LeadTimeSummary | undefined {
  const withData = points.filter((p) => p.n > 0).sort((a, b) => a.leadFrom - b.leadFrom);
  const first = withData[0];
  if (!first) return undefined;
  const inside = horizon ? withData.filter((p) => p.leadTo > horizon.from && p.leadFrom < horizon.to) : [];
  const n = inside.reduce((sum, p) => sum + p.n, 0);
  const window = n
    ? {
        mae: inside.reduce((sum, p) => sum + p.mae * p.n, 0) / n,
        bias: inside.reduce((sum, p) => sum + p.bias * p.n, 0) / n,
      }
    : undefined;
  return { first, window };
}

/* ---------- Forecast level ---------- */

export interface ForecastLevelTrend {
  /** Lowest and highest forecast-level buckets with at least `minHours` hours. */
  low: ForecastLevelBucket;
  high: ForecastLevelBucket;
  /** True when the bias in the top bucket exceeds the bias in the bottom one. */
  rising: boolean;
}

/**
 * Compares bias at the low and high ends of the forecast range, ignoring thin buckets (default:
 * fewer than a day's worth of hours) so a handful of calm hours cannot set the story.
 */
export function forecastLevelTrend(buckets: ForecastLevelBucket[], minHours = 24): ForecastLevelTrend | undefined {
  const solid = buckets.filter((b) => b.n >= minHours).sort((a, b) => a.from - b.from);
  const low = solid[0];
  const high = solid.at(-1);
  if (!low || !high || low === high) return undefined;
  return { low, high, rising: high.bias > low.bias };
}
