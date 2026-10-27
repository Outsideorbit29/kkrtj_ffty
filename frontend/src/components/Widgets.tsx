import { useState, type ReactNode } from 'react';
import type { DayStat, IsoDate } from '../api/types';
import { rankDays, type DayRankKey } from '../lib/dashboard';
import { formatCalendarDate } from '../lib/dates';
import { formatEnergy, formatPct, formatPower } from '../lib/format';
import { IconArrowRight } from './Icons';
import { Segmented } from './Segmented';

/** Share of hours over- vs under-forecast as one split bar with labelled ends. */
export function SplitBar({ over, under }: { over: number; under: number }) {
  const n = over + under;
  if (n === 0) return <p className="empty">No comparable hours.</p>;
  const overPct = (over / n) * 100;
  return (
    <div className="split">
      <div className="split__bar" aria-hidden>
        <span className="split__seg split__seg--over" style={{ width: `${overPct}%` }} />
        <span className="split__seg split__seg--under" style={{ width: `${100 - overPct}%` }} />
      </div>
      <div className="split__labels">
        <span>
          <i className="dot dot--over" aria-hidden /> Over-forecast <strong>{formatPct(overPct, { digits: 0 })}</strong>{' '}
          <span className="muted">({over.toLocaleString('en-GB')} h)</span>
        </span>
        <span>
          <i className="dot dot--under" aria-hidden /> Under <strong>{formatPct(100 - overPct, { digits: 0 })}</strong>{' '}
          <span className="muted">({under.toLocaleString('en-GB')} h)</span>
        </span>
      </div>
    </div>
  );
}

export interface Fact {
  label: string;
  value: ReactNode;
  note?: ReactNode;
}

/** Label / value rows, CRM "record details" style. */
export function FactList({ facts }: { facts: Fact[] }) {
  return (
    <dl className="facts">
      {facts.map((f) => (
        <div key={f.label} className="facts__row">
          <dt>{f.label}</dt>
          <dd>
            <span className="facts__value">{f.value}</span>
            {f.note && <span className="facts__note">{f.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const RANKS: { key: DayRankKey; label: string }[] = [
  { key: 'bias', label: 'Bias' },
  { key: 'mae', label: 'MAE' },
  { key: 'shortfall', label: 'Shortfall' },
];

/** Leaderboard of the worst delivery days, with an inline bar and a drill-down button. */
export function WorstDays({ days, onOpenDay, limit = 8 }: { days: DayStat[]; onOpenDay: (date: IsoDate) => void; limit?: number }) {
  const [key, setKey] = useState<DayRankKey>('bias');
  const ranked = rankDays(days, key, limit);
  const metric = (d: DayStat) => (key === 'shortfall' ? d.forecastMWh - d.actualMWh : d[key]);
  const max = Math.max(...ranked.map((d) => Math.abs(metric(d))), 1);
  const fmt = (d: DayStat) => (key === 'shortfall' ? formatEnergy(metric(d), { signed: true }) : formatPower(metric(d), { signed: key === 'bias' }));

  return (
    <div className="rank">
      <div className="rank__toolbar">
        <span className="muted">Rank by</span>
        <Segmented label="Rank days by" options={RANKS} value={key} onChange={setKey} />
      </div>
      <ol className="rank__list">
        {ranked.map((d, i) => (
          <li key={d.date} className="rank__row">
            <span className="rank__pos">{i + 1}</span>
            <span className="rank__day">
              <strong>{formatCalendarDate(d.date)}</strong>
              <span className="muted">
                MAE {formatPower(d.mae)} · bias {formatPower(d.bias, { signed: true })}
              </span>
            </span>
            <span className="rank__bar" aria-hidden>
              <span
                className={`rank__fill${metric(d) < 0 ? ' rank__fill--under' : ''}`}
                style={{ width: `${(Math.abs(metric(d)) / max) * 100}%` }}
              />
            </span>
            <span className="rank__value">{fmt(d)}</span>
            <button type="button" className="icon-btn icon-btn--sm" onClick={() => onOpenDay(d.date)} aria-label={`Open ${formatCalendarDate(d.date)}`}>
              <IconArrowRight />
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Every delivery day as a chip coloured by its bias; selecting one opens that day. */
export function DayStrip({ days, selected, onSelect }: { days: DayStat[]; selected: IsoDate; onSelect: (date: IsoDate) => void }) {
  const max = Math.max(...days.map((d) => Math.abs(d.bias)), 1);
  return (
    <div className="daystrip" role="group" aria-label="Delivery days, coloured by daily bias">
      {days.map((d) => {
        const [, , dd] = d.date.split('-');
        const weekday = formatCalendarDate(d.date).split(' ')[0];
        const h = Math.max(8, (Math.abs(d.bias) / max) * 100);
        return (
          <button
            key={d.date}
            type="button"
            className="daystrip__day"
            aria-pressed={d.date === selected}
            title={`${formatCalendarDate(d.date)} · bias ${formatPower(d.bias, { signed: true })} · MAE ${formatPower(d.mae)}`}
            onClick={() => onSelect(d.date)}
          >
            <span className="daystrip__wd">{weekday}</span>
            <span className="daystrip__dd">{Number(dd)}</span>
            <span className="daystrip__bar" aria-hidden>
              <span className={`daystrip__fill${d.bias < 0 ? ' daystrip__fill--under' : ''}`} style={{ height: `${h}%` }} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
