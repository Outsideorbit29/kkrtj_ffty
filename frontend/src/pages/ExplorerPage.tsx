import { useId, useMemo, useState } from 'react';
import type { HhMm, IsoDate } from '../api/types';
import { Card } from '../components/Card';
import { Download, IconArrowRight, IconSort } from '../components/Icons';
import { Segmented } from '../components/Segmented';
import { StatCard } from '../components/StatCard';
import { DashSkeleton, ErrorState, LoadingStatus } from '../components/States';
import { useAccuracy } from '../hooks/api';
import { downloadText, toCsv } from '../lib/csv';
import {
  queryRows,
  summarise,
  toExplorerRows,
  type Direction,
  type ExplorerQuery,
  type ExplorerRow,
  type SortKey,
} from '../lib/dashboard';
import { formatCalendarDate } from '../lib/dates';
import { formatMw, formatPct, formatPower, hourLabel } from '../lib/format';

const MIN_ERRORS = [0, 1000, 2000, 3000, 5000];
const PAGE_SIZES = [25, 50, 100];

interface ColumnDef {
  key: SortKey | null;
  header: string;
  cell: (r: ExplorerRow) => string;
  className?: (r: ExplorerRow) => string | undefined;
}

const COLUMNS: ColumnDef[] = [
  { key: 'startTime', header: 'Delivery day', cell: (r) => formatCalendarDate(r.date) },
  { key: null, header: 'Hour (UK)', cell: (r) => hourLabel(r.hour) },
  { key: 'forecast', header: 'Forecast MW', cell: (r) => formatMw(r.forecast) },
  { key: 'actual', header: 'Actual MW', cell: (r) => formatMw(r.actual) },
  { key: 'error', header: 'Error MW', cell: (r) => formatMw(r.error, { signed: true }), className: (r) => ((r.error ?? 0) > 0 ? 'pos' : undefined) },
  { key: 'absError', header: '|Error| MW', cell: (r) => formatMw(r.absError) },
  { key: 'horizonHours', header: 'Lead time h', cell: (r) => r.horizonHours.toFixed(1) },
];

function exportCsv(rows: ExplorerRow[], cutoff: HhMm) {
  const csv = toCsv(
    ['start_time_utc', 'delivery_day_uk', 'hour_uk', 'forecast_mw', 'actual_mw', 'error_mw', 'horizon_hours'],
    rows.map((r) => [r.startTime, r.date, hourLabel(r.hour), r.forecast, r.actual, r.error, r.horizonHours]),
  );
  downloadText(`wind-forecast_hours_cutoff-${cutoff.replace(':', '')}.csv`, csv);
}

const DEFAULT_QUERY: ExplorerQuery = { direction: 'all', minAbsError: 0, hour: -1, date: '', sort: 'absError', desc: true };

function Explorer({ rows, cutoff, onOpenDay }: { rows: ExplorerRow[]; cutoff: HhMm; onOpenDay: (d: IsoDate) => void }) {
  const id = useId();
  const [q, setQ] = useState<ExplorerQuery>(DEFAULT_QUERY);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);
  const update = (patch: Partial<ExplorerQuery>) => {
    setQ((prev) => ({ ...prev, ...patch }));
    setPage(0);
  };

  const filtered = useMemo(() => queryRows(rows, q), [rows, q]);
  const stats = summarise(filtered);
  const all = summarise(rows);
  const days = useMemo(() => [...new Set(rows.map((r) => r.date))], [rows]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * pageSize, (current + 1) * pageSize);
  const isDefault = JSON.stringify(q) === JSON.stringify(DEFAULT_QUERY);

  const sortBy = (key: SortKey) => update(q.sort === key ? { desc: !q.desc } : { sort: key, desc: key !== 'startTime' });

  return (
    <div className="dash">
      <div className="kpis">
        <StatCard accent label="Hours matching" value={filtered.length.toLocaleString('en-GB')} detail={`of ${rows.length.toLocaleString('en-GB')} delivery hours`} />
        <StatCard label="MAE of selection" value={formatPower(stats.mae)} detail={`All hours: ${formatPower(all.mae)}`} />
        <StatCard label="Bias of selection" value={formatPower(stats.bias, { signed: true })} detail={`All hours: ${formatPower(all.bias, { signed: true })}`} />
        <StatCard
          label="Share of all hours"
          value={formatPct(rows.length ? (filtered.length / rows.length) * 100 : null, { digits: 0 })}
          meter={{ value: filtered.length, max: Math.max(rows.length, 1) }}
          detail="Selection size against the range"
        />
      </div>
      <Card
        span="span-12"
        title="Hourly records"
        subtitle="Decision-time forecast against metered wind for every delivery hour. Click a column to sort, a row to open the day."
        actions={
          <button type="button" className="btn btn--small" onClick={() => exportCsv(filtered, cutoff)} disabled={filtered.length === 0}>
            <Download /> Export {filtered.length.toLocaleString('en-GB')} rows
          </button>
        }
      >
        <div className="toolbar">
          <div className="toolbar__group">
            <span className="toolbar__label">Direction</span>
            <Segmented<Direction>
              label="Error direction"
              value={q.direction}
              onChange={(direction) => update({ direction })}
              options={[
                { key: 'all', label: 'All' },
                { key: 'over', label: 'Over-forecast' },
                { key: 'under', label: 'Under-forecast' },
              ]}
            />
          </div>
          <label className="toolbar__group" htmlFor={`${id}-min`}>
            <span className="toolbar__label">|Error| at least</span>
            <span className="select-wrap">
              <select id={`${id}-min`} className="select" value={q.minAbsError} onChange={(e) => update({ minAbsError: Number(e.target.value) })}>
                {MIN_ERRORS.map((v) => (
                  <option key={v} value={v}>
                    {v === 0 ? 'Any size' : formatPower(v)}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <label className="toolbar__group" htmlFor={`${id}-day`}>
            <span className="toolbar__label">Delivery day</span>
            <span className="select-wrap">
              <select id={`${id}-day`} className="select" value={q.date} onChange={(e) => update({ date: e.target.value })}>
                <option value="">All days</option>
                {days.map((d) => (
                  <option key={d} value={d}>
                    {formatCalendarDate(d)}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <label className="toolbar__group" htmlFor={`${id}-hour`}>
            <span className="toolbar__label">Hour</span>
            <span className="select-wrap">
              <select id={`${id}-hour`} className="select" value={q.hour} onChange={(e) => update({ hour: Number(e.target.value) })}>
                <option value={-1}>All hours</option>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <button type="button" className="btn btn--small btn--ghost" onClick={() => update(DEFAULT_QUERY)} disabled={isDefault}>
            Reset filters
          </button>
        </div>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Hourly records">
          <table className="table table--interactive">
            <caption className="visually-hidden">Hourly forecast records, sortable</caption>
            <thead>
              <tr>
                {COLUMNS.map((c) => {
                  const active = c.key !== null && q.sort === c.key;
                  return (
                    <th key={c.header} scope="col" aria-sort={active ? (q.desc ? 'descending' : 'ascending') : undefined}>
                      {c.key ? (
                        <button type="button" className="th-sort" onClick={() => sortBy(c.key as SortKey)}>
                          {c.header}
                          <IconSort dir={active ? (q.desc ? 'desc' : 'asc') : 'none'} className="th-sort__icon" />
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  );
                })}
                <th scope="col">
                  <span className="visually-hidden">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.startTime} onClick={() => onOpenDay(r.date)}>
                  {COLUMNS.map((c) => (
                    <td key={c.header} className={c.className?.(r)}>
                      {c.cell(r)}
                    </td>
                  ))}
                  <td className="td-action">
                    <button
                      type="button"
                      className="icon-btn icon-btn--sm"
                      aria-label={`Open ${formatCalendarDate(r.date)}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDay(r.date);
                      }}
                    >
                      <IconArrowRight />
                    </button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="td-empty">
                    No hours match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="pager">
          <label className="pager__size" htmlFor={`${id}-size`}>
            Rows per page
            <span className="select-wrap">
              <select
                id={`${id}-size`}
                className="select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <span className="pager__info">
            {filtered.length === 0
              ? '0 rows'
              : `${(current * pageSize + 1).toLocaleString('en-GB')}–${Math.min((current + 1) * pageSize, filtered.length).toLocaleString('en-GB')} of ${filtered.length.toLocaleString('en-GB')}`}
          </span>
          <div className="pager__btns">
            <button type="button" className="btn btn--small" onClick={() => setPage(current - 1)} disabled={current === 0}>
              Previous
            </button>
            <span className="pager__page">
              Page {current + 1} of {pages}
            </span>
            <button type="button" className="btn btn--small" onClick={() => setPage(current + 1)} disabled={current >= pages - 1}>
              Next
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

interface ExplorerPageProps {
  start: IsoDate;
  end: IsoDate;
  cutoff: HhMm;
  onOpenDay: (date: IsoDate) => void;
}

export function ExplorerPage({ start, end, cutoff, onOpenDay }: ExplorerPageProps) {
  const { data, error, loading, retry } = useAccuracy(start, end, cutoff);
  const rows = useMemo(() => (data ? toExplorerRows(data.series) : []), [data]);
  if (error) return <ErrorState error={error} onRetry={retry} />;
  return (
    <>
      {loading && <LoadingStatus label="Loading hourly records" />}
      {data ? (
        <div className={loading ? 'is-stale' : undefined}>
          <Explorer rows={rows} cutoff={cutoff} onOpenDay={onOpenDay} />
        </div>
      ) : (
        <DashSkeleton kpis={4} panels={[12]} />
      )}
    </>
  );
}
