import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ForecastRun, HourlyRow } from '../../api/types';
import { useChartTheme } from '../../hooks/useChartTheme';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { buildRunsPoints, runKey, type RunsPoint as Point } from '../../lib/chartData';
import { formatDayTime, formatPower, formatTime, gwTick, toMs } from '../../lib/format';
import type { ChartTheme } from '../../lib/theme';
import { Legend } from '../Legend';
import { TooltipFrame, type TooltipRow } from '../TooltipFrame';
import {
  CHART_MARGIN,
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

function lineStyle(run: ForecastRun, theme: ChartTheme) {
  if (run.isDecisionRun) return { stroke: theme.forecast, strokeWidth: 2 };
  if (run.availableAtDecision) return { stroke: theme.muted, strokeWidth: 1 };
  return { stroke: theme.muted, strokeWidth: 1.25, strokeDasharray: '3 3' };
}

function RunsTooltip({ point, runs, theme }: { point: Point | undefined; runs: ForecastRun[]; theme: ChartTheme }) {
  if (!point) return null;
  const values = runs
    .map((run, i) => ({ run, value: point[runKey(i)] }))
    .filter((v): v is { run: ForecastRun; value: number } => typeof v.value === 'number');
  const decision = values.find((v) => v.run.isDecisionRun);
  const latest = values.at(-1);
  const rows: TooltipRow[] = [];
  if (decision) {
    rows.push({ name: `Decision run (${formatTime(decision.run.publishTimeUtc)})`, value: formatPower(decision.value), color: theme.forecast });
  }
  if (latest && latest !== decision) {
    rows.push({
      name: `Latest run (${formatTime(latest.run.publishTimeUtc)})`,
      value: formatPower(latest.value),
      color: theme.muted,
      dashed: !latest.run.availableAtDecision,
    });
  }
  rows.push({ name: 'Actual', value: formatPower(point.actual), color: theme.actual });
  const all = values.map((v) => v.value);
  const note =
    all.length > 1 ? `Spread across ${all.length} runs: ${formatPower(Math.min(...all))} – ${formatPower(Math.max(...all))}` : undefined;
  return <TooltipFrame title={`${formatTime(point.t)}–${formatTime(point.t + HOUR_MS)}`} rows={rows} note={note} />;
}

interface RunsChartProps {
  runs: ForecastRun[];
  hourly: HourlyRow[];
}

export function RunsChart({ runs, hourly }: RunsChartProps) {
  const theme = useChartTheme();
  const narrow = useMediaQuery(NARROW_QUERY);
  // `points` adds a closing point at midnight; `pointByTime` holds only real hour starts.
  const { points, byHour: pointByTime } = useMemo(() => buildRunsPoints(runs, hourly), [runs, hourly]);
  // Draw the decision run last so it sits on top.
  const drawOrder = useMemo(
    () => runs.map((run, i) => ({ run, i })).sort((a, b) => Number(a.run.isDecisionRun) - Number(b.run.isDecisionRun)),
    [runs],
  );

  const first = hourly[0];
  if (!first || runs.length === 0) return <p className="empty">No forecast runs cover this day.</p>;
  const from = toMs(first.startTime);
  const to = from + hourly.length * HOUR_MS;
  const decisionRun = runs.find((r) => r.isDecisionRun);
  const hasLater = runs.some((r) => !r.availableAtDecision);
  const hasEarlier = runs.some((r) => r.availableAtDecision && !r.isDecisionRun);
  const yScale = niceScale([
    ...hourly.map((r) => r.actual ?? 0),
    ...runs.flatMap((r) => r.points.filter((p) => pointByTime.has(toMs(p.startTime))).map((p) => p.forecast)),
  ]);

  return (
    <>
      <Legend
        items={[
          {
            label: decisionRun ? `Decision run, ${formatDayTime(decisionRun.publishTimeUtc)}` : 'Decision run',
            color: theme.forecast,
            kind: 'line',
          },
          ...(hasEarlier ? [{ label: 'Earlier runs', color: theme.muted, kind: 'thin' as const }] : []),
          ...(hasLater ? [{ label: 'Runs published after the decision', color: theme.muted, kind: 'dashed' as const }] : []),
          { label: 'Actual', color: theme.actual, kind: 'line' },
        ]}
      />
      <div className="chart chart--md">
        <ResponsiveContainer>
          <LineChart data={points} margin={CHART_MARGIN} accessibilityLayer>
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
              content={({ label }) => {
                const t = labelToNumber(label);
                // Values are hourly averages over [H, H+1): snap to the hour start; the midnight closing point has no tooltip.
                const hourStart = t === undefined ? undefined : Math.floor(t / HOUR_MS) * HOUR_MS;
                const point = hourStart === undefined || hourStart >= to ? undefined : pointByTime.get(hourStart);
                return <RunsTooltip point={point} runs={runs} theme={theme} />;
              }}
            />
            {drawOrder.map(({ run, i }) => (
              <Line
                key={run.publishTimeUtc}
                dataKey={runKey(i)}
                name={formatDayTime(run.publishTimeUtc)}
                type="stepAfter"
                connectNulls
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                {...ROUND_LINE}
                {...lineStyle(run, theme)}
              />
            ))}
            <Line
              dataKey="actual"
              type="stepAfter"
              connectNulls
              stroke={theme.actual}
              strokeWidth={1.75}
              {...ROUND_LINE}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
