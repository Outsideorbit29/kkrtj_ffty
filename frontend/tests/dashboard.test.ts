// Run with `npm test` (Node's built-in runner; Node >= 22.6 strips the TypeScript types).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { DayStat, SeriesPoint } from '../src/api/types';
import {
  cumulativeEnergy,
  directionSplit,
  divergingStep,
  energyTotals,
  heatmapRows,
  londonDate,
  londonHourOf,
  queryRows,
  rankDays,
  summarise,
  toExplorerRows,
  worstHour,
  type ExplorerQuery,
} from '../src/lib/dashboard.ts';

const point = (iso: string, forecast: number, actual: number | null): SeriesPoint => ({
  startTime: iso,
  forecast,
  actual,
  error: actual === null ? null : forecast - actual,
  horizonHours: 20,
});

const day = (date: string, over: Partial<DayStat> = {}): DayStat => ({
  date,
  mae: 1000,
  bias: 500,
  forecastMWh: 300_000,
  actualMWh: 250_000,
  ...over,
});

describe('London calendar helpers', () => {
  it('maps UTC instants to the UK day and hour (GMT in January)', () => {
    assert.equal(londonDate('2026-01-15T23:30:00Z'), '2026-01-15');
    assert.equal(londonHourOf('2026-01-15T23:30:00Z'), 23);
  });

  it('applies BST in summer', () => {
    assert.equal(londonDate('2026-07-01T23:30:00Z'), '2026-07-02');
    assert.equal(londonHourOf('2026-07-01T23:30:00Z'), 0);
  });
});

describe('heatmapRows', () => {
  it('builds one row of 24 cells per day, sorted, with gaps as null', () => {
    const rows = heatmapRows([
      point('2026-01-16T05:00:00Z', 9000, 8000),
      point('2026-01-15T00:00:00Z', 10_000, 9000),
      point('2026-01-15T01:00:00Z', 10_000, null),
    ]);
    assert.deepEqual(
      rows.map((r) => r.date),
      ['2026-01-15', '2026-01-16'],
    );
    assert.equal(rows[0]!.cells.length, 24);
    assert.equal(rows[0]!.cells[0]!.error, 1000);
    assert.equal(rows[0]!.cells[1]!.error, null);
    assert.equal(rows[0]!.cells[2], null);
    assert.equal(rows[1]!.cells[5]!.error, 1000);
  });
});

describe('divergingStep', () => {
  it('is 0 near zero, signed, and clamped at the outer step', () => {
    assert.equal(divergingStep(100, 4000, 4), 0);
    assert.equal(divergingStep(900, 4000, 4), 1);
    assert.equal(divergingStep(-2500, 4000, 4), -3);
    assert.equal(divergingStep(9000, 4000, 4), 4);
    assert.equal(divergingStep(-9000, 4000, 4), -4);
  });
});

describe('energy', () => {
  it('accumulates forecast and actual energy in GWh', () => {
    const points = cumulativeEnergy([day('2026-01-02'), day('2026-01-03', { forecastMWh: 100_000, actualMWh: 150_000 })]);
    assert.deepEqual(points.at(-1), { date: '2026-01-03', forecastGWh: 400, actualGWh: 400, gapGWh: 0 });
    assert.equal(points[0]!.gapGWh, 50);
  });

  it('totals the gap as a share of actual energy', () => {
    const t = energyTotals([day('2026-01-02')]);
    assert.equal(t.gapMWh, 50_000);
    assert.equal(t.gapPct, 20);
    assert.equal(energyTotals([]).gapPct, null);
  });
});

describe('direction and worst hour', () => {
  const series = [point('2026-01-15T00:00:00Z', 10_000, 8000), point('2026-01-15T01:00:00Z', 5000, 9000), point('2026-01-15T02:00:00Z', 5000, null)];

  it('splits hours with an error into over- and under-forecast', () => {
    assert.deepEqual(directionSplit(series), { n: 2, over: 1, under: 1, overPct: 50 });
  });

  it('finds the largest absolute miss, whichever its sign', () => {
    assert.equal(worstHour(series)?.error, -4000);
  });
});

describe('rankDays', () => {
  const days = [day('a', { bias: 100, mae: 900 }), day('b', { bias: 900, mae: 100 }), day('c', { bias: -500, mae: 500, actualMWh: 400_000 })];

  it('ranks by bias, MAE or energy shortfall, largest first', () => {
    assert.deepEqual(rankDays(days, 'bias', 2).map((d) => d.date), ['b', 'a']);
    assert.deepEqual(rankDays(days, 'mae', 1).map((d) => d.date), ['a']);
    assert.equal(rankDays(days, 'shortfall', 3).at(-1)!.date, 'c');
  });
});

describe('explorer queries', () => {
  const rows = toExplorerRows([
    point('2026-01-15T00:00:00Z', 10_000, 8000),
    point('2026-01-15T01:00:00Z', 5000, 9000),
    point('2026-01-16T00:00:00Z', 7000, 6500),
    point('2026-01-16T01:00:00Z', 7000, null),
  ]);
  const base: ExplorerQuery = { direction: 'all', minAbsError: 0, hour: -1, date: '', sort: 'absError', desc: true };

  it('sorts by absolute error with missing values last', () => {
    const sorted = queryRows(rows, base).map((r) => r.absError);
    assert.deepEqual(sorted, [4000, 2000, 500, null]);
    assert.equal(queryRows(rows, { ...base, desc: false }).at(-1)!.absError, null);
  });

  it('filters by direction, size, day and hour', () => {
    assert.equal(queryRows(rows, { ...base, direction: 'over' }).length, 2);
    assert.equal(queryRows(rows, { ...base, direction: 'under' }).length, 1);
    assert.equal(queryRows(rows, { ...base, minAbsError: 1000 }).length, 2);
    assert.equal(queryRows(rows, { ...base, date: '2026-01-16' }).length, 2);
    assert.equal(queryRows(rows, { ...base, hour: 1 }).length, 2);
  });

  it('summarises MAE and bias over rows with an error', () => {
    assert.deepEqual(summarise(rows), { n: 3, mae: 6500 / 3, bias: (2000 - 4000 + 500) / 3 });
    assert.deepEqual(summarise([]), { n: 0, mae: null, bias: null });
  });
});
