import type { Decision, HourlyRow } from '../api/types';
import { toCsv, downloadText } from '../lib/csv';
import { formatMw, formatTime, toMs } from '../lib/format';
import { HOUR_MS } from './charts/common';
import { DataTable, type Column } from './DataTable';
import { Download } from './Icons';

const hourRange = (row: HourlyRow) => `${formatTime(row.startTime)}–${formatTime(toMs(row.startTime) + HOUR_MS)}`;

const COLUMNS: Column<HourlyRow>[] = [
  { header: 'Hour (UK)', cell: hourRange },
  { header: 'Forecast MW', cell: (r) => formatMw(r.forecast) },
  { header: 'P50 MW', cell: (r) => formatMw(r.p50) },
  { header: 'P10 MW', cell: (r) => formatMw(r.p10) },
  { header: 'P90 MW', cell: (r) => formatMw(r.p90) },
  { header: 'Actual MW', cell: (r) => formatMw(r.actual) },
  { header: 'Error MW', cell: (r) => formatMw(r.error, { signed: true }), className: (r) => ((r.error ?? 0) > 0 ? 'pos' : undefined) },
  { header: 'Lead time h', cell: (r) => r.horizonHours?.toFixed(1) ?? '–' },
];

function exportCsv(decision: Decision) {
  const csv = toCsv(
    ['start_time_utc', 'hour_uk', 'forecast_mw', 'p50_mw', 'p10_mw', 'p90_mw', 'actual_mw', 'error_mw', 'horizon_hours'],
    decision.hourly.map((r) => [r.startTime, hourRange(r), r.forecast, r.p50, r.p10, r.p90, r.actual, r.error, r.horizonHours]),
  );
  const cutoff = decision.cutoff.replace(':', '');
  downloadText(`wind-forecast_delivery-${decision.deliveryDate}_cutoff-${cutoff}.csv`, csv);
}

export function HourlyTable({ decision }: { decision: Decision }) {
  return (
    <section className="card">
      <details className="disclosure">
        <summary>Hourly detail ({decision.hourly.length} hours)</summary>
        <div className="table-actions">
          <p className="card__subtitle">Error = forecast − actual. Positive (red) means wind came in below forecast.</p>
          <button type="button" className="btn btn--small" onClick={() => exportCsv(decision)}>
            <Download /> Download CSV
          </button>
        </div>
        <DataTable
          caption={`Hourly forecast and actual for delivery ${decision.deliveryDate}`}
          columns={COLUMNS}
          rows={decision.hourly}
          rowKey={(r) => r.startTime}
        />
      </details>
    </section>
  );
}
