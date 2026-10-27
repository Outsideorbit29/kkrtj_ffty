import type { ChartTheme } from '../../lib/theme';

export { HALF_HOUR_MS, HOUR_MS } from '../../lib/chartData';

export const CHART_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 };

/** Phone widths: sparser time ticks and a narrower y axis. Presentation only. */
export const NARROW_QUERY = '(max-width: 479px)';

/** Round joins and caps for every line series. */
export const ROUND_LINE = { strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Recessive axis styling shared by every chart. */
export function axisStyle(theme: ChartTheme) {
  return {
    tick: { fill: theme.text, fontSize: 11 },
    tickLine: false,
    axisLine: { stroke: theme.axis, strokeWidth: 1 },
    tickMargin: 6,
  } as const;
}

export function yAxisStyle(theme: ChartTheme, narrow = false) {
  return { ...axisStyle(theme), axisLine: false, width: narrow ? 36 : 40 } as const;
}

/** Hover cursors: a hairline for line charts, a faint column for bar charts. */
export const lineCursor = (theme: ChartTheme) => ({ stroke: theme.axis, strokeWidth: 1 });
export const barCursor = (theme: ChartTheme) => ({ fill: theme.grid, fillOpacity: 0.6 });

/** Data dot: series fill with a surface ring so it reads over lines and the band. */
export const dotStyle = (theme: ChartTheme, color: string) => ({ r: 4, fill: color, stroke: theme.surface, strokeWidth: 2 });

/** Evenly spaced ticks between two timestamps. */
export function timeTicks(fromMs: number, toMs: number, stepMs: number): number[] {
  const ticks: number[] = [];
  for (let t = fromMs; t <= toMs; t += stepMs) ticks.push(t);
  return ticks;
}

/** Recharts passes the hovered x as `label`; normalise it to a number. */
export function labelToNumber(label: unknown): number | undefined {
  const n = typeof label === 'number' ? label : Number(label);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Round axis ticks (steps of 1, 2, 2.5 or 5 × 10^k) covering [min, max], always including 0.
 * Recharts' own nice ticks are skipped when one end of the domain is fixed, giving 5.5 / 16.5 steps.
 */
export function niceScale(values: number[], maxTicks = 6): { domain: [number, number]; ticks: number[] } {
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const span = hi - lo || 1;
  const magnitude = 10 ** Math.floor(Math.log10(span / maxTicks));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => Math.ceil(hi / s) - Math.floor(lo / s) < maxTicks) ??
    10 * magnitude;
  const from = Math.floor(lo / step) * step;
  const to = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = from; t <= to + step / 2; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
  return { domain: [from, to], ticks };
}

/** Colour for a signed error: over-forecast (shortfall risk) vs under-forecast. */
export const signColor = (theme: ChartTheme, value: number): string => (value >= 0 ? theme.over : theme.under);
