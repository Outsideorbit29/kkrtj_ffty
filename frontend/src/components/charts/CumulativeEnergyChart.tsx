import { useMemo } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DayStat } from '../../api/types';
import { useChartTheme } from '../../hooks/useChartTheme';
import { cumulativeEnergy, type CumulativePoint } from '../../lib/dashboard';
import { formatCalendarDate, formatCalendarTick } from '../../lib/dates';
import { Legend } from '../Legend';
import { TooltipFrame } from '../TooltipFrame';
import { CHART_MARGIN, ROUND_LINE, axisStyle, lineCursor, niceScale, yAxisStyle } from './common';

const gwh = (v: number) => `${v.toLocaleString('en-GB', { maximumFractionDigits: 0 })} GWh`;
const twhTick = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString('en-GB', { maximumFractionDigits: 1 })}k` : String(v));

/** Running energy totals over the range: the widening gap is the volume bought against wind that never came. */
export function CumulativeEnergyChart({ days }: { days: DayStat[] }) {
  const theme = useChartTheme();
  const points = useMemo(() => cumulativeEnergy(days), [days]);
  if (points.length === 0) return <p className="empty">No data in this range.</p>;
  const scale = niceScale(points.map((p) => p.forecastGWh));

  return (
    <>
      <Legend
        items={[
          { label: 'Forecast energy (cumulative)', color: theme.forecast, kind: 'line' },
          { label: 'Actual energy (cumulative)', color: theme.actual, kind: 'line' },
          { label: 'Gap', color: theme.over, kind: 'band' },
        ]}
      />
      <div className="chart chart--md">
        <ResponsiveContainer>
          <ComposedChart data={points} margin={CHART_MARGIN} accessibilityLayer>
            <CartesianGrid vertical={false} stroke={theme.grid} strokeWidth={1} />
            <XAxis dataKey="date" tickFormatter={formatCalendarTick} interval="preserveStart" minTickGap={18} {...axisStyle(theme)} />
            <YAxis tickFormatter={twhTick} {...scale} {...yAxisStyle(theme)} />
            <Tooltip
              cursor={lineCursor(theme)}
              isAnimationActive={false}
              content={({ payload }) => {
                const p = payload?.[0]?.payload as CumulativePoint | undefined;
                if (!p) return null;
                return (
                  <TooltipFrame
                    title={`To ${formatCalendarDate(p.date)}`}
                    rows={[
                      { name: 'Forecast', value: gwh(p.forecastGWh), color: theme.forecast },
                      { name: 'Actual', value: gwh(p.actualGWh), color: theme.actual },
                      { name: 'Gap (fcst − actual)', value: `${p.gapGWh >= 0 ? '+' : '−'}${gwh(Math.abs(p.gapGWh))}` },
                    ]}
                  />
                );
              }}
            />
            <Area
              dataKey={(p: CumulativePoint) => [p.actualGWh, p.forecastGWh]}
              stroke="none"
              fill={theme.over}
              fillOpacity={0.12}
              isAnimationActive={false}
              activeDot={false}
            />
            <Line dataKey="actualGWh" stroke={theme.actual} strokeWidth={2} dot={false} isAnimationActive={false} {...ROUND_LINE} />
            <Line dataKey="forecastGWh" stroke={theme.forecast} strokeWidth={2} dot={false} isAnimationActive={false} {...ROUND_LINE} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="axis-note">Energy in GWh, summed over delivery days</p>
    </>
  );
}
