import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { HourOfDayStat } from '../../api/types';
import { useChartTheme } from '../../hooks/useChartTheme';
import { formatPower, gwTick, hourLabel } from '../../lib/format';
import { TooltipFrame } from '../TooltipFrame';
import { CHART_MARGIN, axisStyle, yAxisStyle, niceScale } from './common';
import { RoundedBar } from './RoundedBar';

export function HourOfDayChart({ hours }: { hours: HourOfDayStat[] }) {
  const theme = useChartTheme();
  if (hours.length === 0) return <p className="empty">No data in this range.</p>;

  return (
    <div className="chart" style={{ height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={hours} margin={CHART_MARGIN} barCategoryGap={2} accessibilityLayer>
          <CartesianGrid vertical={false} stroke={theme.grid} />
          <XAxis dataKey="hour" tickFormatter={hourLabel} interval="preserveStart" minTickGap={12} {...axisStyle(theme)} />
          <YAxis tickFormatter={gwTick} {...niceScale(hours.map((h) => h.mae))} {...yAxisStyle(theme)} />
          <Tooltip
            cursor={{ fill: theme.grid, fillOpacity: 0.5 }}
            isAnimationActive={false}
            content={({ payload }) => {
              const row = payload?.[0]?.payload as HourOfDayStat | undefined;
              if (!row) return null;
              return (
                <TooltipFrame
                  title={`${hourLabel(row.hour)}–${hourLabel((row.hour + 1) % 24)}`}
                  rows={[
                    { name: 'MAE', value: formatPower(row.mae), color: theme.error },
                    { name: 'Bias', value: formatPower(row.bias, { signed: true }) },
                  ]}
                  note={`${row.n} hours`}
                />
              );
            }}
          />
          <Bar dataKey="mae" fill={theme.error} maxBarSize={24} shape={<RoundedBar />} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
