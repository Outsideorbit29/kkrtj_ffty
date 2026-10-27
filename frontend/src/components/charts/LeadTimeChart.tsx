import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { LeadTimePoint } from '../../api/types';
import { useChartTheme } from '../../hooks/useChartTheme';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { errorSpread } from '../../lib/chartData';
import { formatPower, gwTick } from '../../lib/format';
import { Legend } from '../Legend';
import { TooltipFrame } from '../TooltipFrame';
import {
  CHART_MARGIN,
  NARROW_QUERY,
  ROUND_LINE,
  axisStyle,
  dotStyle,
  labelToNumber,
  lineCursor,
  niceScale,
  yAxisStyle,
} from './common';

type Point = LeadTimePoint & { mid: number };

interface LeadTimeChartProps {
  points: LeadTimePoint[];
  /** Lead times (hours) the decision-time forecast actually covers, for the shaded marker. */
  decisionHorizon?: { from: number; to: number };
}

export function LeadTimeChart({ points, decisionHorizon }: LeadTimeChartProps) {
  const theme = useChartTheme();
  const narrow = useMediaQuery(NARROW_QUERY);
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
            ? [{ label: 'Lead times covered by your day-ahead decision', color: theme.forecast, kind: 'band' as const }]
            : []),
        ]}
      />
      <div className="chart chart--sm">
        <ResponsiveContainer>
          <LineChart data={data} margin={CHART_MARGIN} accessibilityLayer>
            <CartesianGrid vertical={false} stroke={theme.grid} strokeWidth={1} />
            {decisionHorizon && (
              <ReferenceArea
                x1={decisionHorizon.from}
                x2={decisionHorizon.to}
                fill={theme.band}
                fillOpacity={1}
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
            <YAxis tickFormatter={gwTick} {...yScale} {...yAxisStyle(theme, narrow)} />
            <ReferenceLine y={0} stroke={theme.axis} strokeWidth={1} />
            <Tooltip
              cursor={lineCursor(theme)}
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
              dot={false}
              activeDot={dotStyle(theme, theme.error)}
              isAnimationActive={false}
              {...ROUND_LINE}
            />
            <Line
              dataKey="bias"
              stroke={theme.over}
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
              activeDot={dotStyle(theme, theme.over)}
              isAnimationActive={false}
              {...ROUND_LINE}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
