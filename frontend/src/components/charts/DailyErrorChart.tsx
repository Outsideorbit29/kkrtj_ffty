import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DayStat } from '../../api/types';
import { useChartTheme } from '../../hooks/useChartTheme';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { formatCalendarDate, formatCalendarTick } from '../../lib/dates';
import { formatEnergy, formatPower, gwTick } from '../../lib/format';
import type { ChartTheme } from '../../lib/theme';
import { Legend } from '../Legend';
import { TooltipFrame } from '../TooltipFrame';
import { CHART_MARGIN, NARROW_QUERY, axisStyle, barCursor, niceScale, signColor, yAxisStyle } from './common';
import { RoundedBar } from './RoundedBar';

const SYNC_ID = 'daily-error';

function DayTooltip({ row, theme }: { row: DayStat | undefined; theme: ChartTheme }) {
  if (!row) return null;
  return (
    <TooltipFrame
      title={`Delivery ${formatCalendarDate(row.date)}`}
      rows={[
        { name: 'MAE', value: formatPower(row.mae), color: theme.error },
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
  const narrow = useMediaQuery(NARROW_QUERY);
  if (days.length === 0) return <p className="empty">No data in this range.</p>;
  const tooltip = (
    <Tooltip
      cursor={barCursor(theme)}
      isAnimationActive={false}
      content={({ payload }) => <DayTooltip row={payload?.[0]?.payload as DayStat | undefined} theme={theme} />}
    />
  );

  return (
    <>
      <p className="panel-label">Daily MAE: how big the misses were</p>
      <div className="chart chart--daily-mae">
        <ResponsiveContainer>
          <BarChart data={days} syncId={SYNC_ID} margin={{ ...CHART_MARGIN, top: 4, bottom: 6 }} barCategoryGap={2} accessibilityLayer>
            <CartesianGrid vertical={false} stroke={theme.grid} strokeWidth={1} />
            <XAxis dataKey="date" hide />
            <YAxis tickFormatter={gwTick} {...niceScale(days.map((d) => d.mae), 4)} {...yAxisStyle(theme, narrow)} interval={0} />
            <ReferenceLine y={0} stroke={theme.axis} strokeWidth={1} />
            {tooltip}
            <Bar dataKey="mae" fill={theme.error} maxBarSize={14} shape={<RoundedBar />} isAnimationActive={false} />
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
      <div className="chart chart--daily-bias">
        <ResponsiveContainer>
          <BarChart data={days} syncId={SYNC_ID} margin={CHART_MARGIN} barCategoryGap={2} accessibilityLayer>
            <CartesianGrid vertical={false} stroke={theme.grid} strokeWidth={1} />
            <XAxis dataKey="date" tickFormatter={formatCalendarTick} interval="preserveStart" minTickGap={12} {...axisStyle(theme)} />
            <YAxis tickFormatter={gwTick} {...niceScale(days.map((d) => d.bias), 5)} {...yAxisStyle(theme, narrow)} />
            <ReferenceLine y={0} stroke={theme.axis} strokeWidth={1} />
            {tooltip}
            <Bar dataKey="bias" maxBarSize={14} shape={<RoundedBar />} isAnimationActive={false}>
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
