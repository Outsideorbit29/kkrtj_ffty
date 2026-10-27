import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Accuracy } from '../../api/types';
import { useChartTheme } from '../../hooks/useChartTheme';
import { formatPct, formatPower } from '../../lib/format';
import { TooltipFrame } from '../TooltipFrame';
import { barCursor } from './common';

interface Row {
  name: string;
  mae: number;
  rmse: number;
  bias: number;
  color: string;
}

/** MAE of the forecast against the bias-corrected P50 and the two naive baselines; shorter is better. */
export function ModelComparisonChart({ a }: { a: Accuracy }) {
  const theme = useChartTheme();
  const rows: Row[] = [
    ...(a.forecastAdjusted.n > 0
      ? [{ name: 'Bias-corrected P50', ...a.forecastAdjusted, color: theme.adjusted }]
      : []),
    { name: 'Published forecast', ...a.forecast, color: theme.forecast },
    { name: 'Persistence', ...a.baselines.persistence, color: theme.baseline },
    { name: 'Same hour D-2', ...a.baselines.sameHourD2, color: theme.baseline },
  ];
  const best = Math.min(...rows.map((r) => r.mae));

  return (
    <div className="chart chart--models">
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 64, bottom: 0, left: 0 }} barCategoryGap="28%" accessibilityLayer>
          <XAxis type="number" hide domain={[0, 'dataMax']} />
          <YAxis type="category" dataKey="name" width={124} tickLine={false} axisLine={false} tick={{ fill: theme.text, fontSize: 12 }} />
          <Tooltip
            cursor={barCursor(theme)}
            isAnimationActive={false}
            content={({ payload }) => {
              const r = payload?.[0]?.payload as Row | undefined;
              if (!r) return null;
              return (
                <TooltipFrame
                  title={r.name}
                  rows={[
                    { name: 'MAE', value: formatPower(r.mae), color: r.color },
                    { name: 'RMSE', value: formatPower(r.rmse) },
                    { name: 'Bias', value: formatPower(r.bias, { signed: true }) },
                  ]}
                  note={r.mae === best ? 'Lowest error' : `${formatPct((r.mae / best - 1) * 100, { digits: 0 })} more error than the best`}
                />
              );
            }}
          />
          <Bar dataKey="mae" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
            {rows.map((r) => (
              <Cell key={r.name} fill={r.color} />
            ))}
            <LabelList dataKey="mae" position="right" formatter={(v: number) => formatPower(v)} fill={theme.text} fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
