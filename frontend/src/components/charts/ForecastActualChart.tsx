import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SeriesPoint } from '../../api/types';
import { useChartTheme } from '../../hooks/useChartTheme';
import { formatDay, formatDayTime, formatPower, gwTick, toMs } from '../../lib/format';
import { Legend } from '../Legend';
import { TooltipFrame } from '../TooltipFrame';
import { CHART_MARGIN, HOUR_MS, axisStyle, labelToNumber, timeTicks, yAxisStyle, niceScale } from './common';

type Point = SeriesPoint & { t: number };

export function ForecastActualChart({ series }: { series: SeriesPoint[] }) {
  const theme = useChartTheme();
  const points = useMemo<Point[]>(() => series.map((p) => ({ ...p, t: toMs(p.startTime) })), [series]);
  const byTime = useMemo(() => new Map(points.map((p) => [p.t, p])), [points]);

  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return <p className="empty">No comparable hours in this range.</p>;
  const days = (last.t - first.t) / (24 * HOUR_MS);
  const tickStep = (days > 14 ? 7 : days > 4 ? 2 : 1) * 24 * HOUR_MS;
  const dayStart = Math.floor(first.t / (24 * HOUR_MS)) * 24 * HOUR_MS;
  const yScale = niceScale(points.flatMap((p) => [p.forecast, p.actual ?? 0]));

  return (
    <>
      <Legend
        items={[
          { label: 'Forecast used at decision', color: theme.forecast, kind: 'line' },
          { label: 'Actual', color: theme.actual, kind: 'line' },
        ]}
      />
      <div className="chart" style={{ height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={points} margin={CHART_MARGIN} accessibilityLayer>
            <CartesianGrid vertical={false} stroke={theme.grid} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[first.t, last.t]}
              ticks={timeTicks(dayStart, last.t, tickStep).filter((t) => t >= first.t)}
              tickFormatter={(t: number) => formatDay(t).replace(/^\w+ /, '')}
              {...axisStyle(theme)}
            />
            <YAxis tickFormatter={gwTick} {...yScale} {...yAxisStyle(theme)} />
            <Tooltip
              cursor={{ stroke: theme.axis, strokeWidth: 1 }}
              isAnimationActive={false}
              content={({ label }) => {
                const t = labelToNumber(label);
                const p = t === undefined ? undefined : byTime.get(t);
                if (!p) return null;
                return (
                  <TooltipFrame
                    title={formatDayTime(p.t)}
                    rows={[
                      { name: 'Forecast', value: formatPower(p.forecast), color: theme.forecast },
                      { name: 'Actual', value: formatPower(p.actual), color: theme.actual },
                      { name: 'Error (fcst − actual)', value: formatPower(p.error, { signed: true }) },
                    ]}
                    note={`Forecast issued ${p.horizonHours.toFixed(1)} h ahead`}
                  />
                );
              }}
            />
            <Line dataKey="actual" stroke={theme.actual} strokeWidth={1.5} dot={false} activeDot={false} isAnimationActive={false} />
            <Line dataKey="forecast" stroke={theme.forecast} strokeWidth={1.5} dot={false} activeDot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
