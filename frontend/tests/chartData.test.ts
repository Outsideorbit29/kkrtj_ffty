// Run with `npm test` (Node's built-in runner; Node >= 22.6 strips the TypeScript types).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ForecastLevelBucket, ForecastRun, HourlyRow, LeadTimePoint } from '../src/api/types';
import {
  HOUR_MS,
  bandBacktest,
  buildDecisionPoints,
  buildRunsPoints,
  errorSpread,
  expectedEnergy,
  forecastLevelTrend,
  leadTimeSummary,
} from '../src/lib/chartData.ts';
import { toCsv, withBom } from '../src/lib/csv.ts';

const T0 = Date.parse('2026-01-15T00:00:00Z');
const iso = (h: number) => new Date(T0 + h * HOUR_MS).toISOString().replace('.000Z', 'Z');

function row(h: number, over: Partial<HourlyRow> = {}): HourlyRow {
  return {
    startTime: iso(h),
    forecast: 10_000,
    p50: 8_500,
    p10: 6_000,
    p90: 11_000,
    actual: 9_000,
    error: 1_000,
    horizonHours: 16 + h,
    ...over,
  };
}

const dayOf = (n: number, f: (h: number) => Partial<HourlyRow> = () => ({})) =>
  Array.from({ length: n }, (_, h) => row(h, f(h)));

describe('buildDecisionPoints', () => {
  it('closes every series one hour after the last hour on a fully covered day', () => {
    const points = buildDecisionPoints(dayOf(24), []);
    const last = points.at(-1)!;
    assert.equal(last.t, T0 + 24 * HOUR_MS);
    assert.equal(last.forecast, 10_000);
    assert.equal(last.p50, 8_500);
    assert.deepEqual(last.band, [6_000, 11_000]);
    assert.equal(last.actual, 9_000);
  });

  it('closes the forecast, P50 and band after their own last hour when the run ends early', () => {
    const uncovered = { forecast: null, p50: null, p10: null, p90: null, error: null, horizonHours: null };
    const hourly = dayOf(24, (h) => (h >= 22 ? uncovered : { forecast: 10_000 + h }));
    const points = buildDecisionPoints(hourly, []);
    const at = (h: number) => points.find((p) => p.t === T0 + h * HOUR_MS)!;
    // The 21:00-22:00 step must be drawn: a closing value at 22:00 equal to the 21:00 forecast.
    assert.equal(at(22).forecast, 10_021);
    assert.equal(at(22).p50, 8_500);
    assert.deepEqual(at(22).band, [6_000, 11_000]);
    assert.equal(at(23).forecast, undefined);
    // Actuals are still known for 22:00 and 23:00 and close at midnight.
    assert.equal(at(22).actual, 9_000);
    assert.equal(at(24).actual, 9_000);
    assert.equal(at(24).forecast, undefined);
  });

  it('adds a half-hour closing point for half-hourly actuals', () => {
    const points = buildDecisionPoints(dayOf(1), [
      { startTime: iso(0), generation: 1 },
      { startTime: new Date(T0 + HOUR_MS / 2).toISOString(), generation: 2 },
    ]);
    assert.equal(points.find((p) => p.t === T0 + HOUR_MS)?.halfHourly, 2);
  });
});

describe('buildRunsPoints', () => {
  const runs: ForecastRun[] = [
    {
      publishTimeUtc: '2026-01-14T07:30:00Z',
      availableAtDecision: true,
      isDecisionRun: true,
      points: [...dayOf(25)].map((r, h) => ({ startTime: r.startTime, forecast: 100 + h })),
    },
  ];

  it('ends at midnight with a closing point copied from the last hour', () => {
    const { points, byHour } = buildRunsPoints(runs, dayOf(24));
    assert.equal(points.length, 25);
    const last = points.at(-1)!;
    assert.equal(last.t, T0 + 24 * HOUR_MS);
    assert.equal(last.run0, 123);
    assert.equal(last.actual, 9_000);
    // Hour-start map excludes the closing point and the run's points beyond D.
    assert.equal(byHour.size, 24);
    assert.equal(byHour.has(T0 + 24 * HOUR_MS), false);
  });
});

describe('KPI helpers', () => {
  it('counts hours inside the band, ignoring hours without band or actual', () => {
    const hourly = [
      row(0, { actual: 6_000 }), // on P10: inside
      row(1, { actual: 11_000 }), // on P90: inside
      row(2, { actual: 5_999 }), // below
      row(3, { actual: 11_001 }), // above
      row(4, { actual: null }),
      row(5, { p10: null, p90: null }),
    ];
    assert.deepEqual(bandBacktest(hourly), { n: 4, inBand: 2 });
    assert.deepEqual(bandBacktest([]), { n: 0, inBand: 0 });
  });

  it('sums P50, P10 and forecast over the same hours', () => {
    const hourly = [row(0), row(1), row(2, { p50: null, p10: null, p90: null })];
    assert.deepEqual(expectedEnergy(hourly), { hours: 2, p50MWh: 17_000, p10MWh: 12_000, forecastMWh: 20_000 });
    assert.deepEqual(expectedEnergy([row(0, { p50: null })]), { hours: 0, p50MWh: null, p10MWh: null, forecastMWh: null });
  });
});

describe('lead time', () => {
  const pt = (leadFrom: number, n: number, mae: number, bias: number): LeadTimePoint => ({
    leadHours: leadFrom,
    leadFrom,
    leadTo: leadFrom + 3,
    n,
    mae,
    rmse: mae * 1.2,
    bias,
  });

  it('weights the decision window by hours and reports the first bucket', () => {
    const points = [pt(3, 10, 1_800, 1_400), pt(0, 10, 1_700, 1_460), pt(18, 100, 2_000, 1_800), pt(21, 300, 2_100, 1_700), pt(45, 50, 2_500, 1_000)];
    const s = leadTimeSummary(points, { from: 17, to: 23.5 })!;
    assert.equal(s.first.leadFrom, 0);
    assert.equal(s.window!.mae, (2_000 * 100 + 2_100 * 300) / 400);
    assert.equal(s.window!.bias, (1_800 * 100 + 1_700 * 300) / 400);
    assert.equal(leadTimeSummary(points)!.window, undefined);
    assert.equal(leadTimeSummary([pt(0, 0, 1, 1)]), undefined);
  });

  it('separates spread from bias', () => {
    assert.equal(errorSpread({ rmse: 5, bias: 3 }), 4);
    assert.equal(errorSpread({ rmse: 1, bias: 2 }), 0);
  });
});

describe('forecastLevelTrend', () => {
  const level = (fromGw: number, n: number, bias: number): ForecastLevelBucket => ({
    bucket: `${fromGw}-${fromGw + 4} GW`,
    from: fromGw * 1000,
    to: (fromGw + 4) * 1000,
    n,
    mae: Math.abs(bias),
    bias,
    overForecastShare: bias > 0 ? 0.9 : 0.4,
  });

  it('compares the end buckets, skipping thin ones', () => {
    const t = forecastLevelTrend([level(20, 43, 4_500), level(0, 7, 1_100), level(4, 133, 280), level(16, 228, 2_500)])!;
    assert.equal(t.low.from, 4_000);
    assert.equal(t.high.from, 20_000);
    assert.equal(t.rising, true);
    assert.equal(forecastLevelTrend([level(4, 100, 900), level(16, 100, 300)])!.rising, false);
  });

  it('needs two solid buckets', () => {
    assert.equal(forecastLevelTrend([level(8, 200, 1_000), level(0, 5, 100)]), undefined);
    assert.equal(forecastLevelTrend([]), undefined);
  });
});

describe('csv', () => {
  it('quotes cells and uses CRLF line endings', () => {
    assert.equal(toCsv(['a', 'b'], [['x,y', null], [1, 'q"']]), 'a,b\r\n"x,y",\r\n1,"q"""');
  });

  it('prefixes a UTF-8 BOM only for CSV', () => {
    assert.equal(withBom('00:00–01:00', 'text/csv;charset=utf-8'), '﻿00:00–01:00');
    assert.equal(withBom('{}', 'application/json'), '{}');
  });
});
