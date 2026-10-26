import { useMemo } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { HalfHourlyActual, HourlyRow } from '../../api/types';
import { useChartTheme } from '../../hooks/useChartTheme';
import { formatPower, formatTime, gwTick, toMs } from '../../lib/format';
import type { ChartTheme } from '../../lib/theme';
import { Legend } from '../Legend';
import { TooltipFrame, type TooltipRow } from '../TooltipFrame';
import { CHART_MARGIN, HALF_HOUR_MS, HOUR_MS, axisStyle, labelToNumber, timeTicks, yAxisStyle, niceScale } from './common';

interface Point {
  t: number;
  forecast?: number;
  band?: [number, number];
  actual?: number | null;
  halfHourly?: number;
}

/**
 * Hourly values are averages over [H, H+1), so they are drawn as steps. Each step series gets a
 * closing point at the end of its last period so the final hour/half-hour is visible.
 */
function buildPoints(hourly: HourlyRow[], halfHourly: HalfHourlyActual[]): Point[] {
  const byTime = new Map<number, Point>();
  const at = (t: number): Point => {
    let p = byTime.get(t);
    if (!p) byTime.set(t, (p = { t }));
    return p;
  };
  const putHour = (t: number, row: HourlyRow) =>
    Object.assign(at(t), {
      forecast: row.forecast ?? undefined,
      band: row.p10 !== null && row.p90 !== null ? [row.p10, row.p90] : undefined,
      actual: row.actual,
    });

  hourly.forEach((row) => putHour(toMs(row.startTime), row));
  const lastHour = hourly.at(-1);
  if (lastHour) putHour(toMs(lastHour.startTime) + HOUR_MS, lastHour);

  halfHourly.forEach((row) => (at(toMs(row.startTime)).halfHourly = row.generation));
  const lastHalf = halfHourly.at(-1);
  if (lastHalf) at(toMs(lastHalf.startTime) + HALF_HOUR_MS).halfHourly = lastHalf.generation;

  return [...byTime.values()].sort((a, b) => a.t - b.t);
}

function DecisionTooltip(props: {
  t: number | undefined;
  hourly: Map<number, HourlyRow>;
  halfHourly: Map<number, number>;
  theme: ChartTheme;
}) {
  const { t, hourly, halfHourly, theme } = props;
  if (t === undefined) return null;
  const hourStart = Math.floor(t / HOUR_MS) * HOUR_MS;
  const row = hourly.get(hourStart);
  if (!row) return null;

  const first = halfHourly.get(hourStart);
  const second = halfHourly.get(hourStart + HALF_HOUR_MS);
  const rows: TooltipRow[] = [
    { name: 'Forecast', value: formatPower(row.forecast), color: theme.forecast },
    { name: 'Likely range (P10–P90)', value: `${formatPower(row.p10)} – ${formatPower(row.p90)}` },
    { name: 'Actual (hourly)', value: formatPower(row.actual), color: theme.actual },
    { name: 'Error (fcst − actual)', value: formatPower(row.error, { signed: true }) },
  ];
  if (first !== undefined || second !== undefined) {
    rows.push({
      name: 'Half-hourly actuals',
      value: `${formatPower(first)} / ${formatPower(second)}`,
      color: theme.actual,
      dashed: true,
    });
  }
  return (
    <TooltipFrame
      title={`${formatTime(hourStart)}–${formatTime(hourStart + HOUR_MS)}`}
      rows={rows}
      note={row.horizonHours === null ? 'Not covered by the decision run' : `Forecast issued ${row.horizonHours.toFixed(1)} h ahead`}
    />
  );
}

interface DecisionChartProps {
  hourly: HourlyRow[];
  actualHalfHourly: HalfHourlyActual[];
}

export function DecisionChart({ hourly, actualHalfHourly }: DecisionChartProps) {
  const theme = useChartTheme();
  const points = useMemo(() => buildPoints(hourly, actualHalfHourly), [hourly, actualHalfHourly]);
  const hourlyByTime = useMemo(() => new Map(hourly.map((r) => [toMs(r.startTime), r])), [hourly]);
  const halfByTime = useMemo(
    () => new Map(actualHalfHourly.map((r) => [toMs(r.startTime), r.generation])),
    [actualHalfHourly],
  );

  const first = hourly[0];
  if (!first) return <p className="empty">No hourly forecast for this day.</p>;
  const from = toMs(first.startTime);
  const to = from + hourly.length * HOUR_MS;
  const hasActual = hourly.some((r) => r.actual !== null);
  const yScale = niceScale([
    ...hourly.flatMap((r) => [r.p90 ?? 0, r.forecast ?? 0, r.actual ?? 0]),
    ...actualHalfHourly.map((r) => r.generation),
  ]);

  return (
    <>
      <Legend
        items={[
          { label: 'Forecast used at decision', color: theme.forecast, kind: 'line' },
          { label: '80% likely range (P10–P90)', color: theme.forecast, kind: 'band' },
          ...(hasActual
            ? [
                { label: 'Actual, hourly', color: theme.actual, kind: 'line' as const },
                { label: 'Actual, half-hourly', color: theme.actual, kind: 'thin' as const },
              ]
            : []),
        ]}
      />
      <div className="chart" style={{ height: 320 }}>
        <ResponsiveContainer>
          <ComposedChart data={points} margin={CHART_MARGIN} accessibilityLayer>
            <CartesianGrid vertical={false} stroke={theme.grid} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[from, to]}
              ticks={timeTicks(from, to, 3 * HOUR_MS)}
              tickFormatter={formatTime}
              {...axisStyle(theme)}
            />
            <YAxis tickFormatter={gwTick} {...yScale} {...yAxisStyle(theme)} />
            <Tooltip
              cursor={{ stroke: theme.axis, strokeWidth: 1 }}
              isAnimationActive={false}
              content={({ label }) => (
                <DecisionTooltip t={labelToNumber(label)} hourly={hourlyByTime} halfHourly={halfByTime} theme={theme} />
              )}
            />
            <Area
              dataKey="band"
              type="stepAfter"
              stroke="none"
              fill={theme.forecast}
              fillOpacity={0.14}
              connectNulls
              isAnimationActive={false}
              activeDot={false}
            />
            <Line
              dataKey="halfHourly"
              type="stepAfter"
              stroke={theme.actual}
              strokeOpacity={0.45}
              strokeWidth={1}
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              dataKey="actual"
              type="stepAfter"
              stroke={theme.actual}
              strokeWidth={2}
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              dataKey="forecast"
              type="stepAfter"
              stroke={theme.forecast}
              strokeWidth={2}
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
