import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { HourlyRow } from '../../api/types';
import { useChartTheme } from '../../hooks/useChartTheme';
import { formatPower, formatTime, gwTick } from '../../lib/format';
import { Legend } from '../Legend';
import { TooltipFrame } from '../TooltipFrame';
import { CHART_MARGIN, axisStyle, barCursor, niceScale, signColor, yAxisStyle } from './common';
import { RoundedBar } from './RoundedBar';

type Row = HourlyRow & { label: string; err: number };

/** Signed error of the decision-time forecast for each hour of one delivery day. */
export function HourlyErrorChart({ hourly }: { hourly: HourlyRow[] }) {
  const theme = useChartTheme();
  const rows: Row[] = hourly
    .filter((r): r is HourlyRow & { error: number } => r.error !== null)
    .map((r) => ({ ...r, label: formatTime(r.startTime), err: r.error }));
  if (rows.length === 0) return <p className="empty">Actuals for this day are not available yet.</p>;

  return (
    <>
      <Legend
        items={[
          { label: 'Over-forecast', color: theme.over, kind: 'bar' },
          { label: 'Under-forecast', color: theme.under, kind: 'bar' },
        ]}
      />
      <div className="chart chart--md">
        <ResponsiveContainer>
          <BarChart data={rows} margin={CHART_MARGIN} barCategoryGap={2} accessibilityLayer>
            <CartesianGrid vertical={false} stroke={theme.grid} strokeWidth={1} />
            <XAxis dataKey="label" interval={5} {...axisStyle(theme)} />
            <YAxis tickFormatter={gwTick} {...niceScale(rows.map((r) => r.err), 5)} {...yAxisStyle(theme)} />
            <ReferenceLine y={0} stroke={theme.axis} strokeWidth={1} />
            <Tooltip
              cursor={barCursor(theme)}
              isAnimationActive={false}
              content={({ payload }) => {
                const r = payload?.[0]?.payload as Row | undefined;
                if (!r) return null;
                return (
                  <TooltipFrame
                    title={`Hour from ${r.label}`}
                    rows={[
                      { name: 'Forecast', value: formatPower(r.forecast), color: theme.forecast },
                      { name: 'Actual', value: formatPower(r.actual), color: theme.actual },
                      { name: 'Error', value: formatPower(r.err, { signed: true }), color: signColor(theme, r.err) },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="err" maxBarSize={14} shape={<RoundedBar />} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.startTime} fill={signColor(theme, r.err)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="axis-note">Forecast − actual, GW, UK hours</p>
    </>
  );
}
