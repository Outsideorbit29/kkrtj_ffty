import { useMemo } from 'react';
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { SeriesPoint } from '../../api/types';
import { useChartTheme } from '../../hooks/useChartTheme';
import { formatDayTime, formatPower, gwTick } from '../../lib/format';
import { Legend } from '../Legend';
import { TooltipFrame } from '../TooltipFrame';
import { CHART_MARGIN, axisStyle, niceScale, yAxisStyle } from './common';

interface Dot {
  forecast: number;
  actual: number;
  error: number;
  startTime: string;
}

/** Forecast against outturn per hour; dots below the diagonal are over-forecast hours. */
export function ScatterFit({ series }: { series: SeriesPoint[] }) {
  const theme = useChartTheme();
  const dots = useMemo<Dot[]>(
    () =>
      series
        .filter((p): p is SeriesPoint & { actual: number; error: number } => p.actual !== null && p.error !== null)
        .map((p) => ({ forecast: p.forecast, actual: p.actual, error: p.error, startTime: p.startTime })),
    [series],
  );
  if (dots.length === 0) return <p className="empty">No comparable hours in this range.</p>;
  const scale = niceScale(dots.flatMap((d) => [d.forecast, d.actual]));
  const [lo, hi] = scale.domain;
  const over = dots.filter((d) => d.error > 0);
  const under = dots.filter((d) => d.error <= 0);

  return (
    <>
      <Legend
        items={[
          { label: `Over-forecast hours (${over.length})`, color: theme.over, kind: 'bar' },
          { label: `Under-forecast hours (${under.length})`, color: theme.under, kind: 'bar' },
          { label: 'Perfect forecast', color: theme.axis, kind: 'dashed' },
        ]}
      />
      <div className="chart chart--md">
        <ResponsiveContainer>
          <ScatterChart margin={{ ...CHART_MARGIN, bottom: 18, left: 4 }} accessibilityLayer>
            <CartesianGrid stroke={theme.grid} strokeWidth={1} />
            <XAxis
              type="number"
              dataKey="forecast"
              name="Forecast"
              tickFormatter={gwTick}
              {...scale}
              {...axisStyle(theme)}
              label={{ value: 'Forecast at decision, GW', position: 'insideBottom', offset: -14, fill: theme.text, fontSize: 11 }}
            />
            <YAxis type="number" dataKey="actual" name="Actual" tickFormatter={gwTick} {...scale} {...yAxisStyle(theme)} />
            <ReferenceLine
              segment={[
                { x: lo, y: lo },
                { x: hi, y: hi },
              ]}
              stroke={theme.axis}
              strokeDasharray="4 3"
              ifOverflow="hidden"
            />
            <Tooltip
              cursor={false}
              isAnimationActive={false}
              content={({ payload }) => {
                const d = payload?.[0]?.payload as Dot | undefined;
                if (!d) return null;
                return (
                  <TooltipFrame
                    title={formatDayTime(d.startTime)}
                    rows={[
                      { name: 'Forecast', value: formatPower(d.forecast), color: theme.forecast },
                      { name: 'Actual', value: formatPower(d.actual), color: theme.actual },
                      { name: 'Error', value: formatPower(d.error, { signed: true }) },
                    ]}
                  />
                );
              }}
            />
            <Scatter data={under} fill={theme.under} fillOpacity={0.55} shape="circle" isAnimationActive={false} legendType="none" />
            <Scatter data={over} fill={theme.over} fillOpacity={0.55} shape="circle" isAnimationActive={false} legendType="none" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
