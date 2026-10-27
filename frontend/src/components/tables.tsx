import type { Accuracy, DayStat, ErrorMetrics, ForecastLevelBucket, HistogramBin, HourOfDayStat, LeadTimePoint } from '../api/types';
import { errorSpread } from '../lib/chartData';
import { formatCalendarDate } from '../lib/dates';
import { formatBin, formatEnergy, formatMw, formatPct, hourLabel } from '../lib/format';
import { DataTable } from './DataTable';

export const LeadTimeTable = ({ points }: { points: LeadTimePoint[] }) => (
  <DataTable
    caption="Forecast error by lead time, all runs"
    rows={points}
    rowKey={(p) => String(p.leadFrom)}
    columns={[
      { header: 'Lead time', cell: (p) => `${p.leadFrom}–${p.leadTo} h` },
      { header: 'Hours', cell: (p) => p.n.toLocaleString('en-GB') },
      { header: 'MAE MW', cell: (p) => formatMw(p.mae) },
      { header: 'RMSE MW', cell: (p) => formatMw(p.rmse) },
      { header: 'Bias MW', cell: (p) => formatMw(p.bias, { signed: true }) },
      { header: 'Spread excl. bias MW', cell: (p) => formatMw(errorSpread(p)) },
    ]}
  />
);

export const HourTable = ({ rows }: { rows: HourOfDayStat[] }) => (
  <DataTable
    caption="Forecast error by hour of day"
    rows={rows}
    rowKey={(r) => String(r.hour)}
    columns={[
      { header: 'Hour (UK)', cell: (r) => hourLabel(r.hour) },
      { header: 'Hours', cell: (r) => r.n },
      { header: 'MAE MW', cell: (r) => formatMw(r.mae) },
      { header: 'Bias MW', cell: (r) => formatMw(r.bias, { signed: true }) },
    ]}
  />
);

export const DayTable = ({ rows }: { rows: DayStat[] }) => (
  <DataTable
    caption="Forecast error by delivery day"
    rows={rows}
    rowKey={(r) => r.date}
    columns={[
      { header: 'Delivery day', cell: (r) => formatCalendarDate(r.date) },
      { header: 'MAE MW', cell: (r) => formatMw(r.mae) },
      { header: 'Bias MW', cell: (r) => formatMw(r.bias, { signed: true }), className: (r) => (r.bias > 0 ? 'pos' : undefined) },
      { header: 'Forecast', cell: (r) => formatEnergy(r.forecastMWh) },
      { header: 'Actual', cell: (r) => formatEnergy(r.actualMWh) },
    ]}
  />
);

export const ForecastLevelTable = ({ rows }: { rows: ForecastLevelBucket[] }) => (
  <DataTable
    caption="Forecast error by decision-time forecast level"
    rows={rows}
    rowKey={(r) => String(r.from)}
    columns={[
      { header: 'Forecast level', cell: (r) => r.bucket },
      { header: 'Hours', cell: (r) => r.n.toLocaleString('en-GB') },
      { header: 'MAE MW', cell: (r) => formatMw(r.mae) },
      { header: 'Bias MW', cell: (r) => formatMw(r.bias, { signed: true }), className: (r) => (r.bias > 0 ? 'pos' : undefined) },
      { header: 'Hours over-forecast', cell: (r) => formatPct(r.overForecastShare * 100, { digits: 0 }) },
    ]}
  />
);

export const HistogramTable = ({ bins }: { bins: HistogramBin[] }) => (
  <DataTable
    caption="Distribution of hourly forecast errors"
    rows={bins}
    rowKey={(b) => String(b.from)}
    columns={[
      { header: 'Error (forecast − actual)', cell: formatBin },
      { header: 'Hours', cell: (b) => b.count },
    ]}
  />
);

interface MetricRow {
  label: string;
  value: (m: ErrorMetrics) => string;
}

const METRIC_ROWS: MetricRow[] = [
  { label: 'Hours', value: (m) => m.n.toLocaleString('en-GB') },
  { label: 'MAE MW', value: (m) => formatMw(m.mae) },
  { label: 'RMSE MW', value: (m) => formatMw(m.rmse) },
  { label: 'Bias MW', value: (m) => formatMw(m.bias, { signed: true }) },
  { label: 'Normalised MAE', value: (m) => formatPct(m.nmae_pct) },
  { label: 'P10 error MW', value: (m) => formatMw(m.p10_error, { signed: true }) },
  { label: 'Median error MW', value: (m) => formatMw(m.p50_error, { signed: true }) },
  { label: 'P90 error MW', value: (m) => formatMw(m.p90_error, { signed: true }) },
  { label: 'P90 absolute error MW', value: (m) => formatMw(m.p90_abs_error) },
  { label: 'Worst miss MW', value: (m) => formatMw(m.max_abs_error) },
];

/** Every error metric for the forecast, the bias-corrected P50 and both baselines, side by side. */
export function MetricsTable({ a }: { a: Accuracy }) {
  const models: { name: string; m: ErrorMetrics | null }[] = [
    { name: 'Published forecast', m: a.forecast },
    { name: 'Bias-corrected P50', m: a.forecastAdjusted.n > 0 ? a.forecastAdjusted : null },
    { name: 'Persistence', m: a.baselines.persistence },
    { name: 'Same hour D-2', m: a.baselines.sameHourD2 },
  ];
  return (
    <DataTable
      caption="Error metrics by model"
      rows={METRIC_ROWS}
      rowKey={(r) => r.label}
      columns={[
        { header: 'Metric', cell: (r) => r.label },
        ...models.map(({ name, m }) => ({ header: name, cell: (r: MetricRow) => (m ? r.value(m) : '–') })),
      ]}
    />
  );
}
