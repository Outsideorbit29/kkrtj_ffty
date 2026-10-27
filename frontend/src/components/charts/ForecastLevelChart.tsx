import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ForecastLevelBucket } from '../../api/types';
import { useChartTheme } from '../../hooks/useChartTheme';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { formatPct, formatPower, gwTick } from '../../lib/format';
import { Legend } from '../Legend';
import { TooltipFrame } from '../TooltipFrame';
import { CHART_MARGIN, NARROW_QUERY, axisStyle, barCursor, niceScale, signColor, yAxisStyle } from './common';
import { RoundedBar } from './RoundedBar';

/** Bias of the decision-time forecast per 4 GW forecast-level bucket, coloured by sign. */
export function ForecastLevelChart({ buckets }: { buckets: ForecastLevelBucket[] }) {
  const theme = useChartTheme();
  const narrow = useMediaQuery(NARROW_QUERY);
  if (buckets.length === 0) return <p className="empty">No data in this range.</p>;

  return (
    <>
      <Legend
        items={[
          { label: 'Over-forecast (shortfall risk)', color: theme.over, kind: 'bar' },
          { label: 'Under-forecast (surplus)', color: theme.under, kind: 'bar' },
        ]}
      />
      <div className="chart chart--sm">
        <ResponsiveContainer>
          <BarChart data={buckets} margin={CHART_MARGIN} barCategoryGap="20%" accessibilityLayer>
            <CartesianGrid vertical={false} stroke={theme.grid} strokeWidth={1} />
            <XAxis
              dataKey="bucket"
              interval={0}
              // On phones the unit (already in the subtitle) is dropped so six bucket labels fit.
              tickFormatter={narrow ? (bucket: string) => bucket.replace(/ GW$/, '') : undefined}
              {...axisStyle(theme)}
            />
            <YAxis tickFormatter={gwTick} {...niceScale(buckets.map((b) => b.bias), 5)} {...yAxisStyle(theme, narrow)} />
            <ReferenceLine y={0} stroke={theme.axis} strokeWidth={1} />
            <Tooltip
              cursor={barCursor(theme)}
              isAnimationActive={false}
              content={({ payload }) => {
                const row = payload?.[0]?.payload as ForecastLevelBucket | undefined;
                if (!row) return null;
                return (
                  <TooltipFrame
                    title={`Forecast ${row.bucket}`}
                    rows={[
                      { name: 'Bias', value: formatPower(row.bias, { signed: true }), color: signColor(theme, row.bias) },
                      { name: 'MAE', value: formatPower(row.mae) },
                      { name: 'Hours over-forecast', value: formatPct(row.overForecastShare * 100, { digits: 0 }) },
                    ]}
                    note={`${row.n.toLocaleString('en-GB')} hours`}
                  />
                );
              }}
            />
            <Bar dataKey="bias" maxBarSize={40} shape={<RoundedBar />} isAnimationActive={false}>
              {buckets.map((b) => (
                <Cell key={b.from} fill={signColor(theme, b.bias)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
