import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { LeadTimePoint } from '../../api/types';
import { useChartTheme } from '../../hooks/useChartTheme';
import { errorSpread } from '../../lib/chartData';
import { formatPower, gwTick } from '../../lib/format';
import { Legend } from '../Legend';
import { TooltipFrame } from '../TooltipFrame';
import { CHART_MARGIN, axisStyle, labelToNumber, yAxisStyle, niceScale } from './common';

type Point = LeadTimePoint & { mid: number };

interface LeadTimeChartProps {
  points: LeadTimePoint[];
  /** Lead times (hours) the decision-time forecast actually covers, for the shaded marker. */
  decisionHorizon?: { from: number; to: number };
}

export function LeadTimeChart({ points, decisionHorizon }: LeadTimeChartProps) {
  const theme = useChartTheme();
  const data = useMemo<Point[]>(
    () => points.filter((p) => p.n > 0).map((p) => ({ ...p, mid: (p.leadFrom + p.leadTo) / 2 })),
    [points],
  );
  const byMid = useMemo(() => new Map(data.map((p) => [p.mid, p])), [data]);
  if (data.length === 0) return <p className="empty">No lead-time data in this range.</p>;
  const maxLead = Math.max(...data.map((p) => p.leadTo));
  const yScale = niceScale(data.flatMap((p) => [p.mae, p.bias]));

  return (
    <>
      <Legend
        items={[
          { label: 'MAE', color: theme.error, kind: 'line' },
          { label: 'Bias (forecast − actual)', color: theme.over, kind: 'dashed' },
          ...(decisionHorizon
            ? [{ label: 'Lead times covered by your day-ahead decision', color: theme.error, kind: 'band' as const }]
            : []),
        ]}
      />
      <div className="chart" style={{ height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={CHART_MARGIN} accessibilityLayer>
            <CartesianGrid vertical={false} stroke={theme.grid} />
            {decisionHorizon && (
              <ReferenceArea
                x1={decisionHorizon.from}
                x2={decisionHorizon.to}
                fill={theme.error}
                fillOpacity={0.1}
                stroke="none"
                ifOverflow="extendDomain"
              />
            )}
            <XAxis
              dataKey="mid"
              type="number"
              domain={[0, maxLead]}
              ticks={Array.from({ length: Math.floor(maxLead / 12) + 1 }, (_, i) => i * 12)}
              tickFormatter={(h: number) => `${h}h`}
              {...axisStyle(theme)}
            />
            <YAxis tickFormatter={gwTick} {...yScale} {...yAxisStyle(theme)} />
            <ReferenceLine y={0} stroke={theme.axis} />
            <Tooltip
              cursor={{ stroke: theme.axis, strokeWidth: 1 }}
              isAnimationActive={false}
              content={({ label }) => {
                const mid = labelToNumber(label);
                const p = mid === undefined ? undefined : byMid.get(mid);
                if (!p) return null;
                return (
                  <TooltipFrame
                    title={`Lead time ${p.leadFrom}–${p.leadTo} h`}
                    rows={[
                      { name: 'MAE', value: formatPower(p.mae), color: theme.error },
                      { name: 'Bias', value: formatPower(p.bias, { signed: true }), color: theme.over, dashed: true },
                      { name: 'Spread excl. bias (std)', value: formatPower(errorSpread(p)) },
                      { name: 'RMSE', value: formatPower(p.rmse) },
                    ]}
                    note={`${p.n.toLocaleString('en-GB')} forecast hours`}
                  />
                );
              }}
            />
            <Line
              dataKey="mae"
              stroke={theme.error}
              strokeWidth={2}
              dot={{ r: 4, fill: theme.error, stroke: theme.surface, strokeWidth: 2 }}
              activeDot={{ r: 5, fill: theme.error, stroke: theme.surface, strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <Line
              dataKey="bias"
              stroke={theme.over}
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
              activeDot={{ r: 4, fill: theme.over, stroke: theme.surface, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
