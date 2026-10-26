import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { HistogramBin } from '../../api/types';
import { useChartTheme } from '../../hooks/useChartTheme';
import { formatBin, formatPct, gwTick } from '../../lib/format';
import type { ChartTheme } from '../../lib/theme';
import { Legend } from '../Legend';
import { TooltipFrame } from '../TooltipFrame';
import { CHART_MARGIN, axisStyle, yAxisStyle, niceScale } from './common';
import { RoundedBar } from './RoundedBar';

type Bin = HistogramBin & { share: number };

/** Bins straddling zero are neutral: they hold both small over- and under-forecasts. */
function binColor(theme: ChartTheme, bin: HistogramBin): string {
  if (bin.from >= 0) return theme.over;
  if (bin.to <= 0) return theme.under;
  return theme.muted;
}

export function ErrorHistogram({ bins }: { bins: HistogramBin[] }) {
  const theme = useChartTheme();
  const data = useMemo<Bin[]>(() => {
    const total = bins.reduce((sum, b) => sum + b.count, 0) || 1;
    return bins.map((b) => ({ ...b, share: (b.count / total) * 100 }));
  }, [bins]);
  if (data.length === 0) return <p className="empty">No data in this range.</p>;
  const hasMixedBin = data.some((b) => b.from < 0 && b.to > 0);

  return (
    <>
      <Legend
        items={[
          { label: 'Over-forecast (shortfall risk)', color: theme.over, kind: 'bar' },
          { label: 'Under-forecast (surplus)', color: theme.under, kind: 'bar' },
          ...(hasMixedBin ? [{ label: 'Straddles zero', color: theme.muted, kind: 'bar' as const }] : []),
        ]}
      />
      <div className="chart" style={{ height: 240 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={CHART_MARGIN} barCategoryGap={2} accessibilityLayer>
            <CartesianGrid vertical={false} stroke={theme.grid} />
            <XAxis dataKey="from" tickFormatter={gwTick} interval="preserveStart" minTickGap={8} {...axisStyle(theme)} />
            <YAxis {...niceScale(data.map((b) => b.count))} {...yAxisStyle(theme)} />
            <Tooltip
              cursor={{ fill: theme.grid, fillOpacity: 0.5 }}
              isAnimationActive={false}
              content={({ payload }) => {
                const bin = payload?.[0]?.payload as Bin | undefined;
                if (!bin) return null;
                return (
                  <TooltipFrame
                    title={formatBin(bin)}
                    rows={[
                      { name: 'Hours', value: bin.count.toLocaleString('en-GB'), color: binColor(theme, bin) },
                      { name: 'Share of hours', value: formatPct(bin.share) },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="count" maxBarSize={24} shape={<RoundedBar />} isAnimationActive={false}>
              {data.map((bin) => (
                <Cell key={bin.from} fill={binColor(theme, bin)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="axis-note">Error in GW (forecast − actual), labelled at each bin’s lower edge</p>
    </>
  );
}
