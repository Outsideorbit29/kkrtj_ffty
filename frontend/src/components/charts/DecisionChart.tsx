import { useMemo } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { HalfHourlyActual, HourlyRow } from '../../api/types';
import { useChartTheme } from '../../hooks/useChartTheme';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { buildDecisionPoints } from '../../lib/chartData';
import { formatPower, formatTime, gwTick, toMs } from '../../lib/format';
import type { ChartTheme } from '../../lib/theme';
import { Legend } from '../Legend';
import { TooltipFrame, type TooltipRow } from '../TooltipFrame';
import {
  CHART_MARGIN,
  HALF_HOUR_MS,
  HOUR_MS,
  NARROW_QUERY,
  ROUND_LINE,
  axisStyle,
  labelToNumber,
  lineCursor,
  niceScale,
  timeTicks,
  yAxisStyle,
} from './common';

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
    ...(row.p50 != null ? [{ name: 'Expected (P50)', value: formatPower(row.p50), color: theme.forecast }] : []),
    { name: 'Published forecast', value: formatPower(row.forecast), color: theme.forecast, dashed: row.p50 != null },
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
  const narrow = useMediaQuery(NARROW_QUERY);
  const points = useMemo(() => buildDecisionPoints(hourly, actualHalfHourly), [hourly, actualHalfHourly]);
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
  const hasP50 = hourly.some((r) => r.p50 != null);
  const yScale = niceScale([
    ...hourly.flatMap((r) => [r.p90 ?? 0, r.p50 ?? 0, r.forecast ?? 0, r.actual ?? 0]),
    ...actualHalfHourly.map((r) => r.generation),
  ]);

  return (
    <>
      <Legend
        items={[
          ...(hasP50 ? [{ label: 'Expected (bias-corrected P50)', color: theme.forecast, kind: 'line' as const }] : []),
          { label: 'Elexon forecast as published', color: theme.forecast, kind: hasP50 ? 'dashed' : 'line' },
          { label: '80% likely range (P10–P90)', color: theme.forecast, kind: 'band' },
          ...(hasActual
            ? [
                { label: 'Actual, hourly', color: theme.actual, kind: 'line' as const },
                { label: 'Actual, half-hourly', color: theme.actual, kind: 'thin' as const },
              ]
            : []),
        ]}
      />
      <div className="chart chart--hero">
        <ResponsiveContainer>
          <ComposedChart data={points} margin={CHART_MARGIN} accessibilityLayer>
            <CartesianGrid vertical={false} stroke={theme.grid} strokeWidth={1} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[from, to]}
              ticks={timeTicks(from, to, (narrow ? 6 : 3) * HOUR_MS)}
              tickFormatter={formatTime}
              {...axisStyle(theme)}
            />
            <YAxis tickFormatter={gwTick} {...yScale} {...yAxisStyle(theme, narrow)} />
            <Tooltip
              cursor={lineCursor(theme)}
              isAnimationActive={false}
              content={({ label }) => (
                <DecisionTooltip t={labelToNumber(label)} hourly={hourlyByTime} halfHourly={halfByTime} theme={theme} />
              )}
            />
            <Area
              dataKey="band"
              type="stepAfter"
              stroke="none"
              fill={theme.band}
              fillOpacity={1}
              connectNulls
              isAnimationActive={false}
              activeDot={false}
            />
            <Line
              dataKey="halfHourly"
              type="stepAfter"
              stroke={theme.actual}
              strokeOpacity={0.4}
              strokeWidth={1}
              {...ROUND_LINE}
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              dataKey="forecast"
              type="stepAfter"
              stroke={theme.forecast}
              strokeWidth={hasP50 ? 1.25 : 2}
              strokeDasharray={hasP50 ? '4 3' : undefined}
              strokeOpacity={hasP50 ? 0.85 : 1}
              {...ROUND_LINE}
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              dataKey="actual"
              type="stepAfter"
              stroke={theme.actual}
              strokeWidth={1.75}
              {...ROUND_LINE}
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />
            {hasP50 && (
              <Line
                dataKey="p50"
                type="stepAfter"
                stroke={theme.forecast}
                strokeWidth={2}
                {...ROUND_LINE}
                dot={false}
                activeDot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
