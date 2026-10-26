import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ForecastRun, HourlyRow } from '../../api/types';
import { useChartTheme } from '../../hooks/useChartTheme';
import { formatDayTime, formatPower, formatTime, gwTick, toMs } from '../../lib/format';
import type { ChartTheme } from '../../lib/theme';
import { Legend } from '../Legend';
import { TooltipFrame, type TooltipRow } from '../TooltipFrame';
import { CHART_MARGIN, HOUR_MS, axisStyle, labelToNumber, timeTicks, yAxisStyle, niceScale } from './common';

type Point = { t: number; actual?: number | null } & Record<string, number | null | undefined>;

const runKey = (i: number) => `run${i}`;

function buildPoints(runs: ForecastRun[], hourly: HourlyRow[]): Point[] {
  const byTime = new Map<number, Point>();
  hourly.forEach((row) => byTime.set(toMs(row.startTime), { t: toMs(row.startTime), actual: row.actual }));
  // Runs can extend beyond D; keep only the delivery day's hours.
  runs.forEach((run, i) =>
    run.points.forEach((pt) => {
      const point = byTime.get(toMs(pt.startTime));
      if (point) point[runKey(i)] = pt.forecast;
    }),
  );
  return [...byTime.values()];
}

function lineStyle(run: ForecastRun, theme: ChartTheme) {
  if (run.isDecisionRun) return { stroke: theme.forecast, strokeWidth: 2.5 };
  if (run.availableAtDecision) return { stroke: theme.muted, strokeWidth: 1.25 };
  return { stroke: theme.muted, strokeWidth: 1.25, strokeDasharray: '4 3', strokeOpacity: 0.7 };
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
  const points = useMemo(() => buildPoints(runs, hourly), [runs, hourly]);
  const pointByTime = useMemo(() => new Map(points.map((p) => [p.t, p])), [points]);
  // Draw the decision run last so it sits on top.
  const drawOrder = useMemo(
    () => runs.map((run, i) => ({ run, i })).sort((a, b) => Number(a.run.isDecisionRun) - Number(b.run.isDecisionRun)),
    [runs],
  );

  const first = hourly[0];
  if (!first || runs.length === 0) return <p className="empty">No forecast runs cover this day.</p>;
  const from = toMs(first.startTime);
  const to = from + (hourly.length - 1) * HOUR_MS;
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
      <div className="chart" style={{ height: 280 }}>
        <ResponsiveContainer>
          <LineChart data={points} margin={CHART_MARGIN} accessibilityLayer>
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
              content={({ label }) => {
                const t = labelToNumber(label);
                return <RunsTooltip point={t === undefined ? undefined : pointByTime.get(t)} runs={runs} theme={theme} />;
              }}
            />
            {drawOrder.map(({ run, i }) => (
              <Line
                key={run.publishTimeUtc}
                dataKey={runKey(i)}
                name={formatDayTime(run.publishTimeUtc)}
                type="linear"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                {...lineStyle(run, theme)}
              />
            ))}
            <Line
              dataKey="actual"
              type="linear"
              stroke={theme.actual}
              strokeWidth={2}
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
