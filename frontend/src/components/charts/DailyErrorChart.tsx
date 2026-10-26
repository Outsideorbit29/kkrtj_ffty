import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DayStat } from '../../api/types';
import { useChartTheme } from '../../hooks/useChartTheme';
import { formatCalendarDate, formatCalendarTick } from '../../lib/dates';
import { formatEnergy, formatPower, gwTick } from '../../lib/format';
import type { ChartTheme } from '../../lib/theme';
import { Legend } from '../Legend';
import { TooltipFrame } from '../TooltipFrame';
import { axisStyle, niceScale, signColor, yAxisStyle } from './common';
import { RoundedBar } from './RoundedBar';

const SYNC_ID = 'daily-error';

function DayTooltip({ row, theme }: { row: DayStat | undefined; theme: ChartTheme }) {
  if (!row) return null;
  return (
    <TooltipFrame
      title={`Delivery ${formatCalendarDate(row.date)}`}
      rows={[
        { name: 'MAE', value: formatPower(row.mae), color: theme.forecast },
        { name: 'Bias', value: formatPower(row.bias, { signed: true }), color: signColor(theme, row.bias) },
        { name: 'Forecast energy', value: formatEnergy(row.forecastMWh) },
        { name: 'Actual energy', value: formatEnergy(row.actualMWh) },
      ]}
    />
  );
}

/** Two aligned panels on a shared day axis: error size (MAE) and error direction (bias). */
export function DailyErrorChart({ days }: { days: DayStat[] }) {
  const theme = useChartTheme();
  if (days.length === 0) return <p className="empty">No data in this range.</p>;
  const tooltip = (
    <Tooltip
      cursor={{ fill: theme.grid, fillOpacity: 0.5 }}
      isAnimationActive={false}
      content={({ payload }) => <DayTooltip row={payload?.[0]?.payload as DayStat | undefined} theme={theme} />}
    />
  );

  return (
    <>
      <p className="panel-label">Daily MAE: how big the misses were</p>
      <div className="chart" style={{ height: 150 }}>
        <ResponsiveContainer>
          <BarChart data={days} syncId={SYNC_ID} margin={{ top: 4, right: 12, bottom: 0, left: 0 }} barCategoryGap={2} accessibilityLayer>
            <CartesianGrid vertical={false} stroke={theme.grid} />
            <XAxis dataKey="date" hide />
            <YAxis tickFormatter={gwTick} {...niceScale(days.map((d) => d.mae), 4)} {...yAxisStyle(theme)} />
            {tooltip}
            <Bar dataKey="mae" fill={theme.forecast} maxBarSize={24} shape={<RoundedBar />} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="panel-label">Daily bias: which way they went</p>
      <Legend
        items={[
          { label: 'Over-forecast (shortfall risk)', color: theme.over, kind: 'bar' },
          { label: 'Under-forecast (surplus)', color: theme.under, kind: 'bar' },
        ]}
      />
      <div className="chart" style={{ height: 170 }}>
        <ResponsiveContainer>
          <BarChart data={days} syncId={SYNC_ID} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barCategoryGap={2} accessibilityLayer>
            <CartesianGrid vertical={false} stroke={theme.grid} />
            <XAxis dataKey="date" tickFormatter={formatCalendarTick} interval="preserveStart" minTickGap={12} {...axisStyle(theme)} />
            <YAxis tickFormatter={gwTick} {...niceScale(days.map((d) => d.bias), 5)} {...yAxisStyle(theme)} />
            <ReferenceLine y={0} stroke={theme.axis} />
            {tooltip}
            <Bar dataKey="bias" maxBarSize={24} shape={<RoundedBar />} isAnimationActive={false}>
              {days.map((d) => (
                <Cell key={d.date} fill={signColor(theme, d.bias)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
